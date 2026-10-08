// Enriquecimento dos índices a partir dos XML já privados. Não consulta banco/Prefeitura nem emite documentos.
import { DefaultAzureCredential } from '@azure/identity';
import { TableClient } from '@azure/data-tables';
import { BlobServiceClient } from '@azure/storage-blob';
import { extrairTributosXml } from '../../lib/extrato-fiscal-xml.ts';
const empresa=process.argv[2];
if(!['sysney','drsoft'].includes(empresa))throw Error('Informe uma empresa válida.');
const cred=new DefaultAzureCredential(),conta='sysneyadm2602';
const table=new TableClient(`https://${conta}.table.core.windows.net`,'AdminDocumentos',cred);
const blobs=new BlobServiceClient(`https://${conta}.blob.core.windows.net`,cred).getContainerClient('admin-anexos');
let indexados=0,guiasQuitadas=0;
for await(const row of table.listEntities({queryOptions:{filter:`PartitionKey eq 'nfse-historico-${empresa}'`}})){
  const n=JSON.parse(row.json);
  if(typeof n.xmlBlob!=='string'||!n.xmlBlob.startsWith(`historico/${empresa}/nfse/`))throw Error('Arquivo fora da empresa.');
  const bytes=await blobs.getBlockBlobClient(n.xmlBlob).downloadToBuffer();
  const tributos=extrairTributosXml(bytes.toString('utf8'),String(n.numero),n.inscricao);
  await table.updateEntity({partitionKey:row.partitionKey,rowKey:row.rowKey,json:JSON.stringify({...n,tributos})},'Merge',{etag:row.etag});
  indexados++;if(tributos.quitacaoGuia)guiasQuitadas++;
}
console.log(JSON.stringify({empresa,indexados,guiasComDataQuitacao:guiasQuitadas,impostosPagosInferidos:false}));
