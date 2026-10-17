import {DefaultAzureCredential} from "@azure/identity";
import {TableClient} from "@azure/data-tables";
import {BlobServiceClient} from "@azure/storage-blob";
import {listarCobrancasInter,consultarCobrancaInter} from "../src/services/inter.js";
import {normalizarSnapshot} from "../src/services/inter-sync.js";
import {cruzarNotas} from "../src/services/conciliacao-inter.js";
import {recuperarPdfHistoricoInter} from "../src/services/inter-pdf.js";

const [empresa,inicial,final]=process.argv.slice(2);
const valida=v=>/^20\d{2}-\d{2}-\d{2}$/.test(v||"")&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
if(!["sysney","drsoft"].includes(empresa)||!valida(inicial)||!valida(final)||inicial>final)throw Error("Uso: empresa data-inicial data-final. Operação somente leitura no banco.");
const conta=process.env.ADMIN_STORAGE_ACCOUNT;if(!conta)throw Error("Armazenamento não configurado.");
const cred=new DefaultAzureCredential(),table=new TableClient(`https://${conta}.table.core.windows.net`,"AdminDocumentos",cred);
const container=new BlobServiceClient(`https://${conta}.blob.core.windows.net`,cred).getContainerClient("admin-anexos");
let total=0,pdfs=0,pendentes=0;
for(let inicio=Date.parse(inicial);inicio<=Date.parse(final);){
 const fim=Math.min(inicio+89*86400000,Date.parse(final));
 const lista=await listarCobrancasInter({empresa,dataInicial:new Date(inicio).toISOString().slice(0,10),dataFinal:new Date(fim).toISOString().slice(0,10)});
 for(const item of lista){
  const codigo=item.cobranca?.codigoSolicitacao;
  if(!codigo)throw Error("Histórico incompleto; consulta interrompida sem inferir quitação.");
  const detalhe=item.boleto?.nossoNumero?item:await consultarCobrancaInter(empresa,codigo);
  const snapshot=normalizarSnapshot(detalhe,empresa);
  // Merge preserva PDF, vínculo fiscal e todos os eventos manuais em suas partições.
  await table.upsertEntity(snapshot,"Merge");total++;
  try{await recuperarPdfHistoricoInter(table,container,empresa,snapshot.rowKey);pdfs++;}catch{pendentes++;}
  await new Promise(r=>setTimeout(r,1000));
 }
 console.log(JSON.stringify({empresa,inicio:new Date(inicio).toISOString().slice(0,10),fim:new Date(fim).toISOString().slice(0,10),consultadas:lista.length,total,pdfs,pdfsPendentes:pendentes}));
 inicio=fim+86400000;await new Promise(r=>setTimeout(r,1500));
}
const notas=await cruzarNotas(table,"Importação histórica autorizada",empresa);
console.log(JSON.stringify({empresa,total,pdfs,pdfsPendentes:pendentes,notasVinculadas:notas.vinculadas,emissoes:0,cancelamentos:0,envios:0}));
