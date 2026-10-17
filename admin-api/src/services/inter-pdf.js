import {consultarCobrancaInter} from "./inter.js";

// Recuperação exclusivamente GET; inclusive boletos pagos. Nunca emitir para obter PDF.
export async function recuperarPdfHistoricoInter(table,container,empresa,id,consultar=consultarCobrancaInter) {
  if(!["sysney","drsoft"].includes(empresa)||!/^[a-f0-9]{64}$/.test(id))throw Error("Empresa ou boleto inválido.");
  const partitionKey=`inter-historico-${empresa}`,row=await table.getEntity(partitionKey,id);
  const blob=`historico/${empresa}/inter/${id}.pdf`;
  if(row.pdfBlob===blob)return {existente:true};
  const c=JSON.parse(row.json).cobranca;
  if(!c?.codigoSolicitacao)throw Error("Boleto sem identificador bancário.");
  const r=await consultar(empresa,c.codigoSolicitacao,true);
  const bytes=Buffer.from(r.pdf||"","base64");
  if(bytes.length<20||bytes.length>5_000_000||bytes.subarray(0,5).toString()!=="%PDF-"||!bytes.subarray(-2048).includes(Buffer.from("%%EOF")))throw Error("O Inter não retornou PDF válido. Nenhum documento substituído.");
  await container.getBlockBlobClient(blob).uploadData(bytes,{blobHTTPHeaders:{blobContentType:"application/pdf"}});
  await table.updateEntity({partitionKey,rowKey:id,pdfBlob:blob,pdfRecuperadoEm:new Date().toISOString()},"Merge",{etag:row.etag});
  return {recuperado:true};
}
