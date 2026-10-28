import {digest,validatePreparation} from './atp-fiscal-v1.mjs';
import {buildAtpMunicipal,validateMunicipalRouting} from './atp-municipal-model.mjs';
import {createSupervisedAtpLink} from './atp-fiscal-link.mjs';
import {reconcileAtpMunicipal,validateAtpMunicipalPdf} from './atp-municipal-evidence.mjs';
export function saoPauloFiscalDate(instant){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${values.year}-${values.month}-${values.day}`;
}
// Internal on-demand orchestration; no public route, timer or automatic activation.
export function createAtpMunicipalWorkflow({repository,store,executor,paymentGate,paymentPolicyHash,requireFreshPayment=false,enabled=false,issuanceEnabled=false,now=()=>new Date().toISOString()}){
 const guard=actor=>{if(enabled!==true||actor?.role!=='administrador'||!actor.id)throw Error('ATP_MUNICIPAL_DISABLED');};
 const eligible=async(id,allowIssued=false)=>{const r=await repository.getRequest(id);if(!r||r.source!=='ATP'||!(r.status==='pending_review'||allowIssued&&r.status==='issued')||r.reviewStatus!=='none'||r.hash!==digest(JSON.stringify(validatePreparation(r.input))))throw Error('ATP_REQUEST_NOT_ELIGIBLE');return r;};
 const evidence=work=>work?.result?.evidence?{...work.result.evidence,xml:Buffer.from(work.result.xmlBase64,'base64'),...(work.result.pdfBase64?{pdf:Buffer.from(work.result.pdfBase64,'base64')}: {})}:null;
 const linker=createSupervisedAtpLink({repository,enabled:true,now,readAuthorizedEvidence:async id=>evidence(await store.get(id))});
 async function load(workId,allowIssued=false){const w=await store.get(workId);if(!w||w.hash!==digest(w.xml)||w.testHash!==digest(w.testXml))throw Error('ATP_WORK_HASH_MISMATCH');const r=await eligible(w.requestId,allowIssued),p=await repository.getProvenance(workId);if(w.requestHash!==r.hash||p?.snapshotHash!==w.snapshotHash||p.requestId!==r.id)throw Error('ATP_PROVENANCE_MISMATCH');return {w,r,p};}
 async function reconcile(workId,actor){
  const {w,r,p}=await load(workId,true);
  // Always a query by the immutable RPS key. Never trust the send acknowledgement.
  const response=await executor.execute({action:'consultar',xml:w.queryXml,chain:'',workId,approvedHash:w.hash});
  let e;
  try{e=reconcileAtpMunicipal({xml:response.xml,work:w,request:r,provenance:p,receivedAtUtc:now(),allowCancelled:true});}catch{
   await store.save({...w,state:'reconciliation_required',reconciliationReason:'ATP_MUNICIPAL_EVIDENCE_MISMATCH',updatedAtUtc:now()});
   return {workId,state:'reconciliation_required',issued:false};
  }
  const originalAuthorityKey=w.result?.evidence?.authorityKey;
  if(e.status==='cancelled'||originalAuthorityKey&&originalAuthorityKey!==e.authorityKey){
   await repository.markMunicipalFiscalReview({requestId:r.id,workId,evidence:e,originalAuthorityKey,actor,at:now()});
   await store.save({...w,state:e.status==='cancelled'?'cancelled':'fiscal_review_required',fiscalReviewEvidence:{reason:e.status==='cancelled'?'official_cancellation':'official_identity_changed',authorityKey:e.authorityKey,cancelledAtUtc:e.cancelledAtUtc,xmlBase64:response.xml.toString('base64'),sha256:digest(response.xml)},updatedAtUtc:now()});
   return {workId,state:e.status==='cancelled'?'cancelled':'fiscal_review_required',reviewRequired:true,documents:{xml:false,pdf:false}};
  }
  let pdf,pdfReason;
  if(r.status==='issued'&&r.documents?.pdf){
   if(w.result?.pdfBase64){pdf=Buffer.from(w.result.pdfBase64,'base64');if(digest(pdf)!==r.documents.pdf.sha256)throw Error('ATP_STORED_PDF_HASH_MISMATCH');}
  }else try{pdf=await executor.downloadPdf(e);await validateAtpMunicipalPdf(pdf,e);}catch{pdf=undefined;pdfReason='PDF_PENDING_REVIEW_OR_DOWNLOAD';}
  let {xml,...metadata}=e;
  // A later official query may serialize the same invoice differently. Keep
  // the immutable bytes already linked publicly; late PDF is not a new XML.
  if(r.status==='issued'){
   const originalXml=Buffer.from(w.result?.xmlBase64||'','base64');
   if(!originalXml.length||digest(originalXml)!==r.documents?.xml?.sha256||w.result?.evidence?.authorityKey!==e.authorityKey)throw Error('ATP_ORIGINAL_XML_BINDING_REQUIRED');
   xml=originalXml;metadata={...w.result.evidence,authorizedXmlHash:digest(originalXml)};
  }
  await store.save({...w,state:'authorized',result:{evidence:{...metadata,...(pdf?{officialPdfHash:digest(pdf)}:{})},xmlBase64:xml.toString('base64'),...(pdf?{pdfBase64:pdf.toString('base64')}:{pdfReason})},updatedAtUtc:now()});
  if(r.status==='issued'&&pdf&&!r.documents?.pdf)await repository.attachVerifiedMunicipalPdf({requestId:r.id,workId,invoiceIdentity:digest(JSON.stringify(['municipal_sp',e.issuerDocument,e.authorityKey])),xmlHash:digest(xml),pdf,actor,at:now()});
  return {workId,state:'authorized',number:e.number,documents:{xml:true,pdf:!!pdf||!!r.documents?.pdf},projected:r.status==='issued'};
 }
 return {
  async prepare({requestId,profile,series,initialNumber,exclusiveSeriesConfirmed,emissionDate,municipalRouting,actor}){
   guard(actor);const r=await eligible(requestId);
   buildAtpMunicipal({input:r.input,profile,series,number:'1',emissionDate,municipalRouting});
   if(requireFreshPayment&&!paymentGate)throw Error('ATP_PAYMENT_GATE_REQUIRED_REVIEW_REQUIRED');
   if(paymentGate)await paymentGate.authorize({phase:'prepare',request:r,policyHash:paymentPolicyHash});
   const preparationHash=digest(JSON.stringify({requestHash:r.hash,profile,series,emissionDate,...(municipalRouting?{municipalRouting}:{})}));
   const a=await store.reserve({requestId,series,initialNumber,exclusiveSeriesConfirmed,emissionDate,issuer:profile.issuer,preparationHash});
   const d=buildAtpMunicipal({input:r.input,profile,series,number:a.number,emissionDate:a.emissionDate,municipalRouting});
   const workId=digest(JSON.stringify(['atp-municipal-v1',requestId,series,a.number,d.profileHash]));
   const p=await linker.reserveProvenance({requestId,workId,actor});
   const old=await store.get(workId);if(old){if(old.hash!==d.hash)throw Error('ATP_PREPARATION_CHANGED');return old;}
   const w={...d,input:undefined,source:'ATP',workId,requestId,requestHash:r.hash,snapshotHash:p.snapshotHash,testHash:digest(d.testXml),state:'prepared',createdAtUtc:now()};
   try{await store.create(w);}catch(e){const saved=await store.get(workId);if(saved?.hash!==w.hash)throw e;return saved;}return w;
  },
  async test({workId,actor}){
   guard(actor);const {w}=await load(workId);
   const age=Date.parse(now())-Date.parse(w.testedAtUtc);
   if(w.testedHash===w.hash&&Number.isFinite(age)&&age>=0&&age<1800000)return {workId,tested:true,issued:false,replayed:true};
   const result=await executor.execute({action:'testar',xml:w.testXml,chain:w.chain,workId,approvedHash:w.testHash});
   if(result.success!==true)throw Error('ATP_MUNICIPAL_TEST_REJECTED');
   await store.save({...w,testedHash:w.hash,testedAtUtc:now()});return {workId,tested:true,issued:false};
  },
  async run({workId,actor,approvedHash,confirmed=false,deferReconcile=false}){
   guard(actor);if(issuanceEnabled!==true||confirmed!==true)throw Error('ATP_MUNICIPAL_ISSUANCE_DISABLED');
   const {w,r}=await load(workId);
   if(await store.hasClaim?.(workId,w.hash))return deferReconcile?{workId,state:'query_required',issued:false,queryRequired:true}:reconcile(workId,actor);
   const age=Date.parse(now())-Date.parse(w.testedAtUtc);
   const civilDate=saoPauloFiscalDate(now());
   validateMunicipalRouting(civilDate,w.municipalRouting);
   if(w.hash!==approvedHash||w.testedHash!==w.hash||!Number.isFinite(age)||age<0||age>1800000||civilDate!==w.emissionDate)throw Error('ATP_MUNICIPAL_APPROVAL_REQUIRED');
   if(requireFreshPayment&&!paymentGate)throw Error('ATP_PAYMENT_GATE_REQUIRED_REVIEW_REQUIRED');
   const expectedDispatch={workId,xmlHash:w.hash,dispatchReservationId:digest(JSON.stringify(['atp-dispatch-v1',w.requestId,w.requestHash,workId,w.hash])),controlFence:r.executionControl?.controlFence||1};
   const paymentPermit=paymentGate?await paymentGate.authorize({phase:'dispatch',request:r,policyHash:paymentPolicyHash,dispatch:expectedDispatch}):undefined;
   // This same-row CAS is the handover boundary: no manual ACK can follow it.
   if(actor.kind==='automation'&&!repository.reserveMunicipalDispatch)throw Error('ATP_DISPATCH_CONTROL_REQUIRED');
   const dispatch=await repository.reserveMunicipalDispatch?.({requestId:w.requestId,requestHash:w.requestHash,workId,xmlHash:w.hash,actor,at:now()});
   if(paymentPermit&&(dispatch?.reservationId!==paymentPermit.dispatchReservationId||dispatch?.controlFence!==paymentPermit.controlFence))throw Error('ATP_PAYMENT_GATE_BINDING_REVIEW_REQUIRED');
   // A timeout after the atomic insert is deliberately GET/query-only forever.
   const first=await store.claim(workId,w.hash);
   if(first){
    try{await executor.execute({action:'emitir',xml:w.xml,chain:w.chain,workId,approvedHash:w.hash,confirmed:true,...(dispatch?{dispatch}:{}),...(paymentPermit?{paymentPermit}:{})});}
    catch{return {workId,state:'uncertain',issued:false,queryRequired:true};}
   }
   return deferReconcile?{workId,state:'query_required',issued:false,queryRequired:true}:reconcile(workId,actor);
  },
  async recover({workId,actor}){guard(actor);return reconcile(workId,actor);},
  async project({workId,actor,confirmed=false}){
   guard(actor);const {w,r}=await load(workId,true);if(w.state!=='authorized'||!confirmed)throw Error('ATP_AUTHORIZED_EVIDENCE_REQUIRED');
   if(r.status==='issued'){
    const e=evidence(w),identity=digest(JSON.stringify(['municipal_sp',e.issuerDocument,e.authorityKey])),claim=await repository.getInvoiceClaim(identity);
    if(claim?.requestId!==r.id||claim.approvalHash!==r.linkApprovalHash||r.documents?.xml?.sha256!==e.authorizedXmlHash||r.invoice?.number!==e.number)throw Error('ATP_LINK_REPLAY_MISMATCH');return r;
   }
   return linker.approveLink({requestId:w.requestId,workId,expectedSnapshotHash:w.snapshotHash,actor,confirmed});
  },
 };
}
