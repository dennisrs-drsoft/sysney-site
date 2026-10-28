import {randomUUID} from 'node:crypto';
import {digest} from './atp-fiscal-v1.mjs';
import {saoPauloFiscalDate,createAtpMunicipalWorkflow} from './atp-municipal-workflow.mjs';
import {inspectIssuanceWindow} from './atp-issuance-window.mjs';
import {validateMunicipalRouting} from './atp-municipal-model.mjs';
// The trusted policy replaces per-note UI approval, not invoice provenance.
// No bearer route invokes this; the private runtime owns policy and both gates.
export const atpMunicipalPolicyHash=config=>digest(JSON.stringify({profile:config.profile,series:config.series,initialNumber:config.initialNumber,notBeforeUtc:config.notBeforeUtc,mode:config.mode,...(config.municipalRouting?{municipalRouting:config.municipalRouting}:{}),...(config.issuanceWindowPolicyVersion?{issuanceWindowPolicyVersion:config.issuanceWindowPolicyVersion}:{})}));
export function createAtpMunicipalAutomation({repository,works,jobs,executor,paymentGate,config,simulationScope,now=()=>new Date().toISOString(),owner=randomUUID()}){
 const serviceIdentity={id:'SYSNEY-ATP-AUTOMATION',role:'administrador',kind:'automation'};
 const policy=()=>{
  if(config.automationEnabled!==true)return null;
  if(config.mode==='simulation'){
   const u=new URL(simulationScope?.endpoint||'https://invalid');
   if(simulationScope?.storage!=='azurite-loopback'||executor.kind!=='loopback_standin'||u.protocol!=='http:'||u.hostname!=='127.0.0.1')throw Error('ATP_SIMULATION_SCOPE_REQUIRED');
  }else if(config.mode!=='production'||config.issuanceEnabled!==true)return null;
  if(config.mode==='production'&&(!paymentGate||config.issuanceWindowPolicyVersion!=='ATP-WAIT-v1'||!config.municipalRouting))throw Error('ATP_FRESH_PAYMENT_POLICY_REQUIRED');
  if(config.nationalEnabled!==false||config.approved!==true||config.exclusiveSeriesConfirmed!==true||!/^ATP[A-Z0-9]{0,2}$/.test(config.series)||!/^\d{1,12}$/.test(config.initialNumber)||!config.profile?.version||!Number.isFinite(Date.parse(config.notBeforeUtc)))throw Error('ATP_AUTOMATION_APPROVED_POLICY_REQUIRED');
  return atpMunicipalPolicyHash(config);
 };
 return {async tick({limit=5}={}){
  const policyHash=policy();if(!policyHash)return {state:'disabled',visited:0,advanced:0};
  const actor={...serviceIdentity,policyHash,policyVersion:config.profile.version};
  const summary={state:config.mode,visited:0,advanced:0,busy:0,review:0,errors:0};
  for await(const candidate of repository.automationCandidates({notBeforeUtc:config.notBeforeUtc,limit,nowUtc:now()})){
   summary.visited++;
   if(!['pending_review','issued'].includes(candidate.status))continue;
   const existing=await jobs.get(candidate.id);
   if(existing?.stage==='review_required'||candidate.status==='issued'&&!existing)continue;
   if(existing?.nextAttemptUtc&&Date.parse(existing.nextAttemptUtc)>Date.parse(now()))continue;
   let lease;
   try{lease=await jobs.acquire({requestId:candidate.id,owner,requestHash:candidate.hash,policyHash,seed:{stage:'new',createdAtUtc:now(),attempts:0,...(candidate.input?.issuanceWindow?{issuanceWindow:candidate.input.issuanceWindow}:{})}});}catch(e){
    if(e.message==='ATP_AUTOMATION_POLICY_CHANGED_REVIEW'){await repository.markAutomationReview({requestId:candidate.id,requestHash:candidate.hash,reason:e.message,policyHash,at:now()});summary.review++;}
    else{await repository.deferAutomation(candidate.id,new Date(Date.parse(now())+60000).toISOString());summary.errors++;}
    continue;
   }
   if(!lease){summary.busy++;continue;}
   try{
    const fresh=await repository.getRequest(candidate.id);
    if(fresh.reviewStatus!=='none'||fresh.executionControl&&fresh.executionControl.mode!=='automatic'){
     lease=await jobs.save(lease,{stage:'review_required',reason:fresh.reviewStatus,nextAttemptUtc:null});summary.review++;continue;
    }
    if(lease.stage==='review_required')continue;
    const guarded={kind:executor.kind,execute:async p=>{await jobs.assert(lease);const r=await repository.getRequest(candidate.id);if(r.reviewStatus!=='none'||r.hash!==lease.requestHash||r.executionControl&&r.executionControl.mode!=='automatic')throw Error('ATP_AUTOMATION_REVIEW_OR_SNAPSHOT_CHANGED');return executor.execute({...p,automation:{requestId:r.id,requestHash:r.hash,policyHash,profileVersion:config.profile.version,leaseClaimId:lease.claimId,leaseFence:lease.fence}});},downloadPdf:async e=>{await jobs.assert(lease);return executor.downloadPdf(e);}};
    const workflow=createAtpMunicipalWorkflow({repository,store:works,executor:guarded,paymentGate,paymentPolicyHash:policyHash,requireFreshPayment:config.mode==='production',enabled:true,issuanceEnabled:true,now});
    let stage=lease.stage,workId=lease.workId;
    if(stage==='new'||stage==='waiting'){
     if(Date.parse(fresh.input.paymentVerifiedAtUtc)<Date.parse(config.notBeforeUtc)||fresh.input.paidAtUtc&&Date.parse(fresh.input.paidAtUtc)<Date.parse(config.notBeforeUtc))throw Error('ATP_HISTORICAL_PAYMENT_REVIEW_REQUIRED');
     const window=inspectIssuanceWindow({input:fresh.input,config,nowUtc:now()});
     if(window.state==='waiting'){lease=await jobs.save(lease,{stage:'waiting',issuanceWindow:fresh.input.issuanceWindow,nextAttemptUtc:window.notBeforeUtc});await repository.deferAutomation(candidate.id,window.notBeforeUtc);summary.advanced++;continue;}
     if(lease.emissionDate&&lease.emissionDate!==window.emissionDate)throw Error('ATP_FISCAL_DATE_REVIEW_REQUIRED');
     validateMunicipalRouting(window.emissionDate,config.municipalRouting);
     lease=await jobs.save(lease,{emissionDate:window.emissionDate});
     const w=await workflow.prepare({requestId:fresh.id,profile:config.profile,series:config.series,initialNumber:config.initialNumber,exclusiveSeriesConfirmed:true,emissionDate:window.emissionDate,municipalRouting:config.municipalRouting,actor});workId=w.workId;stage='prepared';
    }else if(stage==='prepared'){
     if(inspectIssuanceWindow({input:fresh.input,config,nowUtc:now()}).state!=='ready')throw Error('ATP_WINDOW_NOT_READY');
     await workflow.test({workId,actor});stage='tested';
    }else if(stage==='tested'){
     if(inspectIssuanceWindow({input:fresh.input,config,nowUtc:now()}).state!=='ready')throw Error('ATP_WINDOW_NOT_READY');
     const result=await workflow.run({workId,actor,approvedHash:(await works.get(workId)).hash,confirmed:true,deferReconcile:true});stage='query_required';void result;
    }else if(stage==='query_required'||stage==='pdf_pending'||stage==='complete'){
     const r=await workflow.recover({workId,actor});
     if(r.state==='cancelled'||r.state==='fiscal_review_required'){stage='review_required';summary.review++;}
     else if(r.state!=='authorized')throw Error('ATP_QUERY_NOT_CONFIRMED');
     else{await jobs.assert(lease);await workflow.project({workId,actor,confirmed:true});stage=r.documents.pdf?'complete':'pdf_pending';}
    }
    lease=await jobs.save(lease,{stage,workId,attempts:0,lastError:null,nextAttemptUtc:new Date(Date.parse(now())+(stage==='complete'?(config.recheckMs??300000):stage==='pdf_pending'?(config.pdfRetryMs??60000):0)).toISOString()});
    await repository.deferAutomation(candidate.id,lease.nextAttemptUtc);summary.advanced++;
   }catch(e){
    if(e.message==='ATP_AUTOMATION_LEASE_LOST'){summary.busy++;continue;}
    const exhausted=candidate.status!=='issued'&&(lease.attempts||0)>=7;
    const review=exhausted||/REVIEW_REQUIRED|FIELD_TOO_LONG|PROFILE_REQUIRED|PREPARATION_CHANGED|POLICY_CHANGED|SNAPSHOT_CHANGED/.test(e.message),reason=exhausted?'ATP_QUERY_UNCONFIRMED_REVIEW_REQUIRED':e.message;
    try{lease=await jobs.save(lease,{...(review?{stage:'review_required'}:{}),attempts:(lease.attempts||0)+1,lastError:review?reason:'ATP_TRANSIENT_FAILURE',nextAttemptUtc:new Date(Date.parse(now())+Math.min(3600000,30000*2**Math.min(6,lease.attempts||0))).toISOString()});if(review)await repository.markAutomationReview({requestId:candidate.id,requestHash:candidate.hash,reason,policyHash,at:now()});else await repository.deferAutomation(candidate.id,lease.nextAttemptUtc);}catch{}
    if(review)summary.review++;else summary.errors++;
   }finally{try{await jobs.release(lease);}catch{}}
  }return summary;
 }};
}
