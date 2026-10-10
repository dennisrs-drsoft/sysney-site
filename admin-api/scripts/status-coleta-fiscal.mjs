// Diagnóstico somente leitura, sem expor XML, certificado ou dados de clientes.
import { TableClient } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
const [empresa, coleta] = process.argv.slice(2);
if (!['drsoft','sysney'].includes(empresa) || !/^[a-f0-9-]{36}$/.test(coleta || '')) throw Error('Empresa/coleta inválida.');
const t=new TableClient('https://sysneyadm2602.table.core.windows.net','FiscalFila',new DefaultAzureCredential());
const part=`historico-nfse-${empresa}-${coleta}`, status=JSON.parse((await t.getEntity(part,'status')).json);
let notas=0,canceladas=0,situacoesDesconhecidas=0,documentosInvalidos=0,zero=0;const pendencias=[];
for await(const r of t.listEntities({queryOptions:{filter:`PartitionKey eq '${part}'`}})) {
 const n=JSON.parse(r.json);if(n.tipo!=='nota')continue;notas++;
 if(n.situacao==='C')canceladas++;
 if(!['N','C'].includes(n.situacao))situacoesDesconhecidas++;
 if(!/^\d{14}$/.test(n.documento)){documentosInvalidos++;pendencias.push({nota:n.numero,tamanhoDocumento:n.documento.length,situacao:n.situacao});}
 if(n.centavos<=0)zero++;
}
console.log(JSON.stringify({status,notas,canceladas,situacoesDesconhecidas,documentosInvalidos,zero,pendencias}));
