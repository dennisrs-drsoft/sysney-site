import {digest} from './atp-fiscal-v1.mjs';
// Dedicated ATP work/ledger partition. Legacy FiscalFila jobs are never consumed.
// Counter shares the municipal counter partition to make a series collision visible.
export function createAtpMunicipalStore(table,{partitionKey='atp-municipal-v1'}={}){
 if(!['atp-municipal-v1','atp-municipal-executor-v1'].includes(partitionKey))throw Error('ATP_PARTITION_INVALID');
 const part=partitionKey,seq='nfse-sequencia-sysney';
 const read=async(p,k)=>{try{return await table.getEntity(p,k);}catch(e){if(e.statusCode===404)return null;throw e;}};
 const content=async work=>{
  const bytes=Buffer.from(JSON.stringify({...work,etag:undefined})),hash=digest(bytes),count=Math.ceil(bytes.length/20000);
  if(bytes.length>8_000_000)throw Error('ATP_WORK_SIZE_LIMIT');
  for(let x=0;x<count;x++){
   const rowKey=`content-${hash}-${String(x).padStart(4,'0')}`,data=bytes.subarray(x*20000,(x+1)*20000).toString('base64');
   try{await table.createEntity({partitionKey:part,rowKey,data});}catch(e){const old=await read(part,rowKey);if(old?.data!==data)throw e;}
  }return {partitionKey:part,rowKey:'work-'+work.workId,hash,count,size:bytes.length,...(typeof work.state==='string'?{state:work.state}:{})};
 };
 return {
  async reserve({requestId,series,preparationHash,emissionDate,issuer,initialNumber,exclusiveSeriesConfirmed}){
   if(!/^[a-f0-9]{64}$/.test(requestId)||!/^[a-f0-9]{64}$/.test(preparationHash)||!/^ATP[A-Z0-9]{0,2}$/.test(series)||issuer?.cnpj!=='57767099000179'||!/^\d{8}$/.test(issuer.inscricao)||exclusiveSeriesConfirmed!==true||!/^\d{1,12}$/.test(initialNumber)||BigInt(initialNumber)<1n)throw Error('ATP_EXCLUSIVE_SEQUENCE_REQUIRED');
   const row='atp-request-'+requestId;
   const recover=async()=>{const e=await read(seq,row);if(!e)return null;const v=JSON.parse(e.json);if(v.preparationHash!==preparationHash||v.series!==series||v.emissionDate!==emissionDate)throw Error('ATP_RPS_ASSIGNMENT_CONFLICT');return v;};
   for(let attempt=0;attempt<32;attempt++){
    const old=await recover();if(old)return old;
    const c=await read(seq,series);
    if(c&&(c.cnpj!==issuer.cnpj||c.inscricao!==issuer.inscricao||c.owner!=='ATP'))throw Error('ATP_RPS_SERIES_COLLISION');
    const number=c?String(c.proximo):initialNumber;
    if(!/^\d{1,12}$/.test(number)||BigInt(number)<1n||BigInt(number)>=999999999999n)throw Error('ATP_SEQUENCE_EXHAUSTED');
    const assignment={requestId,series,number,emissionDate,preparationHash};
    const counter={partitionKey:seq,rowKey:series,proximo:String(BigInt(number)+1n),cnpj:issuer.cnpj,inscricao:issuer.inscricao,owner:'ATP'};
    try{await table.submitTransaction([c?['update',counter,'Replace',{etag:c.etag}]:['create',counter],['create',{partitionKey:seq,rowKey:row,json:JSON.stringify(assignment)}]]);return assignment;}
    catch(e){const saved=await recover();if(saved)return saved;if(![409,412].includes(e.statusCode))throw e;}
   }throw Error('ATP_SEQUENCE_BUSY');
  },
  async get(id){
   const e=await read(part,'work-'+id);if(!e)return null;
   if(!Number.isInteger(e.count)||e.count<1||e.count>400||e.size>8_000_000)throw Error('ATP_WORK_CORRUPT');
   const parts=[];for(let x=0;x<e.count;x++){const c=await read(part,`content-${e.hash}-${String(x).padStart(4,'0')}`);if(!c)throw Error('ATP_WORK_CORRUPT');parts.push(Buffer.from(c.data,'base64'));}
   const bytes=Buffer.concat(parts);if(bytes.length!==e.size||digest(bytes)!==e.hash)throw Error('ATP_WORK_CORRUPT');
   return {...JSON.parse(bytes.toString('utf8')),etag:e.etag};
  },
  async create(work){await table.createEntity(await content(work));},
  async save(work){await table.updateEntity(await content(work),'Replace',{etag:work.etag});},
  async claim(workId,hash){
   const row='send-'+workId,entity={partitionKey:part,rowKey:row,hash};
   try{await table.createEntity(entity);return true;}catch(e){const old=await read(part,row);if(old){if(old.hash!==hash)throw Error('ATP_SEND_HASH_CONFLICT');return false;}throw e;}
  },
  async hasClaim(workId,hash){const e=await read(part,'send-'+workId);if(e&&e.hash!==hash)throw Error('ATP_SEND_HASH_CONFLICT');return !!e;},
 };
}
