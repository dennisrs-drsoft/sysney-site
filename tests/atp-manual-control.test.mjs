import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {input,memoryTable} from './helpers/atp-municipal-fixture.mjs';
import {createAtpFiscalRepository} from '../admin-api/src/services/atp-fiscal-store.mjs';
import {createAtpFiscalHandler,digest,validatePreparation} from '../admin-api/src/services/atp-fiscal-v1.mjs';
import {startAtpAutomationHarness} from './helpers/atp-automation-http.mjs';

const at='2026-10-27T15:00:00Z',token='q'.repeat(64),actor={role:'administrador',id:'QA-ONLY'};
const require=createRequire(import.meta.url),yaml=require('js-yaml'),Ajv=require('ajv');
async function setup(){
 const table=memoryTable(),repo=createAtpFiscalRepository({table,blobs:{}}),i=validatePreparation({...input,paymentId:randomUUID(),externalReference:'ATP:'+randomUUID()}),id=digest('ATP\0'+i.paymentId),workId=digest('work'+id),hash=digest(JSON.stringify(i));
 await repo.create({id,source:'ATP',hash,input:i,status:'pending_review',reviewStatus:'none',createdAtUtc:at,updatedAtUtc:at,documents:{},refunds:{}});
 await repo.reserveProvenance({source:'ATP',requestId:id,workId});
 return {table,repo,id,workId,hash,claim:{requestId:id,claimId:'manual-QA',externalReference:i.externalReference,reason:'Contingência sintética',at},dispatch:{requestId:id,requestHash:hash,workId,xmlHash:digest('XML-QA'),actor,at}};
}
test('claim manual durável recupera timeout e replay; bloqueia outro claim, referência e dispatch',async()=>{
 const s=await setup();s.table.timeoutOnce();const first=await s.repo.claimManual(s.claim),replay=await s.repo.claimManual(s.claim);
 assert.equal(first.manualControl.acknowledged,true);assert.equal(replay.replayed,true);assert.deepEqual(replay.manualControl,first.manualControl);
 await assert.rejects(s.repo.claimManual({...s.claim,claimId:'other'}),e=>e.code==='MANUAL_CLAIM_CONFLICT');
 await assert.rejects(s.repo.claimManual({...s.claim,externalReference:'wrong'}),e=>e.code==='IDEMPOTENCY_CONFLICT');
 await assert.rejects(s.repo.reserveMunicipalDispatch(s.dispatch),/CONTROL_REVIEW/);
 await s.repo.deferAutomation(s.id,at);assert.equal((await s.repo.get(s.id)).automationDueUtc,'9999-12-31T23:59:59.999Z');
});
test('claim vs intenção de transmissão tem único vencedor CAS em ambas as ordens; resultado incerto nunca vira ACK',async()=>{
 const winners=new Set();for(let n=0;n<8;n++){
  const s=await setup(),actions=n%2?[()=>s.repo.reserveMunicipalDispatch(s.dispatch),()=>s.repo.claimManual(s.claim)]:[()=>s.repo.claimManual(s.claim),()=>s.repo.reserveMunicipalDispatch(s.dispatch)];
  const results=await Promise.allSettled(actions.map(f=>f()));assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  const r=await s.repo.get(s.id);winners.add(r.executionControl.mode);
  if(r.executionControl.mode==='manual')assert.ok(results.some(x=>x.status==='fulfilled'&&x.value.manualControl?.acknowledged));
  else{assert.equal(r.reviewStatus,'fiscal_review_required');assert.equal(r.executionControl.mode,'review');assert.ok(results.some(x=>x.status==='rejected'&&x.reason.code==='MANUAL_RECONCILIATION_REQUIRED'));}
 }assert.ok(winners.has('manual')||winners.has('review'));
 const dispatched=await setup();await dispatched.repo.reserveMunicipalDispatch(dispatched.dispatch);await assert.rejects(dispatched.repo.claimManual(dispatched.claim),e=>e.code==='MANUAL_RECONCILIATION_REQUIRED');assert.equal((await dispatched.repo.get(dispatched.id)).executionControl.mode,'review');
});
test('ledger legado, nota emitida e estorno impedem ACK; revisão pré-emissão sem tentativa permite controle manual',async()=>{
 for(const state of ['ledger','issued','refund','pre_emission_review']){
  const s=await setup();if(state==='ledger')await s.table.createEntity({partitionKey:'atp-municipal-v1',rowKey:'send-'+s.workId,hash:s.dispatch.xmlHash});
  else{const r=await s.repo.get(s.id);await s.repo.replace({...r,...(state==='issued'?{status:'issued',invoice:{number:'QA'}}:{reviewStatus:state==='refund'?'refund_review_required':'fiscal_review_required'})},r.etag);}
  if(state==='pre_emission_review'){const r=await s.repo.claimManual(s.claim);assert.equal(r.manualControl.acknowledged,true);assert.equal(r.request.reviewStatus,'fiscal_review_required');}
  else await assert.rejects(s.repo.claimManual(s.claim),e=>e.code==='MANUAL_RECONCILIATION_REQUIRED');
 }
});
test('rota manual exige Bearer, payload fechado e identidade conferida; ACK separado não altera shape de GET',async()=>{
 const s=await setup(),handler=createAtpFiscalHandler({storeFactory:()=>s.repo,config:()=>({enabled:'true',token}),now:()=>at});
 const req=(body,auth=token)=>{const r=new Request('http://127.0.0.1/qa',{method:'POST',headers:{authorization:'Bearer '+auth,'content-type':'application/json'},body:JSON.stringify(body)});r.params={id:s.id,action:'assumir-manual'};return r;};
 const body={claimId:s.claim.claimId,externalReference:s.claim.externalReference,reason:s.claim.reason};
 assert.equal((await handler(req(body,'wrong'))).status,401);assert.equal((await handler(req({...body,confirmed:true}))).status,400);
 const r=await handler(req(body));assert.equal(r.status,200);assert.equal(r.jsonBody.manualControl.requestHash,s.hash);assert.equal(r.jsonBody.manualControl.protocolVersion,'1');
 const contract=yaml.load(readFileSync(new URL('../postman/atp-fiscal-v1.openapi.yaml',import.meta.url),'utf8')),schema=contract.paths['/api/integracoes/atp/v1/solicitacoes-fiscais/{id}/assumir-manual'].post.responses['200'].content['application/json'].schema,validate=new Ajv({allErrors:true}).compile({...schema,components:contract.components});assert.ok(validate(r.jsonBody),JSON.stringify(validate.errors));
 const get=new Request('http://127.0.0.1/qa');get.headers.set('authorization','Bearer '+token);get.params={id:s.id};const read=await handler(get);assert.equal(read.status,200);assert.equal('manualControl' in read.jsonBody,false);assert.equal('executionControl' in read.jsonBody.request,false);
});
test('HTTP + SDK Azure: assumir antes da emissão impede governo; dispatch incerto/issued recusam novo manual',{skip:!process.env.ATP_AZURITE_PACKAGE,timeout:120000},async()=>{
 const h=await startAtpAutomationHarness({token,now:()=>at}),base=h.baseUrl+'/api/integracoes/atp/v1/solicitacoes-fiscais',headers={authorization:'Bearer '+token,'content-type':'application/json'};
 const post=async(url,body)=>{const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 const create=async()=>{const r=await post(base,{...input,paymentId:randomUUID(),externalReference:'ATP:'+randomUUID()});assert.equal(r.status,202);return r.body.request;};
 const tick=async steps=>{const r=await post(h.baseUrl+'/qa/tick',{steps,concurrency:3});assert.equal(r.status,200);};
 const claim=r=>post(base+'/'+r.id+'/assumir-manual',{claimId:'manual-'+r.id,externalReference:r.externalReference,reason:'QA sem validade'});
 try{
  const manual=await create();await tick(2);const before={...h.stats},ack=await claim(manual);assert.equal(ack.status,200);assert.equal(ack.body.manualControl.acknowledged,true);await tick(6);assert.equal(h.stats.emissions,before.emissions);assert.equal(h.stats.tests,before.tests);assert.equal((await claim(manual)).body.replayed,true);
  for(let n=0;n<4;n++){const racing=await create();await tick(2);const emitted=h.stats.emissions;const [answer]=await Promise.all([claim(racing),tick(1)]);assert.ok([200,409].includes(answer.status));await tick(2);if(answer.status===200){assert.equal(answer.body.manualControl.acknowledged,true);assert.equal(h.stats.emissions,emitted);}else{assert.equal(answer.body.error.code,'MANUAL_RECONCILIATION_REQUIRED');assert.ok(h.stats.emissions<=emitted+1);}}
  const preUncertain=h.stats.emissions,uncertain=await create();await tick(3);assert.equal(h.stats.emissions,preUncertain+1);const blocked=await claim(uncertain);assert.equal(blocked.status,409);assert.equal(blocked.body.error.code,'MANUAL_RECONCILIATION_REQUIRED');await tick(3);assert.equal(h.stats.emissions,preUncertain+1);
  const issued=await create();await tick(6);assert.equal((await h.repository.get(issued.id)).status,'issued');assert.equal((await claim(issued)).status,409);
 }finally{await h.close();}
});
