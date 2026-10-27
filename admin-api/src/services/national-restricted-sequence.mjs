// Counter + stable request assignment commit in one Table partition transaction.
// No TTL/reset/delete path: restart, conflict and timeout must recover the assignment.
export function createRestrictedDpsSequence(table,{issuer='57767099000179',environment='homologacao'}={}){
 if(issuer!=='57767099000179'||environment!=='homologacao')throw Error('RESTRICTED_SEQUENCE_SCOPE');
 const partitionKey=`national-dps-v1-${environment}-${issuer}`;
 const read=async row=>{try{return await table.getEntity(partitionKey,row);}catch(e){if(e.statusCode===404)return null;throw e;}};
 return {async reserve({requestId,series,preparationHash,emissionAt}){
  if(!/^[a-f0-9]{64}$/.test(requestId)||!/^\d{1,5}$/.test(String(series))||!/^[a-f0-9]{64}$/.test(preparationHash)||!Number.isFinite(Date.parse(emissionAt)))throw Error('INVALID_SEQUENCE_INPUT');
  series=String(BigInt(series));const requestRow='request-'+requestId,counterRow='series-'+series.padStart(5,'0');
  const recover=async()=>{const e=await read(requestRow);if(!e)return null;const a=JSON.parse(e.json);if(a.series!==series||a.preparationHash!==preparationHash)throw Error('REQUEST_DPS_ASSIGNMENT_CONFLICT');return a;};
  for(let attempt=0;attempt<32;attempt++){
   const existing=await recover();if(existing)return existing;
   const counter=await read(counterRow),next=BigInt(counter?.lastNumber||'0')+1n;
   if(next>999999999999999n)throw Error('DPS_SEQUENCE_EXHAUSTED');
   const assignment={requestId,series,number:String(next),preparationHash,emissionAt,issuer,environment};
   const updated={partitionKey,rowKey:counterRow,lastNumber:String(next)};
   try{
    await table.submitTransaction([
     counter?['update',updated,'Replace',{etag:counter.etag}]:['create',updated],
     ['create',{partitionKey,rowKey:requestRow,json:JSON.stringify(assignment)}],
    ]);return assignment;
   }catch(e){
    // Read even on transport timeout: transaction may have committed already.
    const assigned=await recover();if(assigned)return assigned;
    if(![409,412].includes(e.statusCode))throw e;
   }
  }
  throw Error('DPS_SEQUENCE_BUSY_RETRY_PREPARATION');
 }};
}
