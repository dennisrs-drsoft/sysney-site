import {readFile} from 'node:fs/promises';
import {DefaultAzureCredential} from '@azure/identity';
import {TableClient} from '@azure/data-tables';
import {createNationalAdminNativeProcess} from '../src/services/national-admin-native-process.mjs';
import {runNationalAdminJob} from '../src/services/national-admin-worker.mjs';
const [action='dry-run',path]=process.argv.slice(2);
if(action==='dry-run')console.log(JSON.stringify({state:'disabled',transmitted:false,storageTouched:false}));
else{
 if(action!=='once'||!path||process.platform!=='win32')throw Error('NATIONAL_WORKER_ARGUMENTS');
 const bytes=await readFile(path);if(bytes.length>16000)throw Error('NATIONAL_WORKER_CONFIG_LIMIT');const config=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
 if(config.paused!==false||config.allowQueries!==true){console.log(JSON.stringify({state:'paused',transmitted:false}));process.exit(0);}
 if(!/^[a-z0-9]{3,24}$/.test(config.storageAccount))throw Error('NATIONAL_WORKER_STORAGE');
 const cred=new DefaultAzureCredential(),url=`https://${config.storageAccount}.table.core.windows.net`,queueTable=new TableClient(url,'FiscalFila',cred),documents=new TableClient(url,'AdminDocumentos',cred);
 await queueTable.upsertEntity({partitionKey:'servico',rowKey:'nacional-admin',em:new Date().toISOString(),assinatura:config.allowSigning===true,envio:config.allowSend===true},'Replace');
 const native=createNationalAdminNativeProcess(config.nativeScriptPath);let count=0;
 for await(const row of queueTable.listEntities({queryOptions:{filter:"PartitionKey eq 'nacional-admin-fila-v1' and estado eq 'pendente'"}})){
  if(++count>4)break;
  if(Date.parse(row.expira)<=Date.now())continue;
  try{console.log(JSON.stringify(await runNationalAdminJob({queueTable,documents,config,native,row})));}catch{console.log(JSON.stringify({state:'job_claim_unconfirmed',transmitted:false}));}
 }
}
