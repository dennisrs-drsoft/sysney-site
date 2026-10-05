// Consulta/arquivo histórico: não chama emissão, cancelamento, baixa nem envio de e-mail.
import { TableClient } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { consultarCobrancaInter, listarCobrancasInter } from "../src/services/inter.js";
import { extrairTributosXml } from "../../lib/extrato-fiscal-xml.ts";

const [modo, coleta] = process.argv.slice(2);
if (!['notas', 'boletos'].includes(modo) || (modo === 'notas' && !/^[a-f0-9-]{36}$/.test(coleta || ''))) throw Error('Informe notas + ID da coleta, ou boletos.');
process.env.KEY_VAULT_URI ||= 'https://sysney-admin-kv-2602.vault.azure.net/';
const cred = new DefaultAzureCredential(), storage = 'sysneyadm2602';
const doc = new TableClient(`https://${storage}.table.core.windows.net`, 'AdminDocumentos', cred);
const fila = new TableClient(`https://${storage}.table.core.windows.net`, 'FiscalFila', cred);
const blob = new BlobServiceClient(`https://${storage}.blob.core.windows.net`, cred).getContainerClient('admin-anexos');
const raiz = resolve('C:/Dados/Documentos/SYSNEY/Historico-Financeiro');
const sha = b => createHash('sha256').update(b).digest('hex');
async function arquivar(bytes, categoria, nome, mime) {
  if (!/^[a-z0-9-]+$/.test(categoria) || !/^[A-Za-z0-9_.-]+$/.test(nome)) throw Error('Nome de arquivo inválido.');
  const pasta = resolve(raiz, categoria), arquivo = resolve(pasta, nome);
  if (!arquivo.startsWith(raiz + sep)) throw Error('Destino fora do arquivo financeiro.');
  await mkdir(pasta, { recursive: true });
  try { await writeFile(arquivo, bytes, { flag: 'wx' }); } catch (e) {
    if (e.code !== 'EEXIST' || sha(await readFile(arquivo)) !== sha(bytes)) throw e;
  }
  const remoto = `historico/sysney/${categoria}/${nome}`;
  try { await blob.getBlockBlobClient(remoto).uploadData(bytes, { conditions: { ifNoneMatch: '*' }, blobHTTPHeaders: { blobContentType: mime } }); }
  catch (e) { if (![409, 412].includes(e.statusCode)) throw e; }
  return remoto;
}
function validarPdf(bytes) {
  if(bytes.length < 100 || bytes.length > 5000000 || !bytes.subarray(0,5).equals(Buffer.from('%PDF-')) || !bytes.subarray(-1024).includes(Buffer.from('%%EOF'))) throw Error('PDF não disponível ou inválido.');
  return bytes;
}
async function baixarNota(n) {
  if(!/^\d{1,12}$/.test(String(n.numero)) || !/^[A-Z0-9]{8}$/.test(n.verificacao) || n.inscricao !== '15539300') throw Error('Identificação fiscal divergente.');
  const url=new URL('https://nfe.prefeitura.sp.gov.br/contribuinte/notaprintpdf.aspx');
  url.search=new URLSearchParams({ nf:String(n.numero), inscricao:n.inscricao, verificacao:n.verificacao }).toString();
  const r=await fetch(url,{signal:AbortSignal.timeout(30000),redirect:'error',headers:{Accept:'application/pdf'}});
  if(!r.ok || !r.headers.get('content-type')?.includes('application/pdf')) throw Error('PDF da Prefeitura indisponível.');
  const chunks=[];let tamanho=0;
  for await(const bytes of r.body){tamanho+=bytes.length;if(tamanho>5000000)throw Error('PDF excede o limite seguro.');chunks.push(Buffer.from(bytes));}
  return validarPdf(Buffer.concat(chunks));
}
const pendencias=[];
if(modo === 'notas') {
  const part='historico-nfse-sysney-'+coleta;
  const status=JSON.parse((await fila.getEntity(part,'status')).json);
  if(status.estado!=='concluido')throw Error('Consulta fiscal não concluída. Nenhuma cobertura completa será presumida.');
  const notas=[],paginas=new Map();
  for await(const e of fila.listEntities({ queryOptions:{filter:`PartitionKey eq '${part}'`} })) {
    const r=JSON.parse(e.json);
    if(r.tipo==='nota')notas.push(r);
    if(r.tipo==='pagina'){
      const id=`${r.inicio}-${r.pagina}`;
      const itens=paginas.get(id)||[];itens.push(r);paginas.set(id,itens);
    }
  }
  if(notas.length!==status.notas)throw Error('Contagem fiscal divergente.');
  for(const [id,itens] of paginas) {
    itens.sort((a,b)=>a.fragmento-b.fragmento);
    if(itens.length!==itens[0].total || itens.some((r,i)=>r.fragmento!==i))throw Error('Resposta XML incompleta.');
    const bytes=Buffer.from(itens.map(r=>r.base64).join(''),'base64');
    await arquivar(bytes,'nfse',`consulta-${id}-${sha(bytes).slice(0,12)}.xml`,'application/xml; charset=utf-8');
  }
  for(const n of notas) {
    if(!/^\d+$/.test(n.numero)||n.inscricao!=='15539300'||!Number.isSafeInteger(n.centavos)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(n.emissao))throw Error('Metadados fiscais inválidos.');
    const bytes=Buffer.from(n.xmlBase64,'base64');
    const xmlBlob=await arquivar(bytes,'nfse',`NFSe_15539300_${n.numero}-${sha(bytes).slice(0,12)}.xml`,'application/xml; charset=utf-8');
    const {xmlBase64,...metadados}=n;
    metadados.tributos = extrairTributosXml(bytes.toString('utf8'), String(n.numero), n.inscricao);
    let anterior={};try{anterior=JSON.parse((await doc.getEntity('nfse-historico-sysney',String(Number(n.numero)))).json);}catch(e){if(e.statusCode!==404)throw e;}
    await doc.upsertEntity({partitionKey:'nfse-historico-sysney',rowKey:String(Number(n.numero)),json:JSON.stringify({...anterior,...metadados,xmlBlob,consultadoEm:status.em,coleta})},'Replace');
  }
  console.log(JSON.stringify({ etapa:'XML e índice fiscal importados', notas:notas.length, inicio:status.inicio, fim:status.fim }));
  let pdfs=0;
  for(const n of notas) {
    try {
      const bytes=await baixarNota(n);
      const pdfBlob=await arquivar(bytes,'nfse',`NFSe_15539300_${n.numero}-${sha(bytes).slice(0,12)}.pdf`,'application/pdf');
      const row=await doc.getEntity('nfse-historico-sysney',String(Number(n.numero)));
      await doc.updateEntity({...row,json:JSON.stringify({...JSON.parse(row.json),pdfBlob})},'Replace',{etag:row.etag});pdfs++;
    } catch { pendencias.push({tipo:'nfse-pdf',numero:n.numero,motivo:'Download não confirmado; preservar XML e tentar consultar o PDF depois, sem reemitir.'}); }
    if((pdfs+pendencias.length)%10===0)console.log(JSON.stringify({etapa:'PDFs fiscais',pdfs,pendencias:pendencias.length}));
  }
  console.log(JSON.stringify({concluido:true,notas:notas.length,pdfs,pendencias:pendencias.length}));
} else {
  // Retoma os registros já importados e acrescenta consultas até hoje, em janelas de 90 dias.
  // O início de 2006 é deliberado: não supor que o primeiro boleto salvo seja o primeiro da conta.
  const fim=new Date();let inicio=new Date('2006-01-01T00:00:00Z'),janelas=0,consultados=0;
  while(inicio<=fim){
    const final=new Date(Math.min(inicio.getTime()+89*86400000,fim.getTime()));
    const rs=await listarCobrancasInter({empresa:'sysney',dataInicial:inicio.toISOString().slice(0,10),dataFinal:final.toISOString().slice(0,10)});
    for(const r of rs){
      const codigo=r.cobranca?.codigoSolicitacao||r.codigoSolicitacao;
      if(typeof codigo!=='string'||!codigo)throw Error('Registro bancário sem identificador estável.');
      const json=JSON.stringify(r);if(Buffer.byteLength(json,'utf16le')>60000)throw Error('Registro bancário excede o limite.');
      // Merge preserva PDFs previamente importados. Atualiza só o histórico, não a fila operacional.
      await doc.upsertEntity({partitionKey:'inter-historico-sysney',rowKey:sha(codigo),json,atualizadoEm:new Date().toISOString()},'Merge');consultados++;
    }
    janelas++;if(janelas%10===0)console.log(JSON.stringify({etapa:'Consulta Inter',ate:final.toISOString().slice(0,10),janelas,registros:consultados}));
    inicio=new Date(final.getTime()+86400000);if(inicio<=fim)await new Promise(r=>setTimeout(r,1000));
  }
  let pdfs=0,registros=0;
  for await(const row of doc.listEntities({queryOptions:{filter:"PartitionKey eq 'inter-historico-sysney'"}})){
    registros++;const r=JSON.parse(row.json),codigo=r.cobranca?.codigoSolicitacao;
    try{
      if(row.pdfBlob){pdfs++;continue;}
      if(!codigo||!r.boleto?.nossoNumero)throw Error('Boleto sem identificador.');
      const retorno=await consultarCobrancaInter('sysney',codigo,true);
      if(typeof retorno.pdf!=='string'||retorno.pdf.length>7000000)throw Error('PDF inválido.');
      const bytes=validarPdf(Buffer.from(retorno.pdf,'base64'));
      const pdfBlob=await arquivar(bytes,'inter',`Boleto_${row.rowKey}-${sha(bytes).slice(0,12)}.pdf`,'application/pdf');
      await doc.updateEntity({partitionKey:row.partitionKey,rowKey:row.rowKey,pdfBlob},'Merge',{etag:row.etag});pdfs++;
    }catch{pendencias.push({tipo:'boleto-pdf',id:row.rowKey,motivo:'PDF histórico não disponibilizado ou download não confirmado; não reemitir.'});}
    if(registros%10===0)console.log(JSON.stringify({etapa:'PDFs Inter',registros,pdfs,pendencias:pendencias.length}));
    await new Promise(r=>setTimeout(r,1000));
  }
  console.log(JSON.stringify({concluido:true,janelas,registros,pdfs,pendencias:pendencias.length}));
}
await arquivar(Buffer.from(JSON.stringify({em:new Date().toISOString(),modo,coleta,pendencias},null,2)),'manifestos',`importacao-${modo}-${Date.now()}.json`,'application/json');
