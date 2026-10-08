// Importa apenas documentos já baixados e conferidos. Não transmite apuração nem gera DAS.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DefaultAzureCredential} from '@azure/identity';
import {TableClient} from '@azure/data-tables';
import {BlobServiceClient} from '@azure/storage-blob';
let input=''; for await(const chunk of process.stdin)input+=chunk;
const rows=JSON.parse(input), cred=new DefaultAzureCredential();
const conta=process.env.ADMIN_STORAGE_ACCOUNT||'sysneyadm2602';
const table=new TableClient(`https://${conta}.table.core.windows.net`,'AdminDocumentos',cred);
const blobs=new BlobServiceClient(`https://${conta}.blob.core.windows.net`,cred).getContainerClient('admin-anexos');
for(const row of rows){
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(row.mes)||!/^57767099\d{9}$/.test(row.declaracao))throw Error('Identidade inválida');
  const bytes=await readFile(row.arquivo);
  if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Documento mudou');
  const blob=`historico/sysney/pgdas/${row.declaracao}.pdf`;
  let previous;try{previous=await table.getEntity('pgdas-sysney',row.mes);}catch(e){if(e.statusCode!==404)throw e;}
  if(previous){if(JSON.parse(previous.json).sha256!==row.sha256)throw Error('Apuração diferente: conferir antes de substituir');continue;}
  await blobs.getBlockBlobClient(blob).uploadData(bytes,{blobHTTPHeaders:{blobContentType:'application/pdf'}});
  const {arquivo,...dados}=row;void arquivo;
  await table.createEntity({partitionKey:'pgdas-sysney',rowKey:row.mes,json:JSON.stringify({...dados,blob,importadoEm:new Date().toISOString()})});
}
console.log(JSON.stringify({apuracoes:rows.length,empresa:'sysney',transmissaoFiscal:false}));
