import {digest,FiscalError} from './atp-fiscal-v1.mjs';

// Dispatch and manual takeover compete on the SAME request ETag/partition.
// A durable dispatch intent is deliberately uncertain even if the queue timed out.
export function createAtpExecutionControl({table,getRequest,requestEntity,partitionKey}){
 const read=async(part,row)=>{try{return await table.getEntity(part,row);}catch(e){if(e.statusCode===404)return null;throw e;}};
 const commit=async(r,updated,action)=>{
  const auditHash=digest(JSON.stringify([action,r.id,updated.executionControl]));
  try{await table.submitTransaction([
   ['update',requestEntity(updated),'Replace',{etag:r.etag}],
   ['create',{partitionKey,rowKey:'audit-'+auditHash,json:JSON.stringify({action,requestId:r.id,control:updated.executionControl,at:updated.updatedAtUtc})}],
  ]);}catch(e){const saved=await getRequest(r.id);if(JSON.stringify(saved?.executionControl)===JSON.stringify(updated.executionControl))return saved;throw e;}
  return getRequest(r.id);
 };
 const get=async id=>{const r=await getRequest(id);if(!r||r.source!=='ATP')throw new FiscalError(404,'NOT_FOUND','Solicitação não encontrada.');return r;};
 const legacySend=async id=>{const p=await read(partitionKey,'request-work-'+id);return p?.workId?read('atp-municipal-v1','send-'+p.workId):null;};
 const manualProjection=r=>({claimId:r.executionControl.claimId,externalReference:r.input.externalReference,acknowledged:true,automationPaused:true,requestHash:r.hash,acknowledgedAtUtc:r.executionControl.acknowledgedAtUtc,controlFence:r.executionControl.controlFence,protocolVersion:'1'});
 return {
  async claimManual({requestId,claimId,externalReference,reason,at}){
   const inputHash=digest(JSON.stringify([claimId,externalReference,reason]));
   for(let attempt=0;attempt<5;attempt++){
    const r=await get(requestId),c=r.executionControl;
    if(r.input.externalReference!==externalReference)throw new FiscalError(409,'IDEMPOTENCY_CONFLICT','Referência divergente.');
    const unsafe=r.status!=='pending_review'||!!r.invoice||r.reviewStatus==='refund_review_required'||!!c?.dispatch||!!await legacySend(requestId);
    if(c?.mode==='manual'&&!unsafe){
     if(c.inputHash!==inputHash)throw new FiscalError(409,'MANUAL_CLAIM_CONFLICT','Esta solicitação já foi assumida por outra operação manual.');
     return {request:r,manualControl:manualProjection(r),replayed:true};
    }
    if(unsafe||c?.mode==='review'){
     if(r.status==='issued'||c?.mode==='review'||r.reviewStatus==='refund_review_required')throw new FiscalError(409,'MANUAL_RECONCILIATION_REQUIRED','Não emita outra nota. Há documento ou tentativa que precisa ser consultada e revisada.');
     const updated={...r,executionControl:{...c,mode:'review',controlFence:(c?.controlFence||0)+1,claimId,inputHash,acknowledged:false,reason:'manual_takeover_after_dispatch'},reviewStatus:'fiscal_review_required',automationDueUtc:'9999-12-31T23:59:59.999Z',updatedAtUtc:at};
     try{await commit(r,updated,'manual_takeover_blocked');}catch(e){if([409,412].includes(e.statusCode))continue;throw e;}
     throw new FiscalError(409,'MANUAL_RECONCILIATION_REQUIRED','Não emita outra nota. A tentativa anterior deve ser consultada e revisada.');
    }
    const updated={...r,executionControl:{mode:'manual',claimId,inputHash,reason,controlFence:(c?.controlFence||0)+1,acknowledged:true,acknowledgedAtUtc:at},automationDueUtc:'9999-12-31T23:59:59.999Z',updatedAtUtc:at};
    try{const saved=await commit(r,updated,'manual_takeover_acknowledged');return {request:saved,manualControl:manualProjection(saved),replayed:false};}catch(e){if(![409,412].includes(e.statusCode))throw e;}
   }
   throw new FiscalError(503,'MANUAL_CONTROL_BUSY','Consulte e repita a mesma operação; emissão manual ainda não autorizada.',true);
  },
  async reserveMunicipalDispatch({requestId,requestHash,workId,xmlHash,actor,at}){
   if(actor?.role!=='administrador'||!actor.id||![requestId,requestHash,workId,xmlHash].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)))throw Error('ATP_DISPATCH_BINDING_REQUIRED');
   for(let attempt=0;attempt<5;attempt++){
    const r=await get(requestId),c=r.executionControl;
    if(r.hash!==requestHash||r.status!=='pending_review'||r.reviewStatus!=='none'||c&&c.mode!=='automatic')throw Error('ATP_MANUAL_OR_FISCAL_CONTROL_REVIEW_REQUIRED');
    if(c?.dispatch){if(c.dispatch.workId!==workId||c.dispatch.xmlHash!==xmlHash)throw Error('ATP_DISPATCH_BINDING_REQUIRED');return {...c.dispatch,controlFence:c.controlFence};}
    const provenance=await read(partitionKey,'request-work-'+requestId);
    if(provenance?.workId!==workId||await legacySend(requestId))throw Error('ATP_DISPATCH_PROVENANCE_REVIEW_REQUIRED');
    const dispatch={reservationId:digest(JSON.stringify(['atp-dispatch-v1',requestId,requestHash,workId,xmlHash])),workId,xmlHash,at};
    const updated={...r,executionControl:{mode:'automatic',controlFence:(c?.controlFence||0)+1,dispatch},updatedAtUtc:at};
    try{const saved=await commit(r,updated,'municipal_dispatch_reserved');return {...saved.executionControl.dispatch,controlFence:saved.executionControl.controlFence};}catch(e){if(![409,412].includes(e.statusCode))throw e;}
   }
   throw Error('ATP_DISPATCH_BUSY');
  },
 };
}
