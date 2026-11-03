import {createHash} from "node:crypto";
import type {TableClient} from "@azure/data-tables";
import {DefaultAzureCredential} from "@azure/identity";
import {BlobServiceClient} from "@azure/storage-blob";
import {XMLParser} from "fast-xml-parser";
import {createNationalAdminSequence,createNationalAdminQueue} from "../admin-api/src/services/national-admin-store.mjs";
import {inspectNationalXml} from "../admin-api/src/services/atp-authorized-xml.mjs";
import {validarDadosNacionais,montarDpsNacional,type DadosNacionais} from "./nfse-nacional";
import {hojeBrasil,type Cobranca} from "./cobrancas";
import type {EmailCobranca} from "./emails-cobranca";
type Empresa="sysney"|"drsoft";
type Ctx={email:EmailCobranca;cobranca:Cobranca;documento:string;idNota:string;row:{etag?:string};cr:{etag?:string}|null};
type Table=(nome?:string)=>TableClient;
const hash=(s:string|Buffer)=>createHash("sha256").update(s).digest("hex");
const get=async(t:TableClient,p:string,k:string)=>{try{return await t.getEntity<{json:string;em?:string;assinatura?:boolean;envio?:boolean}>(p,k);}catch(e){if((e as {statusCode?:number}).statusCode!==404)throw e;return null;}};
const workKey=(emp:Empresa,idNota:string,ambiente:string)=>hash(`${emp}:${idNota}:${ambiente}:nacional-admin-v1`);
function ambienteValido(v:unknown):"homologacao"|"producao"{if(v!=="homologacao"&&v!=="producao")throw Error("Ambiente nacional inválido.");return v;}
function por(req:Request){const p=req.headers.get("x-ms-client-principal");return p?String(JSON.parse(Buffer.from(p,"base64").toString()).userDetails||"Administrador").slice(0,254):"Administrador local";}
export async function statusNacional(table:Table,emp:Empresa,idNota:string,ambiente:string){
 ambienteValido(ambiente);
 const row=await get(table(),`nfse-nacional-trabalhos-${emp}`,workKey(emp,idNota,ambiente));
 const health=await get(table("FiscalFila"),"servico","nacional-admin");
 const age=health?Date.now()-Date.parse(String(health.em)):Infinity;
 const disponivel=age>=-30000&&age<180000&&health?.assinatura===true;
 return {trabalho:row?JSON.parse(row.json):null,disponivel,transmissaoDisponivel:disponivel&&health?.envio===true,producao:disponivel&&health?.envio===true&&process.env.NFSE_NACIONAL_PRODUCAO_HABILITADA==="true"};
}
export async function operarNacional({table,emp,ctx,body,req,regime}:{table:Table;emp:Empresa;ctx:Ctx;body:Record<string,unknown>;req:Request;regime:string}){
 const ambiente=ambienteValido(body.ambiente),id=workKey(emp,ctx.idNota,ambiente),part=`nfse-nacional-trabalhos-${emp}`;
 const {email,cobranca,documento}=ctx,workRow=await get(table(),part,id);
 let w=workRow?JSON.parse(workRow.json):null;
 const queue=createNationalAdminQueue(table("FiscalFila")),now=new Date().toISOString();
 const verificarEmitente=async(cnpj:string)=>{
  let configurado=process.env[`NFSE_${emp.toUpperCase()}_CNPJ`];
  if(!configurado){const r=await table("AdminConfiguracoes").getEntity<{cnpj:string}>("nfse-emitentes",emp);configurado=r.cnpj;}
  if(configurado!==cnpj)throw Error("O emitente mudou desde a preparação. Concilie os dados fiscais antes de continuar.");
 };
 let version=workRow?.etag;
 const guardar=async()=>{const json=JSON.stringify(w),ent={partitionKey:part,rowKey:id,json};const result=version?await table().updateEntity(ent,"Replace",{etag:version}):await table().createEntity(ent);version=result?.etag;if(!version){const saved=await get(table(),part,id);if(saved?.json!==json)throw Error("Estado fiscal mudou durante a operação.");version=saved.etag;}};
 const validarContexto=()=>{
  if(body.atualizadoEm!==email.atualizadoEm||!["rascunho","revisado"].includes(email.status)||email.fluxo?.nota||cobranca.nota||email.anexos.some(a=>a.tipo==="nota"))throw Error("Cobrança alterada, nota existente ou operação em andamento. Atualize e consulte.");
 };
 if(body.acao==="nacional-assinar"){
  validarContexto();if(body.confirmarSerie!==true)throw Error("Confirme a série DPS exclusiva, separada dos RPS municipais.");
  if(w)return {trabalho:w,mensagem:"DPS já reservada nesta cobrança e ambiente. Consulte a tentativa existente, sem reservar outra."};
  const municipal=await get(table(),`nfse-sp-${emp}`,ctx.idNota);if(municipal)throw Error("Há tentativa municipal. Concilie essa tentativa antes de trocar o emissor.");
  const p=await get(table(),`nfse-nacional-previas-${emp}`,ctx.idNota);if(!p)throw Error("Salve a prévia nacional primeiro.");
  const previa=JSON.parse(p.json),d:DadosNacionais=previa.dados;
  if(body.hash!==previa.hash||d.empresa!==emp||d.regime!==regime||d.documento!==documento||d.centavos!==email.centavos||d.cliente!==email.cliente||d.referencia!==email.competencia||d.descricao!==email.descricao+(email.po?`. PO ${email.po}`:"")||d.emissao!==hojeBrasil())throw Error("A prévia mudou ou expirou. Confira e salve novamente.");
  validarDadosNacionais(d,hojeBrasil());
  await verificarEmitente(d.cnpj);
  const health=await statusNacional(table,emp,ctx.idNota,ambiente);if(!health.disponivel)throw Error("Serviço nacional indisponível ou ainda não instalado. Nenhuma DPS reservada.");
  const emissao=new Date(Date.now()-3*3600000).toISOString().slice(0,19)+"-03:00";
  const assignment=await createNationalAdminSequence(table(),{cnpj:d.cnpj,ambiente}).reserve({workId:id,hash:previa.hash,serie:d.perfil.serie,emissao});
  const built=montarDpsNacional(d,assignment.numero,assignment.emissao,ambiente);
  w={id,idNota:ctx.idNota,empresa:emp,cnpj:d.cnpj,ambiente,emailId:email.id,emailDescricao:email.descricao,dados:d,hash:previa.hash,perfilHash:hash(JSON.stringify(d.perfil)),numero:assignment.numero,idDps:built.idDps,xml:built.xml,xmlHash:built.hash,status:"assinando",atualizadoEm:now};
  await guardar();
  w.jobId=await queue.enqueue({empresa:emp,ambiente,workId:id,hash:w.hash,acao:"assinar"});await guardar();
  return {trabalho:w,mensagem:"DPS reservada e enviada para assinatura e validação local. Nenhuma transmissão fiscal solicitada."};
 }
 if(!w||w.emailId!==email.id||w.empresa!==emp||w.ambiente!==ambiente)throw Error("Prepare e assine a DPS desta cobrança primeiro.");
 if(body.acao==="nacional-resultado"){
  if(!w.jobId)throw Error("Nenhuma tarefa registrada. Confira o serviço fiscal antes de continuar.");
  const job=await queue.get(w.jobId),payload=JSON.parse(String(job.pedido));
  if(payload.workId!==id||payload.hash!==w.hash||payload.empresa!==emp||payload.ambiente!==ambiente)throw Error("Resultado nacional não corresponde à tarefa.");
  const outcome=await queue.result(w.jobId);if(outcome.estado!=="concluido")return {trabalho:w,mensagem:"Serviço fiscal processando a tarefa. Consulte novamente; não repita a transmissão."};
  const r=outcome.result;
  if((payload.acao==="assinar"&&!["assinada","incerta"].includes(r.status))||(payload.acao!=="assinar"&&r.status==="assinada"))throw Error("Tipo de resultado incompatível com a tarefa nacional.");
  if(r.status==="assinada"){
   if(w.status!=="assinando"&&w.status!=="assinada")return {trabalho:w,mensagem:"Assinatura anterior já registrada. Consulte o estado atual."};
   const b=Buffer.from(r.signedXml,"base64");if(r.xmlHash!==w.xmlHash||hash(b)!==r.signedHash||b.length>1000000)throw Error("Assinatura retornada divergente.");
   w={...w,status:"assinada",signedXml:r.signedXml,signedHash:r.signedHash,atualizadoEm:now};await guardar();return {trabalho:w,mensagem:"DPS assinada e validada localmente. O número da NFS-e será conhecido somente após autorização oficial."};
  }
  if(r.status!=="confirmada"){
   w={...w,status:r.status==="rejeitada"?"rejeitada":"incerta",atualizadoEm:now};await guardar();return {trabalho:w,mensagem:"Transmissão não confirmada. Consulte a mesma DPS, sem emitir novamente."};
  }
  const xml=Buffer.from(r.xml,"base64"),fields=inspectNationalXml(xml,{environment:ambiente==="producao"?"production":"homologacao"});
  const dps=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false}).parse(xml.toString()).NFSe.infNFSe.DPS.infDPS;
  const original=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false}).parse(w.xml).DPS.infDPS;
  if(JSON.stringify(dps)!==JSON.stringify(original)||fields.issuerDocument!==w.cnpj||fields.recipientDocument!==documento||fields.amountCentsBRL!==w.dados.centavos||fields.competenceDate!==w.dados.competenciaFiscal||r.proof?.xmlHash!==hash(xml)||!r.proof.schemaValid||!r.proof.signatureValid||!r.proof.chainValid)throw Error("Documento oficial divergente ou não comprovado. Não vincular nem reemitir.");
  const conta=process.env.ADMIN_STORAGE_ACCOUNT||(process.env.NODE_ENV!=="production"?"sysneyadm2602":"");
  const container=new BlobServiceClient(`https://${conta}.blob.core.windows.net`,new DefaultAzureCredential()).getContainerClient("admin-anexos");
  const base=ambiente==="producao"?`historico/${emp}/nfse/nacional-${fields.authorityKey}`:`qa/nacional-admin/${emp}/${id}/${fields.authorityKey}`;
  const upload=async(path:string,bytes:Buffer,tipo:string)=>{const b=container.getBlockBlobClient(path);try{await b.uploadData(bytes,{conditions:{ifNoneMatch:"*"},blobHTTPHeaders:{blobContentType:tipo}});}catch(e){if(![409,412].includes((e as {statusCode?:number}).statusCode||0))throw e;const saved=await b.downloadToBuffer();if(hash(saved)!==hash(bytes))throw Error("Documento existente com conteúdo divergente.");}};
  await upload(base+".xml",xml,"application/xml");
  let pdf:Buffer|undefined;
  if(r.pdf){pdf=Buffer.from(r.pdf,"base64");if(pdf.length>5000000||pdf.length<100||pdf.subarray(0,5).toString()!=="%PDF-"||hash(pdf)!==r.pdfHash||!pdf.subarray(-1024).includes(Buffer.from("%%EOF")))throw Error("DANFSe não confirmado.");await upload(base+".pdf",pdf,"application/pdf");}
  w={...w,status:ambiente==="producao"?"emitida":"homologada",resultado:{numero:fields.number,chave:fields.authorityKey,xmlBlob:base+".xml",...(pdf?{pdfBlob:base+".pdf"}:{}),xmlHash:hash(xml),proof:r.proof},atualizadoEm:now};await guardar();
  if(ambiente==="homologacao"){
   if(pdf){const p=`nfse-nacional-homologacoes-${emp}`,ent={partitionKey:p,rowKey:w.perfilHash,json:JSON.stringify({perfilHash:w.perfilHash,cnpj:w.cnpj,workId:id,em:now,xmlHash:hash(xml),pdfHash:hash(pdf)})},old=await get(table(),p,w.perfilHash);if(old)await table().updateEntity(ent,"Replace",{etag:old.etag});else await table().createEntity(ent);}
   if(email.status==="emitindo_documento"&&email.atualizadoEm===w.emailBloqueadoEm){email.status="rascunho";email.atualizadoEm=now;await table().updateEntity({partitionKey:`emails-${emp}`,rowKey:email.id,json:JSON.stringify(email)},"Replace",{etag:ctx.row.etag});}
   return {trabalho:w,email,mensagem:pdf?"Documento de homologação confirmado, com XML e PDF privados. Nenhuma nota de produção ou e-mail emitido.":"Homologação retornou XML, mas o PDF ainda não foi recuperado. Consulte novamente para concluir."};
  }
  if(email.centavos!==w.dados.centavos||email.descricao!==w.emailDescricao||email.fluxo?.nota&&email.fluxo.nota!==fields.number||cobranca.nota&&cobranca.nota!==fields.number)throw Error("Cobrança alterada ou outra nota vinculada. Documento preservado para conciliação.");
  const dataEmissaoBrasil=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(fields.authorizedAtUtc));
  const hist={numero:fields.number,documento,cliente:email.cliente,emissao:dataEmissaoBrasil,autorizadaEmUtc:fields.authorizedAtUtc,centavos:fields.amountCentsBRL,situacao:"N",emissor:"nacional",chaveAcesso:fields.authorityKey,xmlBlob:base+".xml",...(pdf?{pdfBlob:base+".pdf"}:{}),consultadoEm:now};
  const hpart=`nfse-historico-${emp}`,hkey="N-"+fields.authorityKey,old=await get(table(),hpart,hkey),he={partitionKey:hpart,rowKey:hkey,json:JSON.stringify(hist)};if(old)await table().updateEntity(he,"Replace",{etag:old.etag});else await table().createEntity(he);
  if(!["aceito","enviando","incerto"].includes(email.status)){
   const anexo=email.anexos.find(a=>a.tipo==="nota");if(anexo&&anexo.blob!==base+".pdf")throw Error("Outra nota anexada. Concilie os documentos antes de substituir.");
   email.fluxo!.nota=fields.number;email.fluxo!.notaEmissor="nacional";email.fluxo!.notaChave=fields.authorityKey;delete email.fluxo!.documentos;delete email.aprovacaoEnvio;email.status="rascunho";email.atualizadoEm=now;
   if(pdf&&!anexo)email.anexos.push({tipo:"nota",nome:`NFSe_Nacional_${fields.number}.pdf`,blob:base+".pdf",tamanho:pdf.length});
   await table().updateEntity({partitionKey:`emails-${emp}`,rowKey:email.id,json:JSON.stringify(email)},"Replace",{etag:ctx.row.etag});
  }
  cobranca.nota=fields.number;cobranca.notaEmissor="nacional";cobranca.notaChave=fields.authorityKey;cobranca.persistida=true;
  if(!cobranca.eventos.some(e=>e.id===id))cobranca.eventos.push({id,tipo:"documentos",data:hojeBrasil(),registradoEm:now,responsavel:"Sistema — NFS-e Nacional",detalhe:`NFS-e nacional ${fields.number} confirmada; chave ${fields.authorityKey}. ${pdf?"PDF anexado.":"PDF pendente de recuperação."} Nenhum e-mail enviado.`});
  const ce={partitionKey:`cobrancas-${emp}`,rowKey:cobranca.id,json:JSON.stringify(cobranca)};if(ctx.cr)await table().updateEntity(ce,"Replace",{etag:ctx.cr.etag});else await table().createEntity(ce);
  return {trabalho:w,email,mensagem:pdf?"NFS-e nacional vinculada, com XML e PDF recuperados. Confira e aprove o envio separadamente.":"Nota nacional vinculada. Consulte novamente para recuperar o PDF, sem reemitir."};
 }
 if(body.acao==="nacional-consultar"){
  if(w.status==="transmitindo"&&Date.now()-Date.parse(w.atualizadoEm)<180000)throw Error("Transmissão em andamento. Consulte o resultado da tarefa antes de iniciar outra consulta.");
  w.jobId=await queue.enqueue({empresa:emp,ambiente,workId:id,hash:w.hash,acao:"consultar"});w.atualizadoEm=now;await guardar();return {trabalho:w,mensagem:"Consulta da mesma DPS solicitada. Nenhuma nova emissão."};
 }
 if(body.acao!=="nacional-emitir")throw Error("Operação nacional inválida.");
 validarContexto();
 await verificarEmitente(w.cnpj);
 if(body.aprovado!==true||body.hash!==w.hash||w.status!=="assinada"||w.aprovacao||w.dados.regime!==regime||w.dados.emissao!==hojeBrasil()||w.dados.centavos!==email.centavos||w.emailDescricao!==email.descricao)throw Error("Confira a DPS assinada atual e aprove a transmissão explicitamente.");
 if(await get(table(),`nfse-sp-${emp}`,ctx.idNota))throw Error("Tentativa municipal existente. Concilie antes de transmitir no nacional.");
 const policyRow=await get(table("AdminConfiguracoes"),"nfse-nacional-politicas",emp),policy=policyRow?JSON.parse(policyRow.json):null;
 if(!policy||policy.cnpj!==w.cnpj||!Array.isArray(policy.perfis)||!policy.perfis.includes(w.perfilHash)||policy[ambiente]!==true)throw Error("Perfil nacional ainda não liberado na política protegida deste emitente.");
 if(ambiente==="producao"){
  if(process.env.NFSE_NACIONAL_PRODUCAO_HABILITADA!=="true")throw Error("Produção nacional bloqueada até homologação e implantação aprovadas.");
  const homolog=await get(table(),`nfse-nacional-homologacoes-${emp}`,w.perfilHash);if(!homolog||JSON.parse(homolog.json).cnpj!==w.cnpj)throw Error("Este perfil ainda não concluiu homologação com XML e PDF confirmados.");
  if(regime==="presumido"&&policy.habilitacaoPresumidoConfirmada!==true)throw Error("Habilitação nacional do Lucro Presumido ainda não confirmada.");
 }
 w.status="transmitindo";w.aprovacao={hash:w.hash,em:now,por:por(req)};w.emailBloqueadoEm=now;w.atualizadoEm=now;
 const current=await get(table(),part,id);if(current?.etag!==workRow?.etag)throw Error("Prévia nacional mudou. Atualize antes de transmitir.");await guardar();
 email.status="emitindo_documento";email.atualizadoEm=now;delete email.aprovacaoEnvio;delete email.fluxo!.documentos;
 await table().updateEntity({partitionKey:`emails-${emp}`,rowKey:email.id,json:JSON.stringify(email)},"Replace",{etag:ctx.row.etag});
 w.jobId=await queue.enqueue({empresa:emp,ambiente,workId:id,hash:w.hash,acao:"emitir"});await guardar();
 return {trabalho:w,email,mensagem:"Transmissão nacional aprovada e registrada. Aguarde o resultado; não repita a emissão. Nenhum e-mail enviado."};
}
