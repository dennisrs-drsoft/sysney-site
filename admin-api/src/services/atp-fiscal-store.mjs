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
