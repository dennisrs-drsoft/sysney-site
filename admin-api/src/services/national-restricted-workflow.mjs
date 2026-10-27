import {digest,validatePreparation} from './atp-fiscal-v1.mjs';
import {buildRestrictedDps} from './national-restricted-profile.mjs';
import {createSupervisedAtpLink} from './atp-fiscal-link.mjs';
import {reconcileRestrictedAuthorization} from './national-restricted-evidence.mjs';
import {validateRestrictedDanfse} from './national-danfse.mjs';

// Internal restricted-environment runner. It never sets the public ATP request
// to issued: restricted XML/PDF must not be presented as production documents.
export function createNationalRestrictedWorkflow({repository,works,sequence,client,sign,environment,now=()=>new Date().toISOString()}){
 const guard=actor=>{if(environment!=='homologacao'||actor?.role!=='administrador'||!actor.id)throw Error('RESTRICTED_ADMIN_REQUIRED');};
 const eligible=async id=>{const r=await repository.getRequest(id);if(!r||r.source!=='ATP'||r.status!=='pending_review'||r.reviewStatus!=='none')throw Error('REQUEST_NOT_ELIGIBLE');validatePreparation(r.input);return r;};
 return {
  async prepare({requestId,profile,emissionAt,actor,synthetic=false}){
   guard(actor);const r=await eligible(requestId);
   // Validate before allocating. Number1 here is a throwaway preflight, never sent.
   buildRestrictedDps({profile,request:r.input,number:'1',emissionAt,synthetic});
   if(!sequence?.reserve)throw Error('DURABLE_SEQUENCE_REQUIRED');
   const assignment=await sequence.reserve({requestId,series:profile.dps.serie,preparationHash:digest(JSON.stringify({requestHash:r.hash,profile,synthetic})),emissionAt});
   const draft=buildRestrictedDps({profile,request:r.input,number:assignment.number,emissionAt:assignment.emissionAt,synthetic});
   const profileHash=digest(JSON.stringify(profile)),workId=digest(JSON.stringify(['national-restricted-v1',requestId,draft.idDps,profileHash]));
   // Reserve request/work provenance before signing or any provider call.
   const link=createSupervisedAtpLink({repository,enabled:true,now});
   let provenance;
   try{provenance=await link.reserveProvenance({requestId,workId,actor});}catch(e){provenance=await repository.getProvenance(workId);if(provenance?.requestId!==requestId)throw e;}
   const old=await works.get(workId);
   if(old){if(old.draftHash!==digest(draft.xml))throw Error('PREPARATION_CHANGED');return old;}
   const signedXml=await sign(draft.xml);
   if(!Buffer.isBuffer(signedXml)||signedXml.length>1_000_000||!signedXml.toString('utf8').includes(draft.idDps))throw Error('SIGNING_FAILED');
   const work={workId,requestId,requestHash:r.hash,idDps:draft.idDps,profileHash,emissionAt:assignment.emissionAt,serviceCode:profile.service.cTribNac,snapshotHash:provenance.snapshotHash,draftHash:digest(draft.xml),signedHash:digest(signedXml),signedXml,synthetic,environment:'homologacao',state:'prepared',createdAtUtc:now()};
   // Insert-only durable store. A concurrent conflict requires a read, not a send.
   try{await works.create(work);return work;}catch(e){const current=await works.get(workId);if(current?.draftHash!==work.draftHash||current.signedHash!==work.signedHash)throw e;return current;}
  },
  async run({workId,actor,approvedHash,explicitRestrictedApproval=false}){
   guard(actor);const work=await works.get(workId);
   if(!work||work.environment!=='homologacao'||work.signedHash!==approvedHash||digest(work.signedXml)!==approvedHash||!explicitRestrictedApproval)throw Error('RESTRICTED_APPROVAL_REQUIRED');
   const request=await eligible(work.requestId);
   const p=await repository.getProvenance(workId);
   if(p?.requestId!==work.requestId||p.snapshotHash!==work.snapshotHash)throw Error('PROVENANCE_MISMATCH');
   // submit's durable DPS ledger makes every replay GET-only, including timeout.
   const result=await client.submit({idDps:work.idDps,signedXml:work.signedXml,explicitRestrictedApproval:true});
   if(result.status!=='confirmed_restricted'){const state=result.status==='rejected_restricted'?'rejected_restricted':'uncertain';const diagnostics={...(result.providerHttpStatus?{providerHttpStatus:result.providerHttpStatus,providerErrors:result.providerErrors}: {})};await works.saveResult(workId,{state,...diagnostics,at:now()});return {state,workId,...diagnostics,productionIssued:false};}
   let evidence;try{evidence=reconcileRestrictedAuthorization({work,request,provenance:p,result,now:Date.parse(now())});}catch{
    await works.saveResult(workId,{state:'evidence_review_required',reason:'RESTRICTED_XML_BINDING_MISMATCH',key:result.chaveAcesso,unverifiedXmlHash:Buffer.isBuffer(result.xml)?digest(result.xml):null,at:now()});
    return {state:'evidence_review_required',reason:'RESTRICTED_XML_BINDING_MISMATCH',workId,productionIssued:false,requiresReview:true};
   }
   let authority={authorityStatus:'unknown',cancelled:null,substituted:null,requiresReview:true,completeSnapshot:false,reason:'NO_COMPLETE_ADN_STATUS_SNAPSHOT'};
   try{if(typeof client.consultCancellationState==='function')authority=await client.consultCancellationState(result.chaveAcesso);}catch{}
   const xml=result.xml;let pdf,pdfProof,pdfReason;
   try{const bytes=await client.downloadPdf(result.chaveAcesso);pdfProof=await validateRestrictedDanfse(bytes,evidence);pdf=bytes;}catch(e){pdfReason=['INVALID_PDF','INVALID_PDF_STRUCTURE','PDF_ENCODING_REQUIRES_REVIEW','PDF_FONT_REQUIRES_REVIEW','PDF_CONTENT_BINDING_UNVERIFIED','PDF_ACTIVE_CONTENT','PDF_DECODE_LIMIT','PDF_TEXT_LIMIT'].includes(e.code)?e.code:'PDF_UNAVAILABLE';}
   await works.saveResult(workId,{state:'confirmed_restricted',evidence:{...evidence,authorityStatus:authority.authorityStatus,cancelled:authority.cancelled,substituted:authority.substituted},authority,authorityStatus:authority.authorityStatus,key:result.chaveAcesso,xml,pdf,pdfProof,pdfReason,at:now()});
   return {state:'confirmed_restricted',number:evidence.number,authorityStatus:authority.authorityStatus,requiresReview:true,workId,documents:{xml:true,pdf:!!pdf},...(pdfReason?{pdfReason}:{}),productionIssued:false};
  },
 };
}
