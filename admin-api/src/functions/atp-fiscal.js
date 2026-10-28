import {app} from '@azure/functions';
import {SecretClient} from '@azure/keyvault-secrets';
import {DefaultAzureCredential} from '@azure/identity';
import {createAtpFiscalHandler} from '../services/atp-fiscal-v1.mjs';
import {createAtpFiscalStore} from '../services/atp-fiscal-store.mjs';
import {limitarAcesso} from '../services/limite-acesso.js';

const handler=createAtpFiscalHandler({
 config:async()=>{
  if(process.env.ATP_FISCAL_V1_ENABLED!=='true')return {};
  // Sem fallback para chave administrativa ou token em arquivo/JavaScript.
  const uri=process.env.KEY_VAULT_URI,name=process.env.ATP_FISCAL_V1_TOKEN_SECRET_NAME;
  if(!/^https:\/\/[a-z0-9-]+\.vault\.azure\.net\/?$/.test(uri||'')||!/^atp-fiscal-v1-[a-z0-9-]+$/.test(name||''))return {};
  try {const token=(await new SecretClient(uri,new DefaultAzureCredential()).getSecret(name)).value;return {enabled:'true',token};}catch{return {};}
 },
 storeFactory:()=>createAtpFiscalStore(process.env.ADMIN_STORAGE_ACCOUNT),
 limit:()=>limitarAcesso({identityProvider:'integration',userId:'ATP-fiscal-v1'},'POST'),
});
// authLevel anonymous apenas dispensa function master key. Bearer dedicado é
// obrigatório no handler ANTES de qualquer acesso ao armazenamento.
for(const [name,route,methods] of [
 ['atp-fiscal-root','integracoes/atp/v1/solicitacoes-fiscais',['GET','POST']],
 ['atp-fiscal-id','integracoes/atp/v1/solicitacoes-fiscais/{id}',['GET']],
 ['atp-fiscal-refund','integracoes/atp/v1/solicitacoes-fiscais/{id}/{action:regex(^revisao-estorno$)}',['POST']],
 ['atp-fiscal-manual','integracoes/atp/v1/solicitacoes-fiscais/{id}/{action:regex(^assumir-manual$)}',['POST']],
 ['atp-fiscal-document','integracoes/atp/v1/solicitacoes-fiscais/{id}/documentos/{format}',['GET']],
])app.http(name,{route,methods,authLevel:'anonymous',handler});
