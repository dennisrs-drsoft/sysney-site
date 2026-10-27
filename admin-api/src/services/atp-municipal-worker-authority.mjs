import {digest} from './atp-fiscal-v1.mjs';
import {createAtpMunicipalStore} from './atp-municipal-store.mjs';
// Run on the VM immediately before native execution, using its existing table
// Reader permission. Recheck refund/policy/fence after waiting in the queue.
export function createAtpWorkerAuthority({documents,config,now=()=>Date.now()}){
 const read=async(part,row)=>documents.getEntity(part,row),works=createAtpMunicipalStore(documents);
 return async p=>{
  const a=p.automation;
  if(!a){if(p.action==='emitir')throw Error('ATP_AUTOMATED_WORK_PROVENANCE_REQUIRED');return;}
  if(config.paused!==false||config.allowFiscalCalls!==true||config.automationEnabled!==true||config.nationalEnabled!==false||a.policyHash!==config.approvedPolicyHash||a.profileVersion!==config.approvedPolicyVersion)throw Error('ATP_WORKER_POLICY_DISABLED');
  if(p.action==='emitir'&&config.issuanceEnabled!==true)throw Error('ATP_WORKER_ISSUANCE_DISABLED');
  const request=JSON.parse((await read('integracao-fiscal-atp-v1','request-'+a.requestId)).json),lease=JSON.parse((await read('atp-municipal-automation-v1',a.requestId)).json),work=await works.get(p.workId),proof=JSON.parse((await read('integracao-fiscal-atp-v1','work-'+p.workId)).json);
  if(request.source!=='ATP'||request.hash!==a.requestHash||request.reviewStatus!=='none'||lease.requestHash!==request.hash||lease.policyHash!==a.policyHash||lease.claimId!==a.leaseClaimId||lease.fence!==a.leaseFence||lease.leaseUntil<=now()||work?.source!=='ATP'||work.requestId!==a.requestId||work.requestHash!==request.hash||proof.source!=='ATP'||proof.requestId!==a.requestId||proof.workId!==p.workId||proof.snapshotHash!==work.snapshotHash)throw Error('ATP_WORKER_REVIEW_OR_FENCE_CHANGED');
  const expected=p.action==='testar'?work.testXml:p.action==='consultar'?work.queryXml:work.xml;
  if(digest(p.xml)!==digest(expected)||p.approvedHash!==(p.action==='testar'?work.testHash:work.hash)||p.action!=='consultar'&&p.chain!==work.chain)throw Error('ATP_WORKER_XML_BINDING_CHANGED');
  if(p.action==='emitir'&&(request.status!=='pending_review'||p.approvedHash!==work.hash||digest(p.xml)!==work.hash))throw Error('ATP_WORKER_XML_BINDING_CHANGED');
 };
}
