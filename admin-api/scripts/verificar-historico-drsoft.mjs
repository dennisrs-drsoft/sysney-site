// Somente leitura: confere importação, idempotência e exceção atual.
import { TableClient } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
import { planejarHistoricoRecebido } from '../src/services/historico-fiscal-recebido.mjs';
const [coleta,excluida]=process.argv.slice(2);
if(!/^[a-f0-9-]{36}$/.test(coleta||'')||!/^\d+$/.test(excluida||''))throw Error('Coleta/exceção inválida.');
const cred=new DefaultAzureCredential(),t=new TableClient('https://sysneyadm2602.table.core.windows.net','AdminDocumentos',cred);
async function ler(part){const rs=[];for await(const r of t.listEntities({queryOptions:{filter:`PartitionKey eq '${part}'`}}))rs.push(JSON.parse(r.json));return rs;}
const notas=await ler('nfse-historico-drsoft'),cobrancas=await ler('cobrancas-drsoft');
const r=planejarHistoricoRecebido(notas,cobrancas,{empresa:'drsoft',excluidas:[excluida],em:new Date().toISOString(),responsavel:'Conferência somente leitura'});
const atual=cobrancas.filter(c=>String(Number(c.nota))===String(Number(excluida)));
if(r.operacoes.length||atual.length!==1||atual[0].eventos.some(e=>e.tipo==='pagamento'))throw Error('Conferência de recebimentos/exceção falhou.');
const historicas=cobrancas.filter(c=>c.origem==='historico-fiscal');
if(notas.some(n=>n.coleta!==coleta||!n.xmlBlob||!n.pdfBlob)||historicas.some(c=>c.eventos.some(e=>e.tipo==='pagamento'&&(e.data||e.fonte==='banco'))))throw Error('Arquivos ou datas históricas divergentes.');
console.log(JSON.stringify({notas:notas.length,xmls:notas.filter(n=>n.xmlBlob).length,pdfs:notas.filter(n=>n.pdfBlob).length,canceladas:r.resumo.canceladas,recebidas:r.resumo.jaRecebidas,cobrancasHistoricas:historicas.length,totalRecebidoCentavos:historicas.reduce((s,c)=>s+c.centavos,0),notaAberta:excluida,saldoAtualCentavos:atual[0].centavos,vencimentoAtual:atual[0].vencimento,reexecucaoSemDuplicatas:true}));
