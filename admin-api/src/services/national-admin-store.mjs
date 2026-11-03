import {createHash,randomBytes} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
export function createNationalAdminSequence(table,{cnpj,ambiente}){
 if(!/^\d{14}$/.test(cnpj)||!['producao','homologacao'].includes(ambiente))throw Error('NATIONAL_SEQUENCE_SCOPE');
 const partitionKey=`nacional-admin-sequencia-${ambiente}-${cnpj}`;
 const get=async k=>{try{return await table.getEntity(partitionKey,k);}catch(e){if(e.statusCode!==404)throw e;return null;}};
 return {async reserve({workId,hash,serie,emissao}){
  if(!/^[a-f0-9]{64}$/.test(workId)||!/^[a-f0-9]{64}$/.test(hash)||!/^[1-9]\d{0,4}$/.test(serie)||!Number.isFinite(Date.parse(emissao)))throw Error('NATIONAL_SEQUENCE_INPUT');
  for(let i=0;i<32;i++){
   const old=await get('work-'+workId);if(old){const a=JSON.parse(old.json);if(a.hash!==hash||a.serie!==serie)throw Error('NATIONAL_SEQUENCE_CHANGED');return a;}
   const row='serie-'+serie.padStart(5,'0'),counter=await get(row),n=BigInt(counter?.ultimo||'0')+1n;
   if(n>999999999999999n)throw Error('NATIONAL_SEQUENCE_EXHAUSTED');
   const a={workId,hash,serie,numero:String(n),emissao,cnpj,ambiente};
   try{await table.submitTransaction([counter?['update',{partitionKey,rowKey:row,ultimo:String(n)},'Replace',{etag:counter.etag}]:['create',{partitionKey,rowKey:row,ultimo:String(n)}],['create',{partitionKey,rowKey:'work-'+workId,json:JSON.stringify(a)}]]);return a;}catch(e){const saved=await get('work-'+workId);if(saved){const a=JSON.parse(saved.json);if(a.hash!==hash||a.serie!==serie)throw Error('NATIONAL_SEQUENCE_CHANGED');return a;}if(![409,412].includes(e.statusCode))throw e;}
  }throw Error('NATIONAL_SEQUENCE_BUSY');
 }};
}
export function createNationalAdminQueue(table){
 const part='nacional-admin-fila-v1';
 const get=async id=>{if(!/^[a-f0-9]{64}$/.test(id))throw Error('NATIONAL_JOB_ID');return table.getEntity(part,id);};
 return {get,async enqueue(payload){
  const pedido=JSON.stringify(payload);if(Buffer.byteLength(pedido)>28000)throw Error('NATIONAL_JOB_SIZE');
  const id=randomBytes(32).toString('hex'),hash=digest(pedido);
  await table.createEntity({partitionKey:part,rowKey:id,pedido,hash,estado:'pendente',expira:new Date(Date.now()+180000).toISOString()});return id;
 },async claim(row){
  if(row.estado!=='pendente'||!Number.isFinite(Date.parse(row.expira))||Date.parse(row.expira)<=Date.now()||digest(row.pedido)!==row.hash)throw Error('NATIONAL_JOB_EXPIRED');
  await table.updateEntity({partitionKey:part,rowKey:row.rowKey,estado:'executando'},'Merge',{etag:row.etag});return JSON.parse(row.pedido);
 },async complete(id,result){
  const bytes=Buffer.from(JSON.stringify(result));if(bytes.length>7500000)throw Error('NATIONAL_RESULT_LIMIT');
  const chunkSize=20000,count=Math.ceil(bytes.length/chunkSize),p=`nacional-admin-resultado-${id}`;
  for(let i=0;i<count;i++)await table.createEntity({partitionKey:p,rowKey:String(i).padStart(4,'0'),bytes:bytes.subarray(i*chunkSize,(i+1)*chunkSize).toString('base64')});
  const row=await get(id);if(row.estado!=='executando')throw Error('NATIONAL_JOB_STATE');
  await table.updateEntity({partitionKey:part,rowKey:id,estado:'concluido',resultadoHash:digest(bytes),count,size:bytes.length},'Merge',{etag:row.etag});
 },async result(id){
  const row=await get(id);if(row.estado!=='concluido')return {estado:row.estado};
  if(!Number.isInteger(row.count)||row.count<1||row.count>375||!Number.isInteger(row.size)||row.size>7500000)throw Error('NATIONAL_RESULT_METADATA');
  const parts=[];for(let i=0;i<row.count;i++){const r=await table.getEntity(`nacional-admin-resultado-${id}`,String(i).padStart(4,'0'));parts.push(Buffer.from(r.bytes,'base64'));}
  const bytes=Buffer.concat(parts);if(bytes.length!==row.size||digest(bytes)!==row.resultadoHash)throw Error('NATIONAL_RESULT_HASH');
  return {estado:row.estado,result:JSON.parse(bytes.toString())};
 }};
}
