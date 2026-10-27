import {TableClient} from '@azure/data-tables';
import {DefaultAzureCredential} from '@azure/identity';
import {BlobServiceClient} from '@azure/storage-blob';
import {digest} from './atp-fiscal-v1.mjs';

// Uma transação Table cria documento e índice na mesma partição: ambos ou nenhum.
const partitionKey='integracao-fiscal-atp-v1';
export function createAtpFiscalStore(account){
 if(!/^[a-z0-9]{3,24}$/.test(account||''))throw Error('Storage não configurado.');
 const credential=new DefaultAzureCredential(),table=new TableClient(`https://${account}.table.core.windows.net`,'AdminDocumentos',credential);
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
   const blob=new BlobServiceClient(`https://${account}.blob.core.windows.net`,credential).getContainerClient('admin-anexos').getBlockBlobClient(path);
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
  async byReference(ref){const e=await read(`reference-${digest(ref)}`);return e?get(e.requestId):null;},
  async create(r){await table.submitTransaction([['create',entity(r)],['create',{partitionKey,rowKey:`reference-${digest(r.input.externalReference)}`,requestId:r.id}]]);},
  async replace(r,etag){await table.updateEntity(entity(r),'Replace',{etag});},
  async download(r,format){
   // Fase 1 não possui ação pública de vínculo. Um fluxo interno aprovado deverá
   // conferir emitente/tomador/valor, copiar bytes oficiais e guardar SHA-256.
   const d=r.documents?.[format],prefix=`integracoes/atp/${r.id}/`;
   if(!r.invoice||r.invoice.issuerDocument!=='57767099000179'||!d||typeof d.blob!=='string'||!d.blob.startsWith(prefix)||d.blob.includes('..')||!/^[a-f0-9]{64}$/.test(d.sha256)||!Number.isSafeInteger(d.size)||d.size<1||d.size>5_000_000)throw Error('Documento não conferido.');
   const blob=new BlobServiceClient(`https://${account}.blob.core.windows.net`,credential).getContainerClient('admin-anexos').getBlobClient(d.blob);
   const stream=await blob.download(),chunks=[];let size=0;
   if(stream.contentLength!==d.size||!stream.readableStreamBody)throw Error('Tamanho divergente.');
   for await(const chunk of stream.readableStreamBody){size+=chunk.length;if(size>d.size){stream.readableStreamBody.destroy();throw Error('Limite excedido.');}chunks.push(chunk);}
   const bytes=Buffer.concat(chunks);
   if(size!==d.size||digest(bytes)!==d.sha256||(format==='pdf'&&bytes.subarray(0,5).toString()!=='%PDF-'))throw Error('Documento divergente.');
   return bytes;
  }
 };
}
