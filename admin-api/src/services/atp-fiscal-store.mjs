import {TableClient} from '@azure/data-tables';
import {DefaultAzureCredential} from '@azure/identity';
import {BlobServiceClient} from '@azure/storage-blob';
import {digest} from './atp-fiscal-v1.mjs';

// Uma transação Table cria documento e índice na mesma partição: ambos ou nenhum.
const partitionKey='integracao-fiscal-atp-v1';
export function createAtpFiscalStore(account){
 if(!/^[a-z0-9]{3,24}$/.test(account||''))throw Error('Storage não configurado.');
 const credential=new DefaultAzureCredential(),table=new TableClient(`https://${account}.table.core.windows.net`,'AdminDocumentos',credential);
 return createAtpFiscalRepository({table,blobs:new BlobServiceClient(`https://${account}.blob.core.windows.net`,credential)});
}
// Uso explícito de teste; não é selecionado por variáveis de produção.
export function createAtpFiscalEmulatorStore(connectionString){
 if(typeof connectionString!=='string')throw Error('Conexão local obrigatória.');
 const parts=Object.fromEntries(connectionString.split(';').filter(Boolean).map(p=>{const at=p.indexOf('=');return [p.slice(0,at),p.slice(at+1)];}));
 if(parts.AccountName!=='devstoreaccount1'||parts.DefaultEndpointsProtocol!=='http')throw Error('Somente conta pública de desenvolvimento local.');
 for(const key of ['TableEndpoint','BlobEndpoint']){
  const url=new URL(parts[key]||'https://invalid');
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.username||url.password||url.search||url.hash)throw Error('Endpoint não é loopback isolado.');
 }
 return createAtpFiscalRepository({table:TableClient.fromConnectionString(connectionString,'AdminDocumentos'),blobs:BlobServiceClient.fromConnectionString(connectionString)});
}
export function createAtpFiscalRepository({table,blobs}){
 const entity=r=>({partitionKey,rowKey:`request-${r.id}`,json:JSON.stringify({...r,etag:undefined})});
 const read=async rowKey=>{try{return await table.getEntity(partitionKey,rowKey);}catch(e){if(e.statusCode===404)return null;throw e;}};
 const get=async id=>{const e=await read(`request-${id}`);return e?{...JSON.parse(e.json),etag:e.etag}:null;};
 return {
  get,
  getRequest:get,
  async getProvenance(workId){const e=await read(`work-${workId}`);return e?{...JSON.parse(e.json),etag:e.etag}:null;},
  async reserveProvenance(p){await table.submitTransaction([
   ['create',{partitionKey,rowKey:`work-${p.workId}`,json:JSON.stringify(p)}],
   ['create',{partitionKey,rowKey:`request-work-${p.requestId}`,workId:p.workId}],
  ]);},
  async getInvoiceClaim(id){const e=await read(`invoice-${id}`);return e?JSON.parse(e.json):null;},
  async saveOfficialDocument(id,format,bytes,sha256){
   if(!/^[a-f0-9]{64}$/.test(id)||!['xml','pdf'].includes(format)||digest(bytes)!==sha256||bytes.length>5_000_000)throw Error('Documento inválido.');
   const path=`integracoes/atp/${id}/${sha256}.${format}`;
   const blob=blobs.getContainerClient('admin-anexos').getBlockBlobClient(path);
   try{await blob.uploadData(bytes,{conditions:{ifNoneMatch:'*'},blobHTTPHeaders:{blobContentType:format==='pdf'?'application/pdf':'application/xml'}});}
   catch(e){if(![409,412].includes(e.statusCode))throw e;const saved=await blob.downloadToBuffer();if(saved.length!==bytes.length||digest(saved)!==sha256)throw Error('Arquivo privado divergente.');}
   return {blob:path,size:bytes.length,sha256};
  },
  async commitLink({request,requestEtag,provenance,claim,audit}){
   if(!requestEtag||!provenance.etag)throw Error('Versões privadas obrigatórias.');
   // Claim, auditoria e estado público são confirmados juntos. Refund concorrente
   // muda ETag e impede aprovação baseada em snapshot anterior.
   await table.submitTransaction([
    ['update',entity(request),'Replace',{etag:requestEtag}],
    ['update',{partitionKey,rowKey:`work-${provenance.workId}`,linkedApprovalHash:claim.approvalHash},'Merge',{etag:provenance.etag}],
    ['create',{partitionKey,rowKey:`invoice-${claim.invoiceIdentity}`,json:JSON.stringify(claim)}],
    ['create',{partitionKey,rowKey:`audit-${claim.approvalHash}`,json:JSON.stringify(audit)}],
   ]);
  },
  async attachVerifiedMunicipalPdf({requestId,workId,invoiceIdentity,xmlHash,pdf,actor,at}){
   if(actor?.role!=='administrador'||!actor.id||!Buffer.isBuffer(pdf))throw Error('Aprovação interna obrigatória.');
   const request=await get(requestId),provenance=await read(`work-${workId}`),claim=await read(`invoice-${invoiceIdentity}`);
   const p=provenance&&JSON.parse(provenance.json),c=claim&&JSON.parse(claim.json),hash=digest(pdf);
   if(!request||request.source!=='ATP'||request.status!=='issued'||request.reviewStatus!=='none'||request.invoice?.provider!=='municipal_sp'||request.documents?.xml?.sha256!==xmlHash||p?.requestId!==requestId||p.source!=='ATP'||c?.requestId!==requestId||c.approvalHash!==request.linkApprovalHash||provenance.linkedApprovalHash!==request.linkApprovalHash)throw Error('Associação municipal divergente.');
   if(request.documents.pdf){if(request.documents.pdf.sha256!==hash)throw Error('PDF já anexado com conteúdo diferente.');return request;}
   const file=await this.saveOfficialDocument(requestId,'pdf',pdf,hash),auditHash=digest(JSON.stringify(['atp-municipal-pdf',requestId,workId,xmlHash,hash]));
   const updated={...request,documents:{...request.documents,pdf:file},updatedAtUtc:at};
   // Preserve the original invoice claim and XML approval. PDF recovery has its own audit.
   try{await table.submitTransaction([
    ['update',entity(updated),'Replace',{etag:request.etag}],
    ['update',{partitionKey,rowKey:`work-${workId}`,pdfAuditHash:auditHash},'Merge',{etag:provenance.etag}],
    ['create',{partitionKey,rowKey:`audit-${auditHash}`,json:JSON.stringify({action:'recover_same_municipal_pdf',actorId:actor.id,at,requestId,workId,invoiceIdentity,xmlHash,pdfHash:hash})}],
   ]);}catch(e){const saved=await get(requestId),audit=await read(`audit-${auditHash}`);if(saved?.documents?.pdf?.sha256===hash&&audit)return saved;throw e;}
   return updated;
  },
  async byReference(ref){const e=await read(`reference-${digest(ref)}`);return e?get(e.requestId):null;},
  async create(r){await table.submitTransaction([['create',entity(r)],['create',{partitionKey,rowKey:`reference-${digest(r.input.externalReference)}`,requestId:r.id}]]);},
  async replace(r,etag){await table.updateEntity(entity(r),'Replace',{etag});},
  async download(r,format){
   // Fase 1 não possui ação pública de vínculo. Um fluxo interno aprovado deverá
   // conferir emitente/tomador/valor, copiar bytes oficiais e guardar SHA-256.
   const d=r.documents?.[format],prefix=`integracoes/atp/${r.id}/`;
   if(!r.invoice||r.invoice.issuerDocument!=='57767099000179'||!d||typeof d.blob!=='string'||!d.blob.startsWith(prefix)||d.blob.includes('..')||!/^[a-f0-9]{64}$/.test(d.sha256)||!Number.isSafeInteger(d.size)||d.size<1||d.size>5_000_000)throw Error('Documento não conferido.');
   const blob=blobs.getContainerClient('admin-anexos').getBlobClient(d.blob);
   const stream=await blob.download(),chunks=[];let size=0;
   if(stream.contentLength!==d.size||!stream.readableStreamBody)throw Error('Tamanho divergente.');
   for await(const chunk of stream.readableStreamBody){size+=chunk.length;if(size>d.size){stream.readableStreamBody.destroy();throw Error('Limite excedido.');}chunks.push(chunk);}
   const bytes=Buffer.concat(chunks);
   if(size!==d.size||digest(bytes)!==d.sha256||(format==='pdf'&&bytes.subarray(0,5).toString()!=='%PDF-'))throw Error('Documento divergente.');
   return bytes;
  }
 };
}
