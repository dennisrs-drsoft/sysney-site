import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtpFiscalHandler,preparationId} from '../admin-api/src/services/atp-fiscal-v1.mjs';
const token='s'.repeat(48);
export const fixture={paymentId:'pay_sintetico_001',externalReference:'ATP:pay_sintetico_001',orderId:'pedido-sintetico',arenaId:'arena-sintetica',amountCentsBRL:19900,paymentVerifiedAtUtc:'2026-10-27T12:00:00Z',competence:'2026-10',servicePeriod:{startDate:'2026-10-01',endDate:'2026-10-31'},description:'Assinatura sintética para teste offline',recipient:{documentType:'CNPJ',document:'11222333000181',legalName:'CLIENTE SINTETICO LTDA',confirmed:true,address:{streetType:'R',street:'Rua Sintetica',number:'100',district:'Centro',municipalityCode:'3550308',state:'SP',postalCode:'01001000'}}};
function setup(options={}){
 const rows=new Map(),refs=new Map();let count=0;
 const store={get:async id=>structuredClone(rows.get(id)),byReference:async ref=>structuredClone(rows.get(refs.get(ref))),create:async r=>{if(rows.has(r.id)||refs.has(r.input.externalReference))throw Object.assign(Error(),{statusCode:409});rows.set(r.id,{...structuredClone(r),etag:'1'});refs.set(r.input.externalReference,r.id);count++;if(options.timeout)throw Error('timeout apos commit');},replace:async(r,etag)=>{const old=rows.get(r.id);if(old.etag!==etag)throw Object.assign(Error(),{statusCode:412});rows.set(r.id,{...structuredClone(r),etag:String(Number(etag)+1)});},download:async()=>{throw Error('PDF indisponivel');}};
 const handler=createAtpFiscalHandler({config:()=>({enabled:'true',token,...options.config}),storeFactory:()=>store,...(options.handler||{})});
 const call=(method='POST',body=fixture,params={},query='',auth=`Bearer ${token}`)=>{
  const req=new Request(`https://local.invalid/api/integracoes/atp/v1/solicitacoes-fiscais${query}`,{method,headers:{authorization:auth,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});req.params=params;return handler(req);
 };
 return {call,rows,refs,count:()=>count};
}
test('desligada/configuracao invalida falha antes de storage',async()=>{
 let storage=false;const h=createAtpFiscalHandler({config:()=>({enabled:'false',token}),storeFactory:()=>{storage=true;throw Error();}});
 const r=await h(new Request('https://local.invalid'));assert.equal(r.status,503);assert.equal(storage,false);
 for(const t of ['', 'curto','x '.repeat(30)])assert.equal((await setup({config:{token:t}}).call()).status,503);
});
test('auth dedicada recusa ausente e principal admin nao substitui Bearer',async()=>{const s=setup();assert.equal((await s.call('POST',fixture,{},'','')).status,401);assert.equal((await s.call('POST',fixture,{},'','Bearer admin')).status,401);assert.equal(s.count(),0);});
test('cria preparacao, repete, recupera referencia e rejeita conflito',async()=>{
 const s=setup(),r=await s.call();assert.equal(r.status,202);assert.equal(r.jsonBody.request.status,'pending_review');assert.equal(r.jsonBody.request.capabilities.automaticIssuance,false);
 assert.equal((await s.call()).status,200);assert.equal(s.count(),1);
 assert.equal((await s.call('POST',{...fixture,amountCentsBRL:20000})).status,409);
 assert.equal((await s.call('POST',{...fixture,paymentId:'pay_outro'})).status,409);
 const g=await s.call('GET',null,{},'?externalReference='+encodeURIComponent(fixture.externalReference));assert.equal(g.jsonBody.request.id,r.jsonBody.request.id);
 assert.equal(JSON.stringify(g).includes(fixture.recipient.document),false);
});
test('concorrencia e timeout apos commit preservam unico registro',async()=>{
 const s=setup(),results=await Promise.all(Array.from({length:12},()=>s.call()));assert.equal(s.count(),1);assert.ok(results.every(r=>[200,202].includes(r.status)));
 const t=setup({timeout:true});assert.equal((await t.call()).status,200);assert.equal(t.count(),1);
});
test('renovacao usa paymentId, nao pedido',async()=>{const s=setup();await s.call();assert.equal((await s.call('POST',{...fixture,paymentId:'pay_renovacao',externalReference:'ATP:renovacao'})).status,202);assert.equal(s.count(),2);});
test('escopo ATP nao acessa origem diferente',async()=>{const s=setup(),id=preparationId('outra');s.rows.set(id,{source:'OUTRO'});assert.equal((await s.call('GET',null,{id})).status,404);});
test('data verificada obrigatoria; hora real opcional; campos extras rejeitados',async()=>{
 const s=setup(),v=structuredClone(fixture);delete v.paymentVerifiedAtUtc;assert.equal((await s.call('POST',v)).status,400);
 assert.equal((await s.call('POST',{...fixture,source:'ATP'})).status,400);
 assert.equal((await s.call('POST',{...fixture,paidAtUtc:'2026-02-30T12:00:00Z'})).status,400);
 assert.equal((await s.call('POST',{...fixture,recipient:{...fixture.recipient,document:'00000000000000'}})).status,400);
 assert.equal((await s.call('POST',{...fixture,description:'x'.repeat(20000)})).status,413);
});
test('estorno requer revisao; nao altera estado de emissao; replay/conflito',async()=>{
 const s=setup(),r=await s.call(),id=r.jsonBody.request.id,p={id,action:'revisao-estorno'},b={refundId:'revisao-atp-001',reason:'Estorno comercial confirmado'};
 const result=await s.call('POST',b,p);assert.equal(result.jsonBody.request.reviewStatus,'refund_review_required');assert.equal(result.jsonBody.request.status,'pending_review');
 assert.equal((await s.call('POST',b,p)).jsonBody.replayed,true);assert.equal((await s.call('POST',{...b,reason:'Diferente'},p)).status,409);
});
test('PDF pendente ou falhando nao reemite nem cria registro',async()=>{
 const s=setup(),id=(await s.call()).jsonBody.request.id;
 assert.equal((await s.call('GET',null,{id,format:'pdf'})).status,409);
 const row=s.rows.get(id);row.status='issued';row.invoice={number:'SINTETICA',issuerDocument:'57767099000179',provider:'national'};row.documents={pdf:{blob:'sintetico'}};
 assert.equal((await s.call('GET',null,{id,format:'pdf'})).status,503);assert.equal(s.rows.get(id).status,'issued');assert.equal(s.count(),1);
});
