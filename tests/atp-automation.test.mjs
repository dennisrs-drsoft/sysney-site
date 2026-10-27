import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startAtpAutomationHarness} from './helpers/atp-automation-http.mjs';
import {createAtpMunicipalAutomation} from '../admin-api/src/services/atp-municipal-automation.mjs';
import {createAtpAutomationStore} from '../admin-api/src/services/atp-municipal-automation-store.mjs';
import {runAzureAtpMunicipalAutomation} from '../admin-api/src/services/atp-municipal-automation-runtime.mjs';
import {memoryTable} from './helpers/atp-municipal-fixture.mjs';
import {createAtpWorkerAuthority} from '../admin-api/src/services/atp-municipal-worker-authority.mjs';
import {createAtpMunicipalStore} from '../admin-api/src/services/atp-municipal-store.mjs';
import {digest} from '../admin-api/src/services/atp-fiscal-v1.mjs';
test('gates OFF param antes de storage; simulação não aceita escopo remoto; lease expira com fencing',async()=>{
 assert.equal((await runAzureAtpMunicipalAutomation({env:{}})).state,'disabled');
 const disabled=createAtpMunicipalAutomation({config:{automationEnabled:false}});assert.equal((await disabled.tick()).visited,0);
 const unsafe=createAtpMunicipalAutomation({config:{automationEnabled:true,mode:'simulation'},executor:{kind:'loopback_standin'},simulationScope:{storage:'azurite-loopback',endpoint:'https://nfews.prefeitura.sp.gov.br'}});await assert.rejects(unsafe.tick(),/SCOPE/);
 let time=1;const s=createAtpAutomationStore(memoryTable(),{now:()=>time,leaseMs:10}),a={requestId:'a'.repeat(64),requestHash:'b'.repeat(64),policyHash:'c'.repeat(64),owner:'worker1',seed:{stage:'new'}};
 const first=await s.acquire(a);assert.equal(await s.acquire({...a,owner:'worker2'}),null);time=12;const second=await s.acquire({...a,owner:'worker2'});assert.equal(second.fence,2);await assert.rejects(s.save(first,{stage:'bad'}),/LEASE_LOST/);await s.save(second,{stage:'prepared'});await s.release(second);assert.equal((await s.get(a.requestId)).stage,'prepared');
});
test('worker relê política, estorno e fence após fila; nada chega ao executor quando divergente',async()=>{
 const table=memoryTable(),id='a'.repeat(64),workId='b'.repeat(64),policyHash='c'.repeat(64),hash='d'.repeat(64),xml='<RPS>QA</RPS>';
 const put=async(part,row,value)=>table.createEntity({partitionKey:part,rowKey:row,json:JSON.stringify(value)});
 const request={source:'ATP',hash,status:'pending_review',reviewStatus:'none'},lease={requestHash:hash,policyHash,claimId:'leaseQA',fence:1,leaseUntil:100};
 await put('integracao-fiscal-atp-v1','request-'+id,request);await put('atp-municipal-automation-v1',id,lease);await put('integracao-fiscal-atp-v1','work-'+workId,{source:'ATP',requestId:id,workId,snapshotHash:'snapshot'});
 await createAtpMunicipalStore(table).create({workId,source:'ATP',requestId:id,requestHash:hash,snapshotHash:'snapshot',xml,hash:digest(xml),chain:'chain'});
 const config={paused:false,allowFiscalCalls:true,automationEnabled:true,nationalEnabled:false,issuanceEnabled:true,approvedPolicyHash:policyHash,approvedPolicyVersion:'QA1'};
 const check=createAtpWorkerAuthority({documents:table,config,now:()=>10}),p={action:'emitir',xml,chain:'chain',workId,approvedHash:digest(xml),automation:{requestId:id,requestHash:hash,policyHash,profileVersion:'QA1',leaseClaimId:'leaseQA',leaseFence:1}};
 await check(p);await assert.rejects(check({...p,xml:'<RPS>OTHER</RPS>'}),/BINDING/);
 const row=await table.getEntity('integracao-fiscal-atp-v1','request-'+id);await table.updateEntity({...row,json:JSON.stringify({...request,reviewStatus:'refund_review_required'})},'Replace',{etag:row.etag});await assert.rejects(check(p),/REVIEW_OR_FENCE/);
 config.issuanceEnabled=false;await assert.rejects(check(p),/ISSUANCE_DISABLED/);
});

test('política alterada põe solicitação em revisão e falha transitória agenda nova tentativa',async()=>{
 const candidate={id:'a'.repeat(64),hash:'b'.repeat(64),status:'pending_review'},calls=[];
 const repository={async *automationCandidates(){yield candidate;},async markAutomationReview(p){calls.push(['review',p.reason]);},async deferAutomation(id,due){calls.push(['defer',due]);}};
 const config={mode:'simulation',automationEnabled:true,nationalEnabled:false,approved:true,exclusiveSeriesConfirmed:true,series:'ATPQA',initialNumber:'1',notBeforeUtc:'2026-10-27T00:00:00Z',profile:{version:'QA'}};
 let message='ATP_AUTOMATION_POLICY_CHANGED_REVIEW';const automation=createAtpMunicipalAutomation({repository,jobs:{async get(){return null;},async acquire(){throw Error(message);}},executor:{kind:'loopback_standin'},config,simulationScope:{storage:'azurite-loopback',endpoint:'http://127.0.0.1:4327'},now:()=> '2026-10-27T15:00:00Z'});
 assert.equal((await automation.tick()).review,1);message='STORAGE_UNAVAILABLE';assert.equal((await automation.tick()).errors,1);assert.deepEqual(calls,[['review','ATP_AUTOMATION_POLICY_CHANGED_REVIEW'],['defer','2026-10-27T15:01:00.000Z']]);
});
test('HTTP + orquestrador real + SDK Azure QA + governo stand-in: CPF/CNPJ, timeout, PDF tardio, estorno/cancelamento',{skip:!process.env.ATP_AZURITE_PACKAGE,timeout:180000},async()=>{
 const h=await startAtpAutomationHarness({token:'q'.repeat(64),now:()=> '2026-10-27T15:00:00Z'}),headers={authorization:'Bearer '+'q'.repeat(64),'content-type':'application/json'};
 const base=h.baseUrl+'/api/integracoes/atp/v1/solicitacoes-fiscais';
 const fixture=JSON.parse(await readFile(new URL('../postman/fixtures/atp-fiscal-v1.synthetic.json',import.meta.url)));
 const json=async(url,body)=>{const r=await fetch(url,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});assert.ok(r.ok,`HTTP ${r.status} ${await r.clone().text()}`);return r.json();};
 const tick=async(steps=6)=>json(h.baseUrl+'/qa/tick',{steps,concurrency:3});
 let n=0;const create=async cpf=>{
  const i={...fixture,paymentId:'QA-auto-'+(++n),externalReference:'ATP:QA-auto-'+n,...(cpf?{recipient:{...fixture.recipient,documentType:'CPF',document:'52998224725'}}:{})};
  const r=await fetch(base,{method:'POST',headers,body:JSON.stringify(i)});assert.equal(r.status,202);return (await r.json()).request;
 };
 const setMode=(requestId,name)=>json(h.baseUrl+'/qa/mode',{requestId,name});
 try{
  for(const cpf of [false,true]){const r=await create(cpf);const ticks=await tick();const current=(await json(base+'/'+r.id)).request;assert.equal(current.status,'issued',JSON.stringify({job:await h.jobs.get(r.id),ticks}));assert.equal(current.capabilities.automaticIssuance,false);assert.equal(current.documents.pdf,'available');assert.equal((await fetch(base+'/'+r.id+'/documentos/pdf',{headers})).status,200);}
  const emits=h.stats.emissions;await tick(2);assert.equal(h.stats.emissions,emits);
  const delayed=await create();await setMode(delayed.id,'pdf-unavailable');await tick();assert.equal((await json(base+'/'+delayed.id)).request.documents.pdf,'pending');
  const originalXml=(await h.repository.get(delayed.id)).documents.xml.sha256;
  const before=h.stats.emissions;await setMode(delayed.id,'pdf-wrong');await tick(1);assert.equal((await json(base+'/'+delayed.id)).request.documents.pdf,'pending');await setMode(delayed.id,'query-format-changed');await tick(1);assert.equal((await json(base+'/'+delayed.id)).request.documents.pdf,'available');assert.equal((await h.repository.get(delayed.id)).documents.xml.sha256,originalXml);assert.equal(h.stats.emissions,before);
  const timed=await create();await setMode(timed.id,'timeout');await tick();assert.equal((await json(base+'/'+timed.id)).request.status,'issued');assert.equal(h.stats.emissions,before+1);
  await setMode(timed.id,'cancelled');await tick(1);const cancelled=(await json(base+'/'+timed.id)).request;assert.equal(cancelled.status,'issued');assert.equal(cancelled.reviewStatus,'fiscal_review_required');assert.equal(cancelled.documents.xml,'pending');assert.equal((await fetch(base+'/'+timed.id+'/documentos/pdf',{headers})).status,409);assert.deepEqual((await h.repository.get(timed.id)).refunds,{});
  const refund=await create();await tick(2);const pre=h.stats.emissions;await json(base+'/'+refund.id+'/revisao-estorno',{refundId:'QA-refund',reason:'Teste local'});await tick();assert.equal(h.stats.emissions,pre);assert.equal((await json(base+'/'+refund.id)).request.reviewStatus,'refund_review_required');
  const changed=await create();await tick();const original=(await json(base+'/'+changed.id)).request;const beforeChange=h.stats.emissions;await setMode(changed.id,'substituted');await tick(1);const reviewed=(await json(base+'/'+changed.id)).request;assert.equal(reviewed.reviewStatus,'fiscal_review_required');assert.deepEqual(reviewed.invoice,original.invoice);assert.equal(reviewed.documents.pdf,'pending');assert.equal(h.stats.emissions,beforeChange);
  const november={...fixture,paymentId:'QA-November',externalReference:'ATP:QA-November',competence:'2026-11',servicePeriod:{startDate:'2026-11-01',endDate:'2026-11-30'}};const blocked=await json(base,november);const govBefore={...h.stats};await tick();assert.equal((await json(base+'/'+blocked.request.id)).request.reviewStatus,'fiscal_review_required');assert.equal(h.stats.emissions,govBefore.emissions);assert.equal(h.stats.tests,govBefore.tests);
 }finally{await h.close();}
});
