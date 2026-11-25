import {createHash} from "node:crypto";
import {BlobServiceClient} from "@azure/storage-blob";
import {DefaultAzureCredential} from "@azure/identity";
import type {TableClient} from "@azure/data-tables";
import {baixarPdfNotaSP,conferirNotaParaPdf} from "./documentos-pdf";
import {particaoDocumentoFiscal,particaoControleFiscal,type ContextoFiscal} from "./contexto-fiscal";
import type {Empresa,Cobranca} from "./cobrancas";
import type {EmailCobranca} from "./emails-cobranca";
import type {TrabalhoSP} from "./nfse-sp";

export async function recuperarPdfRegularizacao(table:(nome?:string)=>TableClient,emp:Empresa,ctx:ContextoFiscal,trabalho:TrabalhoSP){
  if(ctx.origem!=="regularizacao")throw Error("Contexto documental inválido.");
  const row=await table().getEntity<{json:string}>(particaoDocumentoFiscal(emp,ctx),ctx.email.id),email:EmailCobranca=JSON.parse(row.json);
  const nota=conferirNotaParaPdf(email,trabalho);
  const conta=process.env.ADMIN_STORAGE_ACCOUNT||(process.env.NODE_ENV!=="production"?"sysneyadm2602":"");
  const container=new BlobServiceClient(`https://${conta}.blob.core.windows.net`,new DefaultAzureCredential()).getContainerClient("admin-anexos");
  const base=`historico/${emp}/nfse/regularizacao-${trabalho.id}-${nota.numero}`;
  const upload=async(path:string,bytes:Buffer,tipo:string)=>{
    const blob=container.getBlockBlobClient(path);
    try{await blob.uploadData(bytes,{conditions:{ifNoneMatch:"*"},blobHTTPHeaders:{blobContentType:tipo}});}
    catch(e){if(![409,412].includes((e as {statusCode?:number}).statusCode||0))throw e;if(createHash("sha256").update(await blob.downloadToBuffer()).digest("hex")!==createHash("sha256").update(bytes).digest("hex"))throw Error("Documento já armazenado diverge da consulta fiscal.");}
  };
  await upload(base+"-consulta.xml",Buffer.from(nota.xml),"application/xml");
  if(!email.anexos.some(a=>a.tipo==="nota")){
    const pdf=await baixarPdfNotaSP(trabalho.dados.inscricao,nota.numero!,nota.verificacao!);
    await upload(base+".pdf",pdf,"application/pdf");
    email.anexos.push({tipo:"nota",nome:`NFSe_${nota.numero}.pdf`,blob:base+".pdf",tamanho:pdf.length});email.atualizadoEm=new Date().toISOString();
    await table().updateEntity({partitionKey:particaoDocumentoFiscal(emp,ctx),rowKey:email.id,json:JSON.stringify(email)},"Replace",{etag:row.etag});
  }
  const cr=await table().getEntity<{json:string}>(particaoControleFiscal(emp,ctx),ctx.cobranca.id),controle:Cobranca=JSON.parse(cr.json);
  if(controle.nota!==nota.numero)throw Error("Vínculo documental mudou. Consulte antes de continuar.");
  return {email,mensagem:"Nota e PDF vinculados ao recebimento já pago. Nenhuma nova cobrança ou mensagem criada."};
}
