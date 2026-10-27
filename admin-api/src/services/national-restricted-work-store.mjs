import {digest} from './atp-fiscal-v1.mjs';
const partitionKey='national-restricted-work-v1';
const valid=id=>{if(!/^[a-f0-9]{64}$/.test(id))throw Error('INVALID_WORK');};
export function createNationalRestrictedWorkStore({table,blobs}){
 const blob=(id,hash,kind)=>blobs.getContainerClient('admin-anexos').getBlockBlobClient(`qa/nacional-restrita/${id}/${hash}.${kind}`);
 async function save(id,bytes,kind){
  valid(id);if(!Buffer.isBuffer(bytes)||bytes.length>5_000_000)throw Error('INVALID_PRIVATE_BYTES');
  const hash=digest(bytes),b=blob(id,hash,kind);
  try{await b.uploadData(bytes,{conditions:{ifNoneMatch:'*'},blobHTTPHeaders:{blobContentType:kind==='pdf'?'application/pdf':'application/xml'}});}catch(e){if(![409,412].includes(e.statusCode)||digest(await b.downloadToBuffer())!==hash)throw e;}
  return {hash,size:bytes.length,kind};
 }
 async function read(id,d){if(!/^[a-f0-9]{64}$/.test(d?.hash)||!['dps','xml','pdf'].includes(d.kind)||d.size>5_000_000)throw Error('INVALID_PRIVATE_DOCUMENT');const b=await blob(id,d.hash,d.kind).downloadToBuffer();if(b.length!==d.size||digest(b)!==d.hash)throw Error('PRIVATE_DOCUMENT_CHANGED');return b;}
 return {
  async get(id){valid(id);let e;try{e=await table.getEntity(partitionKey,id);}catch(e){if(e.statusCode===404)return null;throw e;}const w=JSON.parse(e.json);return {...w,signedXml:await read(id,w.dps)};},
  async create(w){valid(w.workId);const dps=await save(w.workId,w.signedXml,'dps');await table.createEntity({partitionKey,rowKey:w.workId,json:JSON.stringify({...w,signedXml:undefined,dps})});},
  async saveResult(id,r){valid(id);const e=await table.getEntity(partitionKey,id),w=JSON.parse(e.json);const result={...r,xml:r.xml?await save(id,r.xml,'xml'):undefined,pdf:r.pdf?await save(id,r.pdf,'pdf'):undefined};await table.updateEntity({partitionKey,rowKey:id,json:JSON.stringify({...w,result})},'Replace',{etag:e.etag});},
 };
}
