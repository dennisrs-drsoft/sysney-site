// Explicit operator runner. No registration, service, schedule or installed configuration.
// Dry-run never creates Azure clients, reads certificates, reserves numbers or calls SOAP.
import {readFile} from 'node:fs/promises';
import {TableClient} from '@azure/data-tables';
import {DefaultAzureCredential} from '@azure/identity';
import {createAtpFiscalStore} from '../src/services/atp-fiscal-store.mjs';
import {createAtpMunicipalStore} from '../src/services/atp-municipal-store.mjs';
import {createAtpMunicipalExecutor} from '../src/services/atp-municipal-executor.mjs';
import {createAtpMunicipalWorkflow,saoPauloFiscalDate} from '../src/services/atp-municipal-workflow.mjs';
import {createAtpMunicipalQueueExecutor,runAtpMunicipalQueueJob,runNextAtpMunicipalQueueJob} from '../src/services/atp-municipal-queue.mjs';
import {readAtpMunicipalReadiness} from '../src/services/atp-municipal-readiness.mjs';
import {createAtpWorkerAuthority} from '../src/services/atp-municipal-worker-authority.mjs';
import {createAtpPaymentGate} from '../src/services/atp-payment-gate.mjs';
const [action='dry-run',configPath,id,approvedHash]=process.argv.slice(2);
if(action==='dry-run')console.log(JSON.stringify({source:'ATP',municipalExecutorEnabled:false,issuanceEnabled:false,nationalEnabled:false,storageTouched:false,certificateRead:false,transmitted:false}));
else if(action==='readiness'){
 if(process.env.ATP_MUNICIPAL_READINESS_ENABLED!=='true'||!configPath)throw Error('ATP_READINESS_DISABLED');
 const bytes=await readFile(configPath);if(bytes.length>16384)throw Error('ATP_READINESS_CONFIG_LIMIT');const c=JSON.parse(bytes);
 if(!/^[a-z0-9]{3,24}$/.test(c.storageAccount||'')||c.paused!==true||c.issuanceEnabled!==false||c.nationalEnabled!==false)throw Error('ATP_READINESS_PAUSED_CONFIG_REQUIRED');
 const credential=new DefaultAzureCredential(),base=`https://${c.storageAccount}.table.core.windows.net`;
 console.log(JSON.stringify(await readAtpMunicipalReadiness({queue:new TableClient(base,'FiscalFila',credential),documents:new TableClient(base,'AdminDocumentos',credential)})));
}
else{
 if(process.env.ATP_MUNICIPAL_OPERATOR_ENABLED!=='true')throw Error('ATP_MUNICIPAL_OPERATOR_DISABLED');
 if(!['prepare','test','recover','run','project','worker'].includes(action)||!configPath||!(/^[a-f0-9]{64}$/.test(id||'')||action==='worker'&&id==='next'))throw Error('ATP_OPERATOR_ARGUMENTS_INVALID');
 const bytes=await readFile(configPath);if(bytes.length>16384)throw Error('ATP_OPERATOR_CONFIG_LIMIT');const c=JSON.parse(bytes);
 if(!/^[a-z0-9]{3,24}$/.test(c.storageAccount||'')||typeof c.actorId!=='string'||!c.actorId||c.actorId.length>254)throw Error('ATP_OPERATOR_CONFIG_INVALID');
 const actor={id:c.actorId,role:'administrador'},credential=new DefaultAzureCredential(),queue=new TableClient(`https://${c.storageAccount}.table.core.windows.net`,'FiscalFila',credential);
 const native=createAtpMunicipalExecutor({enabled:process.env.ATP_MUNICIPAL_EXECUTOR_ENABLED==='true',issuanceEnabled:process.env.ATP_MUNICIPAL_ISSUANCE_ENABLED==='true',thumbprint:c.certificateThumbprint,municipalRouting:c.municipalRouting,approvedPolicyHash:c.approvedPolicyHash,requireFreshPayment:c.requireFreshPayment===true});
 if(action==='worker'){
  const paymentGate=c.requireFreshPayment===true?createAtpPaymentGate({baseUrl:c.paymentGateBaseUrl}):undefined;
  const options={table:queue,jobId:id,executor:native,enabled:process.env.ATP_MUNICIPAL_EXECUTOR_ENABLED==='true',authorizeAutomation:createAtpWorkerAuthority({documents:new TableClient(`https://${c.storageAccount}.table.core.windows.net`,'AdminDocumentos',credential),config:c,paymentGate})};
  console.log(JSON.stringify(await(id==='next'?runNextAtpMunicipalQueueJob(options):runAtpMunicipalQueueJob(options))));
 }else{
 const repository=createAtpFiscalStore(c.storageAccount),table=new TableClient(`https://${c.storageAccount}.table.core.windows.net`,'AdminDocumentos',credential);
 const executor=createAtpMunicipalQueueExecutor({table:queue,enabled:process.env.ATP_MUNICIPAL_QUEUE_ENABLED==='true',downloadPdf:e=>native.downloadPdf(e)});
 const workflow=createAtpMunicipalWorkflow({repository,store:createAtpMunicipalStore(table),executor,enabled:true,issuanceEnabled:process.env.ATP_MUNICIPAL_ISSUANCE_ENABLED==='true'});
 let result;
 if(action==='prepare'){const w=await workflow.prepare({requestId:id,profile:c.profile,series:c.series,initialNumber:c.initialNumber,exclusiveSeriesConfirmed:c.exclusiveSeriesConfirmed,emissionDate:saoPauloFiscalDate(new Date().toISOString()),actor});result={workId:w.workId,hash:w.hash,state:w.state,series:w.series,number:w.number,transmitted:false};}
 else if(action==='run')result=await workflow.run({workId:id,actor,approvedHash,confirmed:process.env.ATP_MUNICIPAL_CONFIRMED==='true'});
 else if(action==='project'){const r=await workflow.project({workId:id,actor,confirmed:process.env.ATP_MUNICIPAL_CONFIRMED==='true'});result={requestId:r.id,status:r.status,invoice:r.invoice,transmitted:false};}
 else result=await workflow[action]({workId:id,actor});
 console.log(JSON.stringify(result));
 }
}
