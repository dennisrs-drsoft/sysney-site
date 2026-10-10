// Somente registros internos. Não chama banco, emissão fiscal ou envio de e-mail.
import { TableClient } from '@azure/data-tables';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { createHash } from 'node:crypto';
import { planejarHistoricoRecebido } from '../src/services/historico-fiscal-recebido.mjs';

const [coleta, excluidas, modo = 'previa'] = process.argv.slice(2);
if (!/^[a-f0-9-]{36}$/.test(coleta || '') || !/^\d+(,\d+)*$/.test(excluidas || '') || !['previa','gravar'].includes(modo)) throw Error('Informe coleta concluída, notas excluídas e previa/gravar.');
const cred = new DefaultAzureCredential(), url = 'https://sysneyadm2602.table.core.windows.net';
const docs = new TableClient(url, 'AdminDocumentos', cred), config = new TableClient(url, 'AdminConfiguracoes', cred);
const fila = new TableClient(url, 'FiscalFila', cred);
const status = JSON.parse((await fila.getEntity(`historico-nfse-drsoft-${coleta}`, 'status')).json);
if (status.estado !== 'concluido') throw Error('Coleta fiscal incompleta.');
async function ler(table, part) { const rows = []; for await (const r of table.listEntities({queryOptions:{filter:`PartitionKey eq '${part}'`}})) rows.push(r); return rows; }
const nr = await ler(docs, 'nfse-historico-drsoft'), cr = await ler(docs, 'cobrancas-drsoft');
const notas = nr.map(r => JSON.parse(r.json));
if (notas.length !== status.notas || notas.some(n => n.coleta !== coleta)) throw Error('Índice importado não corresponde à coleta completa.');
const cobrancas = cr.map(r => JSON.parse(r.json));
const resultado = planejarHistoricoRecebido(notas, cobrancas, { empresa:'drsoft', excluidas:excluidas.split(','), em:new Date().toISOString(), responsavel:'Dennis — confirmação expressa do titular' });
console.log(JSON.stringify({modo, ...resultado.resumo, exclusao:excluidas}));
if (modo === 'gravar') {
  // Snapshot privado antes de qualquer alteração. Não vai para Git nem para área pública.
  const arquivo = new BlobServiceClient('https://sysneyadm2602.blob.core.windows.net', cred).getContainerClient('admin-anexos').getBlockBlobClient(`historico/drsoft/manifestos/cobrancas-${coleta}-${Date.now()}.json`);
  await arquivo.uploadData(Buffer.from(JSON.stringify({coleta, excluidas, anteriores:cr, resultado})), { conditions:{ifNoneMatch:'*'}, blobHTTPHeaders:{blobContentType:'application/json'} });
  let proxima=0,gravadas=0;
  async function gravarRegistros() { while(proxima < resultado.operacoes.length) {
    const op=resultado.operacoes[proxima++];
    if (op.plano) {
      try { await config.createEntity({partitionKey:'cobrancas-drsoft',rowKey:op.plano.id,json:JSON.stringify(op.plano)}); }
      catch(e) { if(e.statusCode!==409)throw e; const row=await config.getEntity('cobrancas-drsoft',op.plano.id); const p=JSON.parse(row.json); if(p.origem!=='historico-fiscal'||p.documento!==op.plano.documento||p.centavos!==op.plano.centavos)throw Error('Plano histórico divergente.'); }
    }
    const entity={partitionKey:'cobrancas-drsoft',rowKey:op.cobranca.id,json:JSON.stringify(op.cobranca)};
    if(op.anterior)await docs.updateEntity(entity,'Replace',{etag:cr.find(r=>r.rowKey===op.cobranca.id).etag});
    else await docs.createEntity(entity);
    await docs.upsertEntity({partitionKey:'historico-recebimentos-drsoft',rowKey:createHash('sha256').update(`nfse:${op.nota}`).digest('hex'),nota:op.nota,cobrancaId:op.cobranca.id,coleta,fonte:'declaracao-titular',dataPagamentoConhecida:false},'Merge');
    gravadas++;if(gravadas%100===0)console.log(JSON.stringify({etapa:'Cobranças históricas',gravadas,total:resultado.operacoes.length}));
  } }
  await Promise.all(Array.from({length:5},()=>gravarRegistros()));
  console.log(JSON.stringify({gravadas:resultado.operacoes.length, emailsEnviados:0, notasEmitidas:0, operacoesBancarias:0}));
}
