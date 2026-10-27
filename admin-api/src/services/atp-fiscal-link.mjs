import {digest} from './atp-fiscal-v1.mjs';

// Núcleo interno, NÃO exposto na fachada Bearer ATP. O adaptador de evidência
// deve ler trabalho/retorno oficial privado; nunca receber XML, URL ou blob da UI.
const fail=message=>{throw Error(message);};
const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const snapshot=r=>digest(JSON.stringify({requestHash:r.hash,paymentId:r.input.paymentId,externalReference:r.input.externalReference,document:r.input.recipient.document,amount:r.input.amountCentsBRL,competence:r.input.competence,period:r.input.servicePeriod,description:r.input.description}));
function admin(actor){if(!actor||actor.role!=='administrador'||!actor.id||actor.id.length>254)fail('Aprovação administrativa interna obrigatória.');}
export function createSupervisedAtpLink({repository,readAuthorizedEvidence,enabled=false,now=()=>new Date().toISOString()}){
 const gate=actor=>{if(enabled!==true)fail('Vínculo supervisionado desabilitado.');admin(actor);};
 return {
  async reserveProvenance({requestId,workId,actor}){
   gate(actor);if(!/^[a-f0-9]{64}$/.test(workId))fail('Trabalho inválido.');
   const r=await repository.getRequest(requestId);
   if(!r||r.source!=='ATP'||r.status!=='pending_review'||r.reviewStatus!=='none')fail('Solicitação não elegível.');
   const p={source:'ATP',requestId:r.id,paymentId:r.input.paymentId,externalReference:r.input.externalReference,snapshotHash:snapshot(r),workId,createdAtUtc:now(),actorId:actor.id};
   // Insert transacional de work + índice de request: uma preparação não pode
   // trocar de trabalho e o mesmo trabalho não pode servir a outro pagamento.
   const old=await repository.getProvenance(workId);
   if(old){if(old.requestId!==r.id||old.snapshotHash!==p.snapshotHash)fail('Proveniência conflitante.');return old;}
   await repository.reserveProvenance(p);
   return p;
  },
  async approveLink({requestId,workId,expectedSnapshotHash,actor,confirmed}){
   gate(actor);if(confirmed!==true)fail('Confirmação explícita obrigatória.');
   const r=await repository.getRequest(requestId),p=await repository.getProvenance(workId);
   if(!r||r.source!=='ATP'||!p||p.requestId!==r.id||p.source!=='ATP'||p.snapshotHash!==snapshot(r)||expectedSnapshotHash!==p.snapshotHash||r.reviewStatus!=='none')fail('Proveniência ou versão divergente.');
   // Leitura interna segregada, não um payload de evidência fornecido pelo ATP.
   const e=await readAuthorizedEvidence(workId),i=r.input;
   if(!e||e.workId!==workId||e.source!=='ATP'||e.requestId!==requestId||e.status!=='issued'||e.test!==false||e.issuerDocument!=='57767099000179'||e.recipientDocument!==i.recipient.document||e.amountCentsBRL!==i.amountCentsBRL||e.competence!==i.competence||e.description!==i.description||e.servicePeriod?.startDate!==i.servicePeriod.startDate||e.servicePeriod?.endDate!==i.servicePeriod.endDate||!iso(e.authorizedAtUtc)||Date.parse(e.authorizedAtUtc)<Date.parse(p.createdAtUtc)||!['municipal_sp','national'].includes(e.provider)||!e.number||!e.authorizedXmlVerified)fail('Trabalho e retorno oficial não comprovam a associação ATP.');
   if(!Buffer.isBuffer(e.xml)||e.xml.length<20||e.xml.length>5_000_000||!/^<\?xml|^</.test(e.xml.toString('utf8').trim())||digest(e.xml)!==e.authorizedXmlHash)fail('XML autorizado divergente.');
   if(e.pdf&&(!Buffer.isBuffer(e.pdf)||e.pdf.length>5_000_000||!e.pdf.subarray(0,5).equals(Buffer.from('%PDF-'))||!e.pdf.subarray(-1024).includes(Buffer.from('%%EOF'))||digest(e.pdf)!==e.officialPdfHash))fail('PDF oficial divergente.');
   const invoiceIdentity=digest(JSON.stringify([e.provider,e.issuerDocument,e.authorityKey]));
   if(typeof e.authorityKey!=='string'||!e.authorityKey||e.authorityKey.length>160)fail('Identidade oficial ausente.');
   const documentHashes={xml:digest(e.xml),...(e.pdf?{pdf:digest(e.pdf)}:{})};
   const approvalHash=digest(JSON.stringify({requestId,workId,snapshotHash:p.snapshotHash,invoiceIdentity,documentHashes}));
   const existing=await repository.getInvoiceClaim(invoiceIdentity);
   if(existing){
    if(existing.requestId!==requestId||existing.approvalHash!==approvalHash)fail('Nota já reservada ou documentos mudaram.');
    const current=await repository.getRequest(requestId);if(current.status==='issued'&&current.linkApprovalHash===approvalHash)return current;
    fail('Associação incompleta; conciliar sem repetir.');
   }
   if(r.status!=='pending_review')fail('Solicitação já possui operação fiscal.');
   // Arquivos content-addressed, privados e imutáveis. Falha antes da transação
   // pode deixar órfãos recuperáveis, mas nunca estado issued sem XML disponível.
   const documents={xml:await repository.saveOfficialDocument(r.id,'xml',e.xml,documentHashes.xml)};
   if(e.pdf)documents.pdf=await repository.saveOfficialDocument(r.id,'pdf',e.pdf,documentHashes.pdf);
   const at=now(),updated={...r,status:'issued',invoice:{number:e.number,issuerDocument:e.issuerDocument,provider:e.provider},documents,linkApprovalHash:approvalHash,updatedAtUtc:at};
   const audit={actorId:actor.id,at,source:'ATP',requestId,workId,invoiceIdentity,snapshotHash:p.snapshotHash,approvalHash,documentHashes,action:'supervised_link_existing_invoice'};
   try{await repository.commitLink({request:updated,requestEtag:r.etag,provenance:p,claim:{invoiceIdentity,requestId,approvalHash},audit});}
   catch(error){
    // Timeout após commit: só retornar o resultado comprovadamente persistido.
    const claim=await repository.getInvoiceClaim(invoiceIdentity),current=await repository.getRequest(requestId);
    if(claim?.requestId===requestId&&claim.approvalHash===approvalHash&&current?.linkApprovalHash===approvalHash&&current.status==='issued')return current;
    throw error;
   }
   return updated;
  }
 };
}
