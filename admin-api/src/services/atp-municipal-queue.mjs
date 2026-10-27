import {randomUUID} from 'node:crypto';
import {digest} from './atp-fiscal-v1.mjs';
import {createAtpMunicipalStore} from './atp-municipal-store.mjs';
// Orchestrator owns AdminDocumentos; the on-demand VM worker only needs its
// existing FiscalFila permission. No new service, timer or RBAC is installed.
export function createAtpMunicipalQueueExecutor({table,downloadPdf,enabled=false,now=()=>Date.now(),wait=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=85000}){
 const store=createAtpMunicipalStore(table,{partitionKey:'atp-municipal-executor-v1'});
 return {
  async execute(payload){
   if(enabled!==true)throw Error('ATP_MUNICIPAL_QUEUE_DISABLED');
   if(!['testar','emitir','consultar'].includes(payload.action)||!/^\w{64}$/.test(payload.workId)||typeof payload.xml!=='string'||payload.xml.length>20000||payload.action==='emitir'&&(payload.confirmed!==true||digest(payload.xml)!==payload.approvedHash))throw Error('ATP_QUEUE_INPUT_INVALID');
   const workId=digest(randomUUID()),deadline=now()+Math.min(timeoutMs,85000);
   await store.create({workId,source:'ATP',state:'queued',payload:{...payload,xmlHash:digest(payload.xml)},deadline,createdAtUtc:new Date(now()).toISOString()});
   while(now()<deadline){const job=await store.get(workId);if(job?.state==='complete')return {success:job.success,xml:Buffer.from(job.xmlBase64,'base64')};if(job?.state==='failed')throw Error('ATP_QUEUE_RESULT_UNCERTAIN');await wait(250);}
   throw Error('ATP_QUEUE_RESULT_UNCERTAIN');
  },downloadPdf,
 };
}
export async function runAtpMunicipalQueueJob({table,jobId,executor,authorizeAutomation,enabled=false,now=()=>Date.now()}){
 if(enabled!==true)throw Error('ATP_MUNICIPAL_WORKER_DISABLED');
 if(!/^[a-f0-9]{64}$/.test(jobId))throw Error('ATP_QUEUE_JOB_INVALID');
 const store=createAtpMunicipalStore(table,{partitionKey:'atp-municipal-executor-v1'}),job=await store.get(jobId);
 if(!job||job.source!=='ATP'||job.state!=='queued'||job.payload?.xmlHash!==digest(job.payload.xml))throw Error('ATP_QUEUE_JOB_NOT_ELIGIBLE');
 if(job.deadline<now()){await store.save({...job,state:'expired'});throw Error('ATP_QUEUE_JOB_NOT_ELIGIBLE');}
 // CAS before touching certificate/network. A crashed job is never reexecuted.
 await store.save({...job,state:'running'});
 try{if(job.payload.automation&&!authorizeAutomation)throw Error('ATP_AUTOMATION_WORKER_AUTH_REQUIRED');if(authorizeAutomation)await authorizeAutomation(job.payload);const result=await executor.execute(job.payload),current=await store.get(jobId);await store.save({...current,state:'complete',success:result.success,xmlBase64:result.xml.toString('base64')});return {jobId,state:'complete'};}
 catch{const current=await store.get(jobId);await store.save({...current,state:'failed'});return {jobId,state:'failed',queryRequired:true};}
}
export async function runNextAtpMunicipalQueueJob(options){
 if(options.enabled!==true)throw Error('ATP_MUNICIPAL_WORKER_DISABLED');
 const filter="PartitionKey eq 'atp-municipal-executor-v1' and RowKey ge 'work-' and RowKey lt 'work.' and state eq 'queued'";
 let checked=0;for await(const row of options.table.listEntities({queryOptions:{filter}})){
  if(++checked>25)break;
  try{return await runAtpMunicipalQueueJob({...options,jobId:row.rowKey.slice(5)});}catch(e){if(![409,412].includes(e.statusCode)&&e.message!=='ATP_QUEUE_JOB_NOT_ELIGIBLE')throw e;}
 }return {state:'no_eligible_job',transmitted:false};
}
