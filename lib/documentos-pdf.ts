import {DefaultAzureCredential} from "@azure/identity";
import {TableClient} from "@azure/data-tables";
import {BlobServiceClient} from "@azure/storage-blob";
import type {EmailCobranca} from "./emails-cobranca";
import type {TrabalhoSP} from "./nfse-sp";
import {hojeBrasil,type Cobranca,type Plano} from "./cobrancas";

export function validarPdfOficial(bytes:Buffer) {
  if(bytes.length<100||bytes.length>5000000||!bytes.subarray(0,5).equals(Buffer.from("%PDF-"))||!bytes.subarray(-1024).includes(Buffer.from("%%EOF")))throw Error("PDF oficial ainda não disponível ou arquivo inválido. Tente baixar novamente, sem emitir outro documento.");
  return bytes;
}
export function urlPdfNotaSP(inscricao:string,numero:string,verificacao:string) {
  if(!/^\d{8,12}$/.test(inscricao)||!/^\d{1,12}$/.test(numero)||! /^[A-Z0-9]{8}$/.test(verificacao))throw Error("Identificação da nota não confirmada. Consulte o RPS antes de baixar.");
  const url=new URL("https://nfe.prefeitura.sp.gov.br/contribuinte/notaprintpdf.aspx");
  url.search=new URLSearchParams({nf:numero,inscricao,verificacao}).toString();
  return url;
}
export async function baixarPdfNotaSP(inscricao:string,numero:string,verificacao:string):Promise<Buffer> {
  const r=await fetch(urlPdfNotaSP(inscricao,numero,verificacao),{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(30000),headers:{Accept:"application/pdf"}});
  if(!r.ok||!r.headers.get("content-type")?.toLowerCase().includes("application/pdf")||Number(r.headers.get("content-length"))>5000000)throw Error("A Prefeitura não disponibilizou o PDF. Tente baixar novamente; a nota já emitida será preservada.");
  const reader=r.body?.getReader();if(!reader)throw Error("PDF sem conteúdo. Tente baixar novamente.");
  const chunks:Buffer[]=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5000000)throw Error("PDF excede o limite permitido.");chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
  return validarPdfOficial(Buffer.concat(chunks));
}
export function conferirNotaParaPdf(email:EmailCobranca,trabalho:TrabalhoSP) {
  const d=trabalho.dados,r=trabalho.resultado;
  if(trabalho.emailId!==email.id||d.empresa!==email.empresa||trabalho.status!=="emitida"||!r?.sucesso||r.teste||!r.numero||!r.verificacao||r.numero!==email.fluxo?.nota||r.inscricao!==d.inscricao||r.tomador!==d.clienteDocumento||Math.round(Number(r.valorFinal)*100)!==d.centavos||r.descricao?.replaceAll("\r\n","\n")!==d.descricao+(d.po?`\nPO ${d.po}`:"")||d.centavos!==email.centavos||d.competencia!==email.competencia||d.descricao!==email.descricao||d.po!==(email.po||""))throw Error("Nota e cobrança não correspondem ao registro fiscal confirmado. Consulte o RPS e confira os dados antes de anexar.");
  return r;
}
export async function recuperarPdfNotaSP(empresa:"sysney"|"drsoft",id:string,atualizadoEm?:string) {
  const conta=process.env.ADMIN_STORAGE_ACCOUNT||(process.env.NODE_ENV!=="production"?"sysneyadm2602":"");
  const cred=new DefaultAzureCredential(),table=(nome="AdminDocumentos")=>new TableClient(`https://${conta}.table.core.windows.net`,nome,cred);
  const row=await table().getEntity<{json:string}>(`emails-${empresa}`,id),email:EmailCobranca=JSON.parse(row.json);
  if(email.empresa!==empresa||!email.fluxo||!["rascunho","revisado"].includes(email.status))throw Error("Abra uma cobrança não enviada com nota já confirmada.");
  if(atualizadoEm&&atualizadoEm!==email.atualizadoEm)throw Error("A cobrança mudou. Atualize antes de baixar o PDF.");
  const cr=await table().getEntity<{json:string}>(`cobrancas-${empresa}`,email.fluxo.cobrancaId),c:Cobranca=JSON.parse(cr.json);
  const plano:Plano=JSON.parse((await table("AdminConfiguracoes").getEntity<{json:string}>(`cobrancas-${empresa}`,c.planoId)).json);
  const {createHash}=await import("node:crypto");
  const chave=createHash("sha256").update(`${plano.documento.replace(/\D/g,"")}:${email.competencia}`).digest("hex");
  const trabalho:TrabalhoSP=JSON.parse((await table().getEntity<{json:string}>(`nfse-sp-${empresa}`,chave)).json);
  const nota=conferirNotaParaPdf(email,trabalho);
  if(c.nota!==nota.numero||c.centavos!==email.centavos||c.competencia!==email.competencia)throw Error("Nota diferente da cobrança registrada.");
  const blob=`${empresa}/emails/${id}/nfse-sp-${trabalho.id}-${nota.numero}.pdf`,anexo=email.anexos.find(a=>a.tipo==="nota");
  async function registrarDownload() {
    const evento=`pdf-${trabalho.id}-${nota.numero}`;
    if(c.eventos.some(x=>x.id===evento))return;
    c.eventos.push({id:evento,tipo:"documentos",data:hojeBrasil(),registradoEm:new Date().toISOString(),responsavel:"Sistema — Prefeitura SP",detalhe:`PDF oficial da NFS-e ${nota.numero} baixado e anexado à cobrança. Nenhuma nova emissão ou envio de e-mail.`});
    await table().updateEntity({partitionKey:`cobrancas-${empresa}`,rowKey:c.id,json:JSON.stringify(c)},"Replace",{etag:cr.etag});
  }
  if(anexo&&anexo.blob!==blob)throw Error("Há outra nota anexada. Confira e remova o anexo incorreto antes de recuperar o PDF oficial.");
  if(anexo){await registrarDownload();return {email,mensagem:"PDF oficial da nota já anexado. Abra o documento para conferir."};}
  const bytes=await baixarPdfNotaSP(trabalho.dados.inscricao,nota.numero!,nota.verificacao!);
  await new BlobServiceClient(`https://${conta}.blob.core.windows.net`,cred).getContainerClient("admin-anexos").getBlockBlobClient(blob).uploadData(bytes,{blobHTTPHeaders:{blobContentType:"application/pdf"}});
  const em=new Date().toISOString();
  email.anexos.push({tipo:"nota",nome:`NFSe_${trabalho.dados.inscricao}_${nota.numero}.pdf`,blob,tamanho:bytes.length});
  delete email.fluxo.documentos;delete email.aprovacaoEnvio;email.status="rascunho";email.atualizadoEm=em;
  await table().updateEntity({partitionKey:`emails-${empresa}`,rowKey:id,json:JSON.stringify(email)},"Replace",{etag:row.etag});
  // Só registrar como anexado depois de vencer a concorrência com revisão/envio.
  await registrarDownload();
  return {email,mensagem:`PDF oficial da nota ${nota.numero} baixado e anexado. Confira os documentos e aprove o envio separadamente.`};
}
