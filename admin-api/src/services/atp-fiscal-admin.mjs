import {digest} from './atp-fiscal-v1.mjs';
import {createSupervisedAtpLink} from './atp-fiscal-link.mjs';
import {lerCorpoLimitado,headersPrivados} from './seguranca-http.mjs';

// Fronteira interna testável, ainda NÃO registrada/publicada. authenticate precisa
// derivar ator da sessão/ponte protegida, nunca do corpo/Bearer ATP.
export function createFiscalAdminBoundary({authenticate,repository,readAuthorizedEvidence,enabled=false}){
 return async req=>{
  const reply=(status,jsonBody)=>({status,headers:headersPrivados,jsonBody});
  try{
   const actor=await authenticate(req);if(actor?.role!=='administrador')return reply(401,{erro:'Não autorizado.'});
   if(enabled!==true)return reply(503,{erro:'Vínculo fiscal ainda não habilitado.'});
   if(req.method!=='POST'||req.headers.get('origin')!==new URL(req.url).origin)return reply(403,{erro:'Origem inválida.'});
   const body=JSON.parse((await lerCorpoLimitado(req,4096)).toString('utf8'));
   if(Object.keys(body).some(k=>!['action','requestId','workId','snapshotHash','previewHash','confirmed'].includes(k))||!/^[a-f0-9]{64}$/.test(body.requestId)||!/^[a-f0-9]{64}$/.test(body.workId))return reply(400,{erro:'Solicitação inválida.'});
   const service=createSupervisedAtpLink({repository,readAuthorizedEvidence,enabled:true});
   if(body.action==='reserve'){
    // Reserva pode anteceder XML autorizado, mas é sempre auditada no registro p.
    return reply(200,{provenance:await service.reserveProvenance({requestId:body.requestId,workId:body.workId,actor})});
   }
   if(!['preview','approve'].includes(body.action))return reply(400,{erro:'Ação inválida.'});
   const r=await repository.getRequest(body.requestId),p=await repository.getProvenance(body.workId),e=await readAuthorizedEvidence(body.workId);
   if(!r||r.source!=='ATP'||p?.requestId!==r.id||e.requestId!==r.id)return reply(409,{erro:'Proveniência divergente.'});
   const preview={requestId:r.id,workId:body.workId,snapshotHash:p.snapshotHash,requestEtag:r.etag,issuerDocument:e.issuerDocument,recipientDocument:e.recipientDocument,amountCentsBRL:e.amountCentsBRL,competence:e.competence,number:e.number,authorityKey:e.authorityKey,xmlHash:digest(e.xml),pdfHash:e.pdf?digest(e.pdf):null};
   const previewHash=digest(JSON.stringify(preview));
   if(body.action==='preview')return reply(200,{preview,previewHash,emissaoReal:false});
   if(body.confirmed!==true||body.previewHash!==previewHash||body.snapshotHash!==p.snapshotHash)return reply(409,{erro:'Prévia mudou. Confira e aprove a versão atual.'});
   // Congelar a mesma evidência conferida no preview desta leitura; o núcleo faz
   // as verificações completas e CAS, sem reler XML diferente durante a aprovação.
   const linking=createSupervisedAtpLink({repository,readAuthorizedEvidence:async()=>e,enabled:true});
   const result=await linking.approveLink({requestId:r.id,workId:body.workId,expectedSnapshotHash:p.snapshotHash,confirmed:true,actor});
   return reply(200,{id:result.id,status:result.status,number:result.invoice.number,emissaoReal:false});
  }catch{return reply(409,{erro:'Vínculo não confirmado. Atualize e consulte antes de repetir.'});}
 };
}
