import {prepararNacional} from "@/lib/nfse-nacional-preparacao";
import {operarMunicipal} from "@/lib/nfse-municipal-runtime";
import {NextRequest,NextResponse} from "next/server";
import {TableClient} from "@azure/data-tables";
import {DefaultAzureCredential} from "@azure/identity";
import {BlobServiceClient} from "@azure/storage-blob";
import {usuarioAdministrador} from "../_auth";
import {encaminharAdmin} from "../_remote";
import {hojeBrasil,prevista,type Plano,type Cobranca} from "@/lib/cobrancas";
import type {EmailCobranca} from "@/lib/emails-cobranca";
import {chaveTrabalhoFiscalSP,type TrabalhoSP} from "@/lib/nfse-sp";
import {executorMunicipalDisponivel} from "@/lib/nfse-sp-executor";
import {perfilFiscalDoXml,orientacaoEmissor} from "@/lib/perfil-fiscal-historico";
import {statusNacional,operarNacional} from "@/lib/nfse-nacional-runtime";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const cred=new DefaultAzureCredential();
const table=(nome="AdminDocumentos")=>new TableClient(`https://${process.env.ADMIN_STORAGE_ACCOUNT||(process.env.NODE_ENV!=="production"?"sysneyadm2602":"")}.table.core.windows.net`,nome,cred);
const reply=(d:unknown,status=200)=>NextResponse.json(d,{status,headers:{"Cache-Control":"no-store"}});
function empresa(req:NextRequest){const emp=req.nextUrl.searchParams.get("empresa");if(emp!=="drsoft"&&emp!=="sysney")throw Error("Empresa inválida.");return emp;}
async function opcional<T extends object>(part:string,id:string,nome="AdminDocumentos") {try{return await table(nome).getEntity<T>(part,id);}catch(e){if((e as {statusCode?:number}).statusCode!==404)throw e;return null;}}
async function contexto(emp:"sysney"|"drsoft",id:unknown){
  if(typeof id!=="string"||!/^[a-f0-9-]{36}$/.test(id))throw Error("Cobrança inválida.");
  const row=await table().getEntity<{json:string}>(`emails-${emp}`,id),email:EmailCobranca=JSON.parse(row.json);
  if(email.empresa!==emp||!email.fluxo||!/^[a-f0-9]{64}_20\d{2}-(0[1-9]|1[0-2])$/.test(email.fluxo.cobrancaId))throw Error("Selecione uma cobrança vinculada à fila.");
  const [planoId,competencia]=email.fluxo.cobrancaId.split("_");
  const plano:Plano=JSON.parse((await table("AdminConfiguracoes").getEntity<{json:string}>(`cobrancas-${emp}`,planoId)).json);
  if(competencia<plano.inicio||(plano.fim&&competencia>plano.fim))throw Error("Competência fora do plano.");
  const cr=await opcional<{json:string}>(`cobrancas-${emp}`,email.fluxo.cobrancaId);
  const cobranca:Cobranca=cr?JSON.parse(cr.json):prevista(plano,competencia);
  const documento=plano.documento.replace(/\D/g,"");
  if(email.competencia!==cobranca.competencia||email.centavos!==cobranca.centavos||email.vencimento!==cobranca.vencimento)throw Error("Dados do e-mail diferentes da cobrança. Confira antes de emitir.");
  // Planos avulsos são identificados pela cobrança, sem colidir com a mensalidade.
  // Planos legados preservam a chave anterior e suas travas de transmissão.
  const idNota=chaveTrabalhoFiscalSP(documento,competencia,cobranca.id,plano.avulsa===true);
  return {row,email,cobranca,cr,documento,idNota};
}
function falha(e:unknown){const code=(e as {statusCode?:number}).statusCode;return reply({erro:code===409||code===412?"A versão mudou ou a operação já está em andamento. Atualize e consulte antes de repetir.":code?"Não foi possível acessar o registro fiscal.":e instanceof Error?e.message:"Falha fiscal."},code===409||code===412?409:code?503:400);}
type HistoricoRegime={regime:"simples"|"presumido";vigencia:string;em:string;por:string};
async function regimeEmpresa(emp:string){
  const row=await opcional<{json:string}>("nfse-regimes",emp,"AdminConfiguracoes");
  const historico:HistoricoRegime[]=row?JSON.parse(row.json).historico:[];
  const vigente=historico.filter(x=>x.vigencia<=hojeBrasil()).sort((a,b)=>b.vigencia.localeCompare(a.vigencia))[0];
  return {row,historico,vigente};
}
async function sugerirPerfilHistorico(emp:string,documento:string,regime:"simples"|"presumido") {
  const emitente=await opcional<{cnpj:string;inscricao:string}>("nfse-emitentes",emp,"AdminConfiguracoes");
  if(!emitente)return null;
  const candidatas:{numero:string;documento:string;emissao:string;situacao:string;xmlBlob:string}[]=[];
  for await(const row of table().listEntities<{json:string}>({queryOptions:{filter:`PartitionKey eq 'nfse-historico-${emp}'`,select:["json"]}})){
    const n=JSON.parse(row.json);
    if(n.documento===documento&&n.situacao==="N"&&/^\d{1,15}$/.test(n.numero)&&typeof n.emissao==="string"&&typeof n.xmlBlob==="string"&&n.xmlBlob.startsWith(`historico/${emp}/nfse/`))candidatas.push(n);
  }
  candidatas.sort((a,b)=>b.emissao.localeCompare(a.emissao)||Number(b.numero)-Number(a.numero));
  const nota=candidatas[0];if(!nota)return null;
  const conta=process.env.ADMIN_STORAGE_ACCOUNT||(process.env.NODE_ENV!=="production"?"sysneyadm2602":"");
  const blob=new BlobServiceClient(`https://${conta}.blob.core.windows.net`,cred).getContainerClient("admin-anexos").getBlobClient(nota.xmlBlob);
  const properties=await blob.getProperties();if(!properties.contentLength||properties.contentLength>100000)throw Error("XML histórico fora do limite.");
  const bytes=await blob.downloadToBuffer(0,properties.contentLength,{conditions:{ifMatch:properties.etag}});
  return perfilFiscalDoXml(bytes.toString("utf8"),{numero:nota.numero,documento,cnpj:process.env[`NFSE_${emp.toUpperCase()}_CNPJ`]||emitente.cnpj,inscricao:process.env[`NFSE_${emp.toUpperCase()}_CCM`]||emitente.inscricao,regime,hoje:hojeBrasil()});
}
export async function GET(req:NextRequest){
  const remote=await encaminharAdmin(req);if(remote)return remote;
  if(!usuarioAdministrador(req))return reply({erro:"Não autorizado."},401);
  try{
    const emp=empresa(req),id=req.nextUrl.searchParams.get("id");
    if(req.nextUrl.searchParams.get("emissor")==="nacional"){
      const c=await contexto(emp,id),regime=await regimeEmpresa(emp);
      const perfil=await opcional<{json:string}>(`nfse-nacional-perfis-${emp}`,c.documento,"AdminConfiguracoes");
      const previa=await opcional<{json:string}>(`nfse-nacional-previas-${emp}`,c.idNota);
      return reply({perfil:perfil?JSON.parse(perfil.json):null,previa:previa?JSON.parse(previa.json):null,regime:regime.vigente?.regime||null,...await statusNacional(table,emp,c.idNota,req.nextUrl.searchParams.get("ambiente")||"homologacao"),mensagem:"Preparação nacional separada do municipal. Transmissão depende de homologação, política do emitente e aprovação específica. Salvar a prévia não emite nota."});
    }
    if(req.nextUrl.searchParams.get("pgdas")==="1"){
      const mes=req.nextUrl.searchParams.get("mes");
      if(mes){
        if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(mes))throw Error("Mês inválido.");
        const row=await table().getEntity<{json:string}>(`pgdas-${emp}`,mes),a=JSON.parse(row.json);
        if(typeof a.blob!=="string"||!a.blob.startsWith(`historico/${emp}/pgdas/`))throw Error("Documento inválido.");
        const conta=process.env.ADMIN_STORAGE_ACCOUNT||(process.env.NODE_ENV!=="production"?"sysneyadm2602":"");
        const bytes=await new BlobServiceClient(`https://${conta}.blob.core.windows.net`,cred).getContainerClient("admin-anexos").getBlockBlobClient(a.blob).downloadToBuffer();
        return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="PGDAS_${mes}.pdf"`,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
      }
      const apuracoes=[];
      for await(const row of table().listEntities<{json:string}>({queryOptions:{filter:`PartitionKey eq 'pgdas-${emp}'`}})){
        const a=JSON.parse(row.json);apuracoes.push({mes:a.mes,declaracao:a.declaracao,receita:a.receita,debito:a.debito,rbt12:a.rbt12,rbt12p:a.rbt12p,regime:a.regime,atividade:a.atividade,importadoEm:a.importadoEm});
      }
      return reply({apuracoes:apuracoes.sort((a,b)=>a.mes.localeCompare(b.mes))});
    }
    if(req.nextUrl.searchParams.get("historico")==="1"){
      const numero=req.nextUrl.searchParams.get("numero"),arquivo=req.nextUrl.searchParams.get("arquivo"),chave=req.nextUrl.searchParams.get("chave");
      if((numero||chave) && arquivo){
        if((chave?!/^\d{50}$/.test(chave):!/^\d{1,15}$/.test(numero||""))||!["xml","pdf"].includes(arquivo))throw Error("Arquivo fiscal inválido.");
        const row=await table().getEntity<{json:string}>(`nfse-historico-${emp}`,chave?`N-${chave}`:String(Number(numero)));
        const nota=JSON.parse(row.json),blob=arquivo==="xml"?nota.xmlBlob:nota.pdfBlob;
        if(typeof blob!=="string"||!blob.startsWith(`historico/${emp}/nfse/`))return reply({erro:"Arquivo ainda não importado."},404);
        const conta=process.env.ADMIN_STORAGE_ACCOUNT||(process.env.NODE_ENV!=="production"?"sysneyadm2602":"");
        const bytes=await new BlobServiceClient(`https://${conta}.blob.core.windows.net`,cred).getContainerClient("admin-anexos").getBlockBlobClient(blob).downloadToBuffer();
        return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":arquivo==="xml"?"application/xml; charset=utf-8":"application/pdf","Content-Disposition":`attachment; filename="NFSe_${chave||numero}.${arquivo}"`,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
      }
      const notas=[];
      for await(const row of table().listEntities<{json:string}>({queryOptions:{filter:`PartitionKey eq 'nfse-historico-${emp}'`}})){
        const n=JSON.parse(row.json);
        notas.push({numero:n.numero,documento:n.documento,cliente:n.cliente,emissao:n.emissao,centavos:n.centavos,situacao:n.situacao,tributos:n.tributos,emissor:n.emissor,chaveAcesso:n.chaveAcesso,xml:!!n.xmlBlob,pdf:!!n.pdfBlob,consultadoEm:n.consultadoEm});
      }
      return reply({notas:notas.sort((a,b)=>b.emissao.localeCompare(a.emissao))});
    }
    let trabalho:TrabalhoSP|null=null,perfil=null,retencoes=null,perfilAviso="",orientacao=null;
    const regime=await regimeEmpresa(emp);
    if(id){
      const c=await contexto(emp,id),r=await opcional<{json:string}>(`nfse-sp-${emp}`,c.idNota);if(r)trabalho=JSON.parse(r.json);
      const p=await opcional<{json:string}>(`nfse-perfil-${emp}`,c.documento,"AdminConfiguracoes");if(p)perfil=JSON.parse(p.json);
      const t=await opcional<{json:string}>(`nfse-retencoes-${emp}`,c.documento,"AdminConfiguracoes");if(t)retencoes=JSON.parse(t.json);
      if(!p&&!trabalho&&regime.vigente)try{perfil=await sugerirPerfilHistorico(emp,c.documento,regime.vigente.regime);}catch{perfilAviso="Não foi possível validar o XML mais recente deste cliente. Confira os dados fiscais antes de preparar; nenhum dado de outro emitente será utilizado.";}
      orientacao=orientacaoEmissor(regime.vigente?.regime||"",c.email.competencia,hojeBrasil());
    }
    return reply({local:executorMunicipalDisponivel(),remoto:process.env.NFSE_SP_WORKER_HABILITADO==="true",producao:executorMunicipalDisponivel()&&(process.env.NFSE_SP_WORKER_HABILITADO!=="true"||process.env.NFSE_SP_VM_PRODUCAO_HABILITADA==="true")&&process.env.NFSE_SP_PRODUCAO_HABILITADA==="true",trabalho,perfil,perfilAviso,orientacao,retencoes,historicoRegime:regime.historico,regime:regime.vigente||null,mensagem:"Integração municipal: prepare e teste sem emitir. Produção requer teste aprovado e autorização separada. PDF ainda deve ser obtido no portal e anexado; nenhum e-mail é enviado."});
  }catch(e){return falha(e);}
}
export async function POST(req:NextRequest){
  const remote=await encaminharAdmin(req);if(remote)return remote;
  if(!usuarioAdministrador(req))return reply({erro:"Não autorizado."},401);
  if(req.headers.get("origin")!==req.nextUrl.origin)return reply({erro:"Origem inválida."},403);
  try{
    const emp=empresa(req),raw=await req.text();if(raw.length>10000)throw Error("Solicitação muito grande.");
    const body=JSON.parse(raw);
    if(["nacional-assinar","nacional-emitir","nacional-consultar","nacional-resultado"].includes(body.acao)){
      const ctx=await contexto(emp,body.id),regime=(await regimeEmpresa(emp)).vigente?.regime||"";
      return reply(await operarNacional({table,emp,ctx,body,req,regime}));
    }
    if(body.acao==="nacional-preparar"){
      return reply(await prepararNacional({table,emp,c:await contexto(emp,body.id),body,regime:(await regimeEmpresa(emp)).vigente?.regime||""}));
    }
    if(!["configurarRegime","preparar","testar","emitir","consultar"].includes(body.acao))throw Error("Operação fiscal inválida.");
    const ctx=await contexto(emp,body.id);
    if(body.acao==="configurarRegime"){
      if(body.confirmado!==true||!["simples","presumido"].includes(body.regime)||typeof body.vigencia!=="string"||!/^20\d{2}-\d{2}-\d{2}$/.test(body.vigencia)||!Number.isFinite(Date.parse(body.vigencia))||new Date(body.vigencia).toISOString().slice(0,10)!==body.vigencia)throw Error("Confirme o regime e a data de início da vigência.");
      const cfg=await regimeEmpresa(emp);
      if(cfg.historico.some(x=>x.vigencia===body.vigencia))throw Error("Já existe regime nessa data. Use nova vigência para preservar o histórico.");
      const principal=req.headers.get("x-ms-client-principal");
      const por=principal?String(JSON.parse(Buffer.from(principal,"base64").toString("utf8")).userDetails||"Administrador").slice(0,254):"Administrador local";
      const historico=[...cfg.historico,{regime:body.regime,vigencia:body.vigencia,por,em:new Date().toISOString()}];
      const ent={partitionKey:"nfse-regimes",rowKey:emp,json:JSON.stringify({historico})};
      if(cfg.row)await table("AdminConfiguracoes").updateEntity(ent,"Replace",{etag:cfg.row.etag});else await table("AdminConfiguracoes").createEntity(ent);
      return reply({regime:(await regimeEmpresa(emp)).vigente||null,mensagem:"Regime salvo com vigência. Notas anteriores não foram alteradas. Prepare e teste novamente as próximas notas."});
    }
    return reply(await operarMunicipal({table,emp,ctx,body,req,regime:(await regimeEmpresa(emp)).vigente?.regime||""}));
  }catch(e){return falha(e);}
}
