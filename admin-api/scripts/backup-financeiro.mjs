// Backup opt-in em conta SEPARADA. Sem credenciais em argumentos e sem substituir produção.
// node admin-api/scripts/backup-financeiro.mjs criar CONTA_DESTINO
// node admin-api/scripts/backup-financeiro.mjs validar CONTA_DESTINO ID_BACKUP
// node admin-api/scripts/backup-financeiro.mjs restaurar-teste CONTA_DESTINO ID_BACKUP
import {randomUUID} from "node:crypto";
import {DefaultAzureCredential} from "@azure/identity";
import {TableClient,TableServiceClient} from "@azure/data-tables";
import {BlobServiceClient} from "@azure/storage-blob";
import {tabelasFinanceiras,empacotarTabela,verificarTabela} from "../src/services/backup-financeiro.mjs";

async function executar(){
 const [modo,destino,id]=process.argv.slice(2),origem=process.env.ADMIN_STORAGE_ACCOUNT;
 if(!["criar","validar","restaurar-teste"].includes(modo)||!origem||!/^[a-z0-9]{3,24}$/.test(destino||"")||destino===origem)throw Error("Informe uma conta de backup separada da conta de produção e o modo autorizado.");
 if(modo!=="criar"&&!/^[0-9a-f-]{36}$/.test(id||""))throw Error("Identificação de backup inválida.");
 const credential=new DefaultAzureCredential(),blobs=new BlobServiceClient(`https://${destino}.blob.core.windows.net`,credential),container=blobs.getContainerClient("backup-financeiro");
 // Contêiner e permissões precisam ser provisionados/revisados antes: não cria recursos por surpresa.
 const acesso=await container.getAccessPolicy();if(acesso.blobPublicAccess)throw Error("O backup precisa de contêiner privado.");
 const props=await blobs.getProperties();if(!props.isVersioningEnabled||!props.deleteRetentionPolicy?.enabled||props.deleteRetentionPolicy.days<30)throw Error("Ative versionamento e recuperação por pelo menos 30 dias no destino.");
 if(modo==="criar"){
  const backupId=randomUUID(),manifesto={versao:1,id:backupId,criadoEm:new Date().toISOString(),origem,tabelas:[],documentos:"PDFs/XML exigem cópia protegida separada; este backup cobre tabelas."};
  for(const tabela of tabelasFinanceiras){
   const entidades=[];for await(const e of new TableClient(`https://${origem}.table.core.windows.net`,tabela,credential).listEntities())entidades.push(e);
   const {conteudo,registro}=empacotarTabela(tabela,entidades);verificarTabela(registro,conteudo);
   await container.getBlockBlobClient(`${backupId}/${registro.arquivo}`).uploadData(conteudo,{conditions:{ifNoneMatch:"*"},blobHTTPHeaders:{blobContentType:"application/x-ndjson"}});
   manifesto.tabelas.push(registro);
  }
  // Manifesto somente após todos os uploads; ausência significa backup incompleto.
  await container.getBlockBlobClient(`${backupId}/manifesto.json`).uploadData(Buffer.from(JSON.stringify(manifesto)),{conditions:{ifNoneMatch:"*"},blobHTTPHeaders:{blobContentType:"application/json"}});
  console.log(JSON.stringify({backupId,tabelas:manifesto.tabelas.map(r=>({tabela:r.tabela,quantidade:r.quantidade})),consistencia:"Exportação on-line não é snapshot transacional. Validar antes de restaurar."}));return;
 }
 const manifesto=JSON.parse((await container.getBlockBlobClient(`${id}/manifesto.json`).downloadToBuffer()).toString("utf8"));
 if(manifesto.versao!==1||manifesto.id!==id||manifesto.origem!==origem||manifesto.tabelas?.length!==tabelasFinanceiras.length||new Set(manifesto.tabelas.map(r=>r.tabela)).size!==tabelasFinanceiras.length)throw Error("Manifesto incompatível.");
 const conjuntos=[];
 for(const registro of manifesto.tabelas){
  if(!tabelasFinanceiras.includes(registro.tabela)||registro.arquivo!==`${registro.tabela}.jsonl`)throw Error("Arquivo não permitido.");
  conjuntos.push({tabela:registro.tabela,entidades:verificarTabela(registro,await container.getBlockBlobClient(`${id}/${registro.arquivo}`).downloadToBuffer())});
 }
 if(modo==="validar"){console.log(JSON.stringify({backupId:id,integro:true,tabelas:conjuntos.length}));return;}
 const prefixo=`Restauro${randomUUID().replaceAll("-","")}`,service=new TableServiceClient(`https://${destino}.table.core.windows.net`,credential),criadas=[];
 for(const conjunto of conjuntos){
  const nome=`${prefixo}${conjunto.tabela}`;
  await service.createTable(nome);const table=new TableClient(`https://${destino}.table.core.windows.net`,nome,credential);
  for(const e of conjunto.entidades)await table.createEntity(e);
  let quantidade=0;for await(const e of table.listEntities()){void e;quantidade++;}
  if(quantidade!==conjunto.entidades.length)throw Error("Restauração de teste incompleta.");
  criadas.push({tabela:nome,quantidade});
 }
 console.log(JSON.stringify({backupId:id,restauroTeste:true,tabelas:criadas,producaoAlterada:false,limpeza:"As tabelas isoladas de teste ficam para revisão; nenhuma exclusão automática."}));
}
executar().catch(()=>{console.error("Operação de backup não concluída. Nenhuma tabela de produção foi substituída. Revise permissões, destino e integridade; detalhes sensíveis omitidos.");process.exitCode=1;});
