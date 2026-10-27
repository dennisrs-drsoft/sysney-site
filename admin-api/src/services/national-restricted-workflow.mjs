import {digest,validatePreparation} from './atp-fiscal-v1.mjs';
import {buildRestrictedDps} from './national-restricted-profile.mjs';
import {createSupervisedAtpLink} from './atp-fiscal-link.mjs';

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
   const work={workId,requestId,idDps:draft.idDps,profileHash,snapshotHash:provenance.snapshotHash,draftHash:digest(draft.xml),signedHash:digest(signedXml),signedXml,synthetic,environment:'homologacao',state:'prepared',createdAtUtc:now()};
   // Insert-only durable store. A concurrent conflict requires a read, not a send.
   try{await works.create(work);return work;}catch(e){const current=await works.get(workId);if(current?.draftHash!==work.draftHash||current.signedHash!==work.signedHash)throw e;return current;}
  },
  async run({workId,actor,approvedHash,explicitRestrictedApproval=false}){
   guard(actor);const work=await works.get(workId);
   if(!work||work.environment!=='homologacao'||work.signedHash!==approvedHash||digest(work.signedXml)!==approvedHash||!explicitRestrictedApproval)throw Error('RESTRICTED_APPROVAL_REQUIRED');
   await eligible(work.requestId);
   const p=await repository.getProvenance(workId);
   if(p?.requestId!==work.requestId||p.snapshotHash!==work.snapshotHash)throw Error('PROVENANCE_MISMATCH');
   // submit's durable DPS ledger makes every replay GET-only, including timeout.
   const result=await client.submit({idDps:work.idDps,signedXml:work.signedXml,explicitRestrictedApproval:true});
   if(result.status!=='confirmed_restricted'){await works.saveResult(workId,{state:'uncertain',at:now()});return {state:'uncertain',workId};}
   const xml=result.xml;
   if(!Buffer.isBuffer(xml)||xml.length<20)throw Error('OFFICIAL_XML_MISSING');
   let pdf;try{pdf=await client.downloadPdf(result.chaveAcesso);}catch{/* Recovery retries GET only. */}
   await works.saveResult(workId,{state:'confirmed_restricted',authorityStatus:'unknown',key:result.chaveAcesso,xml,pdf,at:now()});
   return {state:'confirmed_restricted',authorityStatus:'unknown',requiresReview:true,workId,documents:{xml:true,pdf:!!pdf},productionIssued:false};
  },
 };
}
