import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {input,profile,memoryTable} from './helpers/atp-municipal-fixture.mjs';
import {validatePreparation,digest} from '../admin-api/src/services/atp-fiscal-v1.mjs';
import {inspectIssuanceWindow} from '../admin-api/src/services/atp-issuance-window.mjs';
import {createAtpPaymentGate} from '../admin-api/src/services/atp-payment-gate.mjs';
import {createAtpMunicipalAutomation,atpMunicipalPolicyHash} from '../admin-api/src/services/atp-municipal-automation.mjs';
import {createAtpFiscalRepository} from '../admin-api/src/services/atp-fiscal-store.mjs';
import {createAtpMunicipalStore} from '../admin-api/src/services/atp-municipal-store.mjs';
import {createAtpAutomationStore} from '../admin-api/src/services/atp-municipal-automation-store.mjs';
import {buildAtpMunicipal} from '../admin-api/src/services/atp-municipal-model.mjs';
import {startAtpAutomationHarness} from './helpers/atp-automation-http.mjs';
import {createAtpWorkerAuthority} from '../admin-api/src/services/atp-municipal-worker-authority.mjs';

const verified='2026-10-28T12:00:00Z',ready='2026-10-29T12:00:00Z';
const routing={approved:true,version:'QA-ROUTING',periodMeaning:'access',validFromDate:'2026-10-01',validThroughDate:'2026-11-09'};
const window={notBeforeUtc:ready,fiscalDeadlineUtc:'2026-10-31T02:59:59Z',policyVersion:'ATP-WAIT-v1'};
const prepared=()=>validatePreparation({...input,paymentVerifiedAtUtc:verified,servicePeriod:{startDate:'2026-10-28',endDate:'2026-11-28'},issuanceWindow:window});
const config={mode:'production',automationEnabled:true,issuanceEnabled:true,nationalEnabled:false,approved:true,exclusiveSeriesConfirmed:true,profile,series:'ATPQA',initialNumber:'1',notBeforeUtc:'2026-10-28T00:00:00Z',issuanceWindowPolicyVersion:'ATP-WAIT-v1',municipalRouting:routing};

test('janela imutável espera24h; deadline/competência/validade não encurtam espera nem alteram datas',()=>{
 const i=prepared();assert.equal(inspectIssuanceWindow({input:i,config,nowUtc:verified}).state,'waiting');assert.equal(inspectIssuanceWindow({input:i,config,nowUtc:ready}).emissionDate,'2026-10-29');
 assert.throws(()=>inspectIssuanceWindow({input:{...i,issuanceWindow:{...window,fiscalDeadlineUtc:verified}},config,nowUtc:verified}),/DEADLINE/);
 assert.throws(()=>inspectIssuanceWindow({input:{...i,issuanceWindow:{...window,notBeforeUtc:'2026-11-01T12:00:00Z',fiscalDeadlineUtc:'2026-11-02T12:00:00Z'},paymentVerifiedAtUtc:'2026-10-31T12:00:00Z'},config,nowUtc:verified}),/COMPETENCE/);
 assert.throws(()=>inspectIssuanceWindow({input:{...i,issuanceWindow:{...window,notBeforeUtc:'2026-10-28T13:00:00Z'}},config,nowUtc:verified}),/POLICY/);
 assert.throws(()=>inspectIssuanceWindow({input,config,nowUtc:verified}),/MISSING/);
 assert.throws(()=>validatePreparation({...i,issuanceWindow:{...window,notBeforeUtc:'2026-10-30T12:00:00Z'}}),/Confira/);
});
test('fim do acesso em novembro só passa com política municipal explícita; competência preservada',()=>{
 const args={input:prepared(),profile,series:'ATPQA',number:'1',emissionDate:'2026-10-29'};
 assert.throws(()=>buildAtpMunicipal(args),/NOVEMBER/);const w=buildAtpMunicipal({...args,municipalRouting:routing});assert.equal(w.emissionDate,'2026-10-29');
 assert.throws(()=>buildAtpMunicipal({...args,emissionDate:'2026-11-01',municipalRouting:routing}),/COMPETENCE/);
 assert.throws(()=>buildAtpMunicipal({...args,municipalRouting:{...routing,approved:false}}),/ROUTING/);
});
async function gateServer(clock){
 const calls=[],secret='S'.repeat(64),permit='P'.repeat(64);let mode='allow';
 const server=createServer(async(req,res)=>{let text='';for await(const b of req)text+=b;const body=JSON.parse(text),consume=req.url.endsWith('/consume');calls.push({path:req.url,phase:body.phase,executionId:body.executionId});
  if(req.headers.authorization!=='Bearer '+(consume?permit:secret)){res.writeHead(401).end();return;}
  if(mode==='unavailable'){res.writeHead(503).end();return;}
  const checked=new Date(clock()).toISOString(),expires=new Date(clock()+120000).toISOString();
  const v={protocolVersion:'1',authorized:mode!=='deny'&&!(mode==='deny-consume'&&consume),...Object.fromEntries(['phase','requestId','externalReference','requestHash','policyHash','workId','xmlHash','dispatchReservationId','controlFence','executionId'].filter(k=>k in body).map(k=>[k,body[k]])),...(consume?{phase:'consume'}:{}),authorizationId:consume?body.authorizationId:'a'.repeat(32),checkedAtUtc:checked,expiresAtUtc:mode==='expired'?verified:expires,...(!consume&&body.phase==='dispatch'?{permitToken:permit}:{})};
  if(mode==='mismatch')v.requestHash='0'.repeat(64);res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify(v));
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {calls,baseUrl:'http://127.0.0.1:'+server.address().port,gate:createAtpPaymentGate({baseUrl:'http://127.0.0.1:'+server.address().port,mode:'simulation',tokenProvider:async()=>secret,now:clock}),setMode:m=>{mode=m;},close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
test('authorize/consume por HTTP validam vínculos/TTL e negam erro, pagamento revogado e permit expirado',async()=>{
 let time=Date.parse(ready);const h=await gateServer(()=>time),request={id:'1'.repeat(64),hash:'2'.repeat(64),input:prepared()},policyHash='3'.repeat(64),dispatch={workId:'4'.repeat(64),xmlHash:'5'.repeat(64),dispatchReservationId:'6'.repeat(64),controlFence:1};
 try{
  assert.equal((await h.gate.authorize({phase:'prepare',request,policyHash})).authorized,true);const p=await h.gate.authorize({phase:'dispatch',request,policyHash,dispatch});
  const consumed=await h.gate.consume({permit:p,executionId:'QA-job',request,policyHash,workId:dispatch.workId,xmlHash:dispatch.xmlHash,dispatch:{reservationId:dispatch.dispatchReservationId,controlFence:1}});assert.equal(consumed.executionId,'QA-job');
  for(const [mode,error]of [['deny',/NOT_AUTHORIZED/],['unavailable',/UNAVAILABLE/],['mismatch',/BINDING/],['expired',/EXPIRED/]]){h.setMode(mode);await assert.rejects(h.gate.authorize({phase:'prepare',request,policyHash}),error);}
  const before=h.calls.length;time+=180000;await assert.rejects(h.gate.consume({permit:p,executionId:'QA-job'}),/EXPIRED/);assert.equal(h.calls.length,before);
 }finally{await h.close();}
});
test('HTTP + SDK Azure:24h semRPS, authorize/dispatch/consume antes de governo simulado; revogação impede emissão',{skip:!process.env.ATP_AZURITE_PACKAGE,timeout:120000},async()=>{
 let time=Date.parse(verified);const callback=await gateServer(()=>time),token='Q'.repeat(64),h=await startAtpAutomationHarness({token,now:()=>new Date(time).toISOString()}),headers={authorization:'Bearer '+token,'content-type':'application/json'},base=h.baseUrl+'/api/integracoes/atp/v1/solicitacoes-fiscais';
 const post=async(url,body)=>{const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});assert.ok(r.ok,await r.clone().text());return r.json();};
 const tick=steps=>post(h.baseUrl+'/qa/tick',{steps,concurrency:1});
 try{
  await post(h.baseUrl+'/qa/payment-gate',{baseUrl:callback.baseUrl,token:'S'.repeat(64),municipalRouting:routing,notBeforeUtc:config.notBeforeUtc});
  const first=(await post(base,prepared())).request;await tick(6);assert.equal((await h.jobs.get(first.id)).stage,'waiting');assert.equal((await h.jobs.get(first.id)).workId,undefined);assert.equal(h.stats.tests,0);assert.equal(h.stats.emissions,0);assert.equal(callback.calls.length,0);
  time=Date.parse(ready);await post(h.baseUrl+'/qa/clock',{utc:ready});await tick(6);assert.equal((await h.repository.get(first.id)).status,'issued');assert.equal(h.stats.emissions,1);assert.deepEqual(callback.calls.map(c=>c.phase||'consume'),['prepare','dispatch','consume']);
  callback.setMode('deny-consume');const second=(await post(base,{...prepared(),paymentId:'QA-second',externalReference:'ATP:QA-second'})).request;await tick(4);assert.equal(h.stats.emissions,1);assert.notEqual((await h.repository.get(second.id)).status,'issued');
 }finally{await h.close();await callback.close();}
});
test('orquestrador persiste espera sem reservar RPS; só após prazo consulta HTTP e prepara',async()=>{
 let time=Date.parse(verified);const h=await gateServer(()=>time),table=memoryTable(),repository=createAtpFiscalRepository({table,blobs:{}}),i=prepared(),id=digest('ATP\0'+i.paymentId);
 await repository.create({id,source:'ATP',hash:digest(JSON.stringify(i)),input:i,status:'pending_review',reviewStatus:'none',createdAtUtc:verified,updatedAtUtc:verified,documents:{}});
 repository.automationCandidates=async function*(){const r=await repository.get(id);if(!r.automationDueUtc||Date.parse(r.automationDueUtc)<=time)yield r;};
 const jobs=createAtpAutomationStore(table,{now:()=>time}),works=createAtpMunicipalStore(table),automation=createAtpMunicipalAutomation({repository,works,jobs,executor:{execute:()=>{throw Error('No fiscal calls during this test');}},paymentGate:h.gate,config,now:()=>new Date(time).toISOString()});
 try{
  await automation.tick();assert.equal((await jobs.get(id)).stage,'waiting');assert.equal(h.calls.length,0);assert.equal([...table.rows.values()].filter(r=>r.partitionKey==='nfse-sequencia-sysney').length,0);assert.equal((await jobs.get(id)).emissionDate,undefined);
  time=Date.parse(ready);await automation.tick();assert.equal((await jobs.get(id)).stage,'prepared');assert.equal(h.calls.length,1);assert.equal(h.calls[0].phase,'prepare');assert.equal((await jobs.get(id)).emissionDate,'2026-10-29');assert.ok([...table.rows.values()].some(r=>r.partitionKey==='nfse-sequencia-sysney'));
  const policyHash=atpMunicipalPolicyHash(config),r=await repository.get(id),job=await jobs.get(id),work=await works.get(job.workId),active=await jobs.acquire({requestId:id,requestHash:r.hash,policyHash,owner:'QA-worker'});
  const binding={workId:work.workId,xmlHash:work.hash,dispatchReservationId:digest(JSON.stringify(['atp-dispatch-v1',id,r.hash,work.workId,work.hash])),controlFence:1};
  const permit=await h.gate.authorize({phase:'dispatch',request:r,policyHash,dispatch:binding}),dispatch=await repository.reserveMunicipalDispatch({requestId:id,requestHash:r.hash,workId:work.workId,xmlHash:work.hash,actor:{role:'administrador',id:'QA-worker'},at:ready});
  const authority=createAtpWorkerAuthority({documents:table,paymentGate:h.gate,config:{paused:false,allowFiscalCalls:true,automationEnabled:true,issuanceEnabled:true,nationalEnabled:false,approvedPolicyHash:policyHash,approvedPolicyVersion:profile.version,requireFreshPayment:true,municipalRouting:routing,issuanceWindowPolicyVersion:'ATP-WAIT-v1'},now:()=>time});
  const payload={action:'emitir',workId:work.workId,xml:work.xml,chain:work.chain,approvedHash:work.hash,dispatch,paymentPermit:permit,queueExecutionId:'QA-job',automation:{requestId:id,requestHash:r.hash,policyHash,profileVersion:profile.version,leaseClaimId:active.claimId,leaseFence:active.fence}};
  assert.equal((await authority(payload)).phase,'consume');h.setMode('deny-consume');await assert.rejects(authority(payload),/NOT_AUTHORIZED/);
  const latest=await repository.get(id);await repository.replace({...latest,reviewStatus:'refund_review_required'},latest.etag);const count=h.calls.length;await assert.rejects(authority(payload),/REVIEW_OR_FENCE/);assert.equal(h.calls.length,count);
 }finally{await h.close();}
});
