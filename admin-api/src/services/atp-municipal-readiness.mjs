// SDK-backed readiness: enumerates only dedicated ATP partitions. No mutation,
// certificate access, provider call, callback, email or fiscal document download.
export async function readAtpMunicipalReadiness({queue,documents}){
 const count=async(table,filter)=>{let n=0;for await(const row of table.listEntities({queryOptions:{filter}})){void row;if(++n>10000)throw Error('ATP_READINESS_LIMIT_REQUIRES_REVIEW');}return n;};
 const queueJobs=await count(queue,"PartitionKey eq 'atp-municipal-executor-v1' and RowKey ge 'work-' and RowKey lt 'work.'");
 const preparations=await count(documents,"PartitionKey eq 'integracao-fiscal-atp-v1' and RowKey ge 'request-0' and RowKey lt 'request-g'");
 return {source:'ATP',queueJobs,preparations,storageReadable:true,storageWrites:false,transmitted:false,issuanceEnabled:false,nationalEnabled:false};
}
