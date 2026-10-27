import {digest} from './atp-fiscal-v1.mjs';
// QA-only document storage using the VM's existing FiscalFila table permission.
// No Blob grant, account key or public document route. Never used by production.
// Table strings count UTF-16 bytes; 20KB binary => 26.7K base64 chars <32K chars.
const partitionKey='qa-national-work-bytes-v1',chunkSize=20000;
const valid=id=>{if(!/^[a-f0-9]{64}$/.test(id))throw Error('INVALID_QA_WORK');};
export function createRestrictedQaTableWorkStore(table){
 const row=async key=>{try{return await table.getEntity(partitionKey,key);}catch(e){if(e.statusCode===404)return null;throw e;}};
 const key=(id,d,i)=>`bytes-${id}-${d.kind}-${d.hash}-${i}`;
 async function save(id,bytes,kind){
  valid(id);if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>5_000_000)throw Error('INVALID_QA_BYTES');
  const d={hash:digest(bytes),size:bytes.length,chunks:Math.ceil(bytes.length/chunkSize),kind};
  for(let i=0;i<d.chunks;i++){
   const data=bytes.subarray(i*chunkSize,(i+1)*chunkSize).toString('base64'),rowKey=key(id,d,i);
   try{await table.createEntity({partitionKey,rowKey,data});}catch(e){const old=await row(rowKey);if(old?.data!==data)throw e;}
  }
  return d;
 }
 async function load(id,d){
  if(!d||!/^[a-f0-9]{64}$/.test(d.hash)||!['dps','xml','pdf'].includes(d.kind)||!Number.isSafeInteger(d.size)||d.size<1||d.size>5_000_000||d.chunks!==Math.ceil(d.size/chunkSize))throw Error('INVALID_QA_DOCUMENT');
  const chunks=[];for(let i=0;i<d.chunks;i++){const r=await row(key(id,d,i));if(!r||typeof r.data!=='string'||r.data.length>28000)throw Error('QA_DOCUMENT_MISSING');chunks.push(Buffer.from(r.data,'base64'));}
  const bytes=Buffer.concat(chunks);if(bytes.length!==d.size||digest(bytes)!==d.hash)throw Error('QA_DOCUMENT_CHANGED');return bytes;
 }
 return {
  async get(id){valid(id);const r=await row('work-'+id);if(!r)return null;const w=JSON.parse(r.json);return {...w,signedXml:await load(id,w.dps)};},
  async create(w){valid(w.workId);const dps=await save(w.workId,w.signedXml,'dps');await table.createEntity({partitionKey,rowKey:'work-'+w.workId,json:JSON.stringify({...w,signedXml:undefined,dps})});},
  async saveResult(id,r){valid(id);const e=await row('work-'+id);if(!e)throw Error('QA_WORK_MISSING');const w=JSON.parse(e.json),result={...r,xml:r.xml?await save(id,r.xml,'xml'):undefined,pdf:r.pdf?await save(id,r.pdf,'pdf'):undefined};await table.updateEntity({partitionKey,rowKey:e.rowKey,json:JSON.stringify({...w,result})},'Replace',{etag:e.etag});},
 };
}
