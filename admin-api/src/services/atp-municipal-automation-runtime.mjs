import {TableClient} from '@azure/data-tables';
import {DefaultAzureCredential} from '@azure/identity';
import {SecretClient} from '@azure/keyvault-secrets';
import {createAtpFiscalStore} from './atp-fiscal-store.mjs';
import {createAtpMunicipalStore} from './atp-municipal-store.mjs';
import {createAtpAutomationStore} from './atp-municipal-automation-store.mjs';
import {createAtpMunicipalAutomation} from './atp-municipal-automation.mjs';
import {createAtpMunicipalQueueExecutor} from './atp-municipal-queue.mjs';
import {createAtpMunicipalExecutor} from './atp-municipal-executor.mjs';
import {createAtpPaymentGate} from './atp-payment-gate.mjs';
export async function runAzureAtpMunicipalAutomation({env=process.env}={}){
 // OFF must return before constructing credentials, reading policy or storage.
 if(env.ATP_MUNICIPAL_AUTOMATION_ENABLED!=='true'||env.ATP_MUNICIPAL_ISSUANCE_ENABLED!=='true'||env.ATP_MUNICIPAL_QUEUE_ENABLED!=='true')return {state:'disabled',visited:0};
 if(env.SYSNEY_ALLOW_NATIONAL_RESTRICTED_SEND==='true')throw Error('ATP_NATIONAL_MUST_REMAIN_DISABLED');
 if(!/^[a-z0-9]{3,24}$/.test(env.ADMIN_STORAGE_ACCOUNT||''))throw Error('ATP_STORAGE_REQUIRED');
 const credential=new DefaultAzureCredential(),base=`https://${env.ADMIN_STORAGE_ACCOUNT}.table.core.windows.net`;
 const table=new TableClient(base,'AdminDocumentos',credential),queue=new TableClient(base,'FiscalFila',credential);
 const policyRow=await new TableClient(base,'AdminConfiguracoes',credential).getEntity('atp-municipal-automation','sysney-v1');
 const policy=JSON.parse(policyRow.json);
 if(policy.mode&&policy.mode!=='production')throw Error('ATP_PRODUCTION_MODE_ONLY');
 const uri=env.KEY_VAULT_URI,name=env.ATP_FISCAL_V1_TOKEN_SECRET_NAME;
 if(!/^https:\/\/[a-z0-9-]+\.vault\.azure\.net\/?$/.test(uri||'')||!/^atp-fiscal-v1-[a-z0-9-]+$/.test(name||''))throw Error('ATP_PAYMENT_GATE_CREDENTIAL_REQUIRED');
 const paymentGate=createAtpPaymentGate({baseUrl:policy.paymentGateBaseUrl,tokenProvider:async()=> (await new SecretClient(uri,credential).getSecret(name)).value});
 const download=createAtpMunicipalExecutor({enabled:true});
 const executor=createAtpMunicipalQueueExecutor({table:queue,enabled:true,downloadPdf:e=>download.downloadPdf(e)});
 const automation=createAtpMunicipalAutomation({repository:createAtpFiscalStore(env.ADMIN_STORAGE_ACCOUNT),works:createAtpMunicipalStore(table),jobs:createAtpAutomationStore(table),executor,paymentGate,config:{...policy,mode:'production',automationEnabled:true,issuanceEnabled:true,nationalEnabled:false}});
 return automation.tick({limit:1});
}
