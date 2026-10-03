import {NextRequest,NextResponse} from "next/server";
import {DefaultAzureCredential} from "@azure/identity";
import {TableClient} from "@azure/data-tables";
import {BlobServiceClient} from "@azure/storage-blob";
import {createHash,randomUUID} from "node:crypto";
import {usuarioAdministrador} from "../_auth";
import {encaminharAdmin} from "../_remote";
import {prevista,hojeBrasil,type Cobranca,type Plano} from "@/lib/cobrancas";
import type {EmailCobranca} from "@/lib/emails-cobranca";
import {conferirDadosBoleto,hashDadosBoleto,montarPayloadBoleto,type PagadorBoleto,type PreviaBoleto} from "@/lib/boleto-painel";
import {consultarCobrancaInter,emitirCobrancaInter,listarCobrancasInter} from "@/admin-api/src/services/inter.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const cred=new DefaultAzureCredential();
const conta=()=>process.env.ADMIN_STORAGE_ACCOUNT || (process.env.NODE_ENV!=="production"?"sysneyadm2602":"");
const tabela=(nome="AdminDocumentos")=>new TableClient(`https://${conta()}.table.core.windows.net`,nome,cred);
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
function empresa(req:NextRequest) {const e=req.nextUrl.searchParams.get("empresa");if(e!=="sysney"&&e!=="drsoft")throw new Error("Empresa inválida.");return e;}
async function opcional<T extends object>(part:string,id:string,nome="AdminDocumentos") {
  try{return await tabela(nome).getEntity<T>(part,id);}catch(e){if((e as {statusCode?:number}).statusCode!==404)throw e;return null;}
}
async function habilitada(emp:string) {return emp==="sysney" && (await opcional<{ativo:boolean}>("emissao-boleto","sysney","AdminConfiguracoes"))?.ativo===true;}
function falha(e:unknown) {const code=(e as {statusCode?:number}).statusCode;return reply({erro:code===409||code===412?"A operação já existe ou a versão mudou. Consulte o resultado; não repita a emissão.":code?"Não foi possível consultar os dados. Atualize o resultado antes de repetir.":e instanceof Error?e.message:"Operação inválida."},code===409||code===412?409:code?503:400);}
async function contexto(emp:string,id:string) {
  if(!/^[a-f0-9-]{36}$/.test(id))throw new Error("Mensagem inválida.");
  const row=await tabela().getEntity<{json:string}>(`emails-${emp}`,id),e:EmailCobranca=JSON.parse(row.json);
  if(!e.fluxo || e.empresa!==emp || !/^[a-f0-9]{64}_20\d{2}-(0[1-9]|1[0-2])$/.test(e.fluxo.cobrancaId))throw new Error("Abra uma cobrança vinculada à fila.");
  const [planoId,competencia]=e.fluxo.cobrancaId.split("_");
  const p:Plano=JSON.parse((await tabela("AdminConfiguracoes").getEntity<{json:string}>(`cobrancas-${emp}`,planoId)).json);
  if(competencia<p.inicio || (p.fim && competencia>p.fim))throw new Error("Competência fora da recorrência cadastrada.");
  const cr=await opcional<{json:string}>(`cobrancas-${emp}`,e.fluxo.cobrancaId);
  const c:Cobranca=cr?JSON.parse(cr.json):prevista(p,competencia);
  const documento=p.documento.replace(/\D/g,"");
  if(!/^\d{14}$/.test(documento))throw new Error("Confira o CNPJ do cliente.");
  return {row,e,p,cr,c,documento};
}
type DetalheInter={cobranca:{codigoSolicitacao:string;pagador:PagadorBoleto;dataEmissao:string;dataVencimento:string;valorNominal:number;seuNumero:string;situacao:string;multa:{codigo:string;taxa:number};mora:{codigo:string;taxa:number};descontos?:unknown[]};boleto?:{nossoNumero:string}};
async function recentes(documento:string,vencimento:string) {
  const inicio=new Date();inicio.setUTCDate(inicio.getUTCDate()-89);
  const lista=await listarCobrancasInter({empresa:"sysney",dataInicial:inicio.toISOString().slice(0,10),dataFinal:hojeBrasil()}) as DetalheInter[];
  const clientes=lista.filter(x=>x.cobranca?.pagador?.cpfCnpj?.replace(/\D/g,"")===documento);
  if(clientes.some(x=>x.cobranca.dataVencimento===vencimento && x.cobranca.situacao!=="CANCELADO"))throw new Error("Já existe cobrança deste cliente com esse vencimento no banco. Confira e registre o documento existente, sem emitir outro.");
  return clientes.sort((a,b)=>(b.cobranca.dataEmissao||"").localeCompare(a.cobranca.dataEmissao||""));
}
export async function GET(req:NextRequest) {
  const remote=await encaminharAdmin(req);if(remote)return remote;
  if(!usuarioAdministrador(req))return reply({erro:"Não autorizado."},401);
  try {const emp=empresa(req);return reply({boletoDisponivel:await habilitada(emp),nfseDisponivel:false,motivoNfse:"Emissão fiscal ainda não validada. Use o portal da Prefeitura e registre a nota emitida abaixo.",motivoBoleto:emp==="drsoft"?"Inter da DRSOFT ainda em validação. Emita no banco e registre o boleto abaixo.":"Emissão exige revisão e aprovação específica. Nenhum e-mail será enviado."});}catch(e){return falha(e);}
}
export async function POST(req:NextRequest) {
  const remote=await encaminharAdmin(req);if(remote)return remote;
  if(!usuarioAdministrador(req))return reply({erro:"Não autorizado."},401);
  if(req.headers.get("origin")!==req.nextUrl.origin)return reply({erro:"Origem inválida."},403);
  try {
    const emp=empresa(req),raw=await req.text();if(raw.length>2000)throw new Error("Solicitação muito grande.");
    const b=JSON.parse(raw);
    if(!["preparar-boleto","emitir-boleto","consultar-boleto"].includes(b.acao))throw new Error("Operação indisponível. NFS-e ainda não habilitada.");
    if(emp!=="sysney")throw new Error("Integração bancária da DRSOFT ainda não habilitada. Use o registro manual.");
    const {row,e,c,cr,documento}=await contexto(emp,b.id);
    const part=`boleto-painel-${emp}`,bankKey=createHash("sha256").update(`${documento}:${c.competencia}`).digest("hex");
    const banco=await opcional<{status:string;codigoSolicitacao?:string;json:string}>(`inter-emissoes-${emp}`,bankKey);
    const pr=await opcional<{json:string}>(part,e.id);
    const previa:PreviaBoleto|null=pr?JSON.parse(pr.json):null;
    if(b.acao==="preparar-boleto") {
      if(!await habilitada(emp))throw new Error("Emissão bancária do painel ainda não habilitada.");
      if(!["rascunho","revisado"].includes(e.status) || c.boleto || e.fluxo?.boleto || e.anexos.some(a=>a.tipo==="boleto"))throw new Error("Já existe documento, anexo ou operação em andamento. Consulte o resultado ou confira o documento existente.");
      if(b.atualizadoEm!==e.atualizadoEm)throw new Error("O rascunho mudou. Salve e atualize antes de emitir.");
      conferirDadosBoleto(e,c);
      if(banco)throw new Error("Já existe tentativa bancária desta competência. Use Consultar resultado; não gere outra.");
      const clientes=await recentes(documento,c.vencimento);
      if(!clientes.length)throw new Error("Não há cadastro bancário recente para preparar o pagador. Emita manualmente e importe o cadastro.");
      const detalhe=await consultarCobrancaInter(emp,clientes[0].cobranca.codigoSolicitacao) as DetalheInter;
      const payload=montarPayloadBoleto(e,c,documento,detalhe.cobranca.pagador,detalhe.cobranca);
      const nova:PreviaBoleto={id:randomUUID(),emailId:e.id,empresa:emp,cobrancaId:c.id,documento,competencia:c.competencia,po:e.po||"",descricao:e.descricao,hash:hashDadosBoleto(e,c,documento),criadoEm:new Date().toISOString(),payload};
      const ent={partitionKey:part,rowKey:e.id,json:JSON.stringify(nova)};
      if(pr)await tabela().updateEntity(ent,"Replace",{etag:pr.etag});else await tabela().createEntity(ent);
      return reply({previa:nova,mensagem:"Prévia preparada. Nenhum boleto foi emitido. Confira endereço, valor, vencimento, descrição, PO, juros e multa antes de aprovar."});
    }
    if(!previa || previa.hash!==hashDadosBoleto(e,c,documento))throw new Error("Dados diferentes da preparação. Não repetir emissão; confira a tentativa e os dados da cobrança.");
    if(b.acao==="emitir-boleto") {
      if(!await habilitada(emp))throw new Error("Emissão bancária não habilitada.");
      if(b.aprovado!==true || b.previaId!==previa.id || b.atualizadoEm!==e.atualizadoEm || Date.now()-Date.parse(previa.criadoEm)>1800000)throw new Error("Revise e aprove novamente os dados do boleto.");
      if(!["rascunho","revisado"].includes(e.status) || c.boleto || e.anexos.some(a=>a.tipo==="boleto") || banco)throw new Error("Emissão já iniciada ou documento existente. Consulte o resultado, sem emitir novamente.");
      conferirDadosBoleto(e,c);
      await recentes(documento,c.vencimento); // Conferência imediatamente antes da trava e do POST.
      e.status="emitindo_documento";delete e.aprovacaoEnvio;if(e.fluxo)delete e.fluxo.documentos;e.atualizadoEm=new Date().toISOString();
      await tabela().updateEntity({partitionKey:`emails-${emp}`,rowKey:e.id,json:JSON.stringify(e)},"Replace",{etag:row.etag});
      let por="Administrador local";const principal=req.headers.get("x-ms-client-principal");if(principal){const u=JSON.parse(Buffer.from(principal,"base64").toString("utf8"));por=String(u.userDetails||u.userId||"Administrador").slice(0,254);}
      await tabela().updateEntity({partitionKey:part,rowKey:e.id,aprovadoPor:por,aprovadoEm:e.atualizadoEm},"Merge",{etag:pr!.etag});
      try {await emitirCobrancaInter({empresa:emp,competencia:c.competencia,payload:previa.payload,autorizacaoPainel:true});}
      catch {
        // A chamada retornou: se não chegou à trava bancária, nenhum POST foi executado.
        const tentativa=await opcional<{status:string}>(`inter-emissoes-${emp}`,bankKey);
        if(!tentativa) {
          const atual=await tabela().getEntity<{json:string}>(`emails-${emp}`,e.id);
          e.status="rascunho";e.atualizadoEm=new Date().toISOString();
          await tabela().updateEntity({partitionKey:`emails-${emp}`,rowKey:e.id,json:JSON.stringify(e)},"Replace",{etag:atual.etag});
          return reply({email:e,mensagem:"Falha antes de transmitir ao banco. Nenhum boleto solicitado. Prepare e revise novamente ou use o registro manual."});
        }
        return reply({email:e,mensagem:"A tentativa não foi concluída nesta tela. Clique em Consultar resultado. Não solicite outro boleto: o resultado pode estar no banco."});
      }
      return reply({email:e,mensagem:"Emissão solicitada ao Inter. Clique em Consultar resultado / obter PDF para concluir. Nenhum e-mail foi enviado."});
    }
    // Recuperação só consulta. Não executa POST bancário, inclusive após timeout.
    if(!["rascunho","revisado","emitindo_documento"].includes(e.status))throw new Error("Mensagem já enviada ou em processamento. Consulte o documento anexado.");
    if(!banco) {
      if(e.status==="emitindo_documento") {
        // Não destravar imediatamente: pode haver uma chamada autenticando antes de criar a trava bancária.
        throw new Error("Ainda não há protocolo bancário. Aguarde e consulte novamente. Se persistir, a operação exige conciliação; não gere outro boleto.");
      }
      return reply({email:e,mensagem:"Nenhuma tentativa bancária registrada. Você pode preparar e revisar o boleto."});
    }
    if(!banco.codigoSolicitacao)throw new Error("Tentativa sem protocolo confirmado. Confira no Inter antes de qualquer nova emissão. O sistema mantém a proteção contra duplicidade.");
    const anterior=JSON.parse(banco.json);
    if(JSON.stringify(anterior)!==JSON.stringify(previa.payload))throw new Error("Existe tentativa com dados diferentes. Conciliação manual necessária; não emitir novamente.");
    const detalhe=await consultarCobrancaInter(emp,banco.codigoSolicitacao) as DetalheInter;
    const d=detalhe.cobranca;
    if(d?.pagador?.cpfCnpj?.replace(/\D/g,"")!==documento || Math.round(Number(d.valorNominal)*100)!==c.centavos || d.dataVencimento!==c.vencimento || d.seuNumero!==previa.payload.seuNumero)throw new Error("Dados bancários divergentes. Confira no Inter; não emitir novamente.");
    if(d.situacao!=="A_RECEBER" || !detalhe.boleto?.nossoNumero)throw new Error(`Situação no Inter: ${d.situacao || "processando"}. Consulte novamente; se pago ou cancelado, não envie nova cobrança.`);
    const numero=detalhe.boleto.nossoNumero;
    if(c.boleto && c.boleto!==numero)throw new Error("Outro boleto já registrado. Confira antes de substituir.");
    const blob=`${emp}/emails/${e.id}/inter-${previa.id}.pdf`;
    if(e.anexos.some(a=>a.tipo==="boleto"&&a.blob!==blob))throw new Error("Já existe outro PDF anexado. Confira antes de substituir.");
    const pdf=await consultarCobrancaInter(emp,banco.codigoSolicitacao,true) as {pdf:string};
    const bytes=Buffer.from(pdf.pdf||"","base64");
    if(bytes.length>5000000 || !bytes.subarray(0,5).equals(Buffer.from("%PDF-")))throw new Error("PDF oficial ainda não disponível. Consulte novamente, sem emitir outro boleto.");
    await new BlobServiceClient(`https://${conta()}.blob.core.windows.net`,cred).getContainerClient("admin-anexos").getBlockBlobClient(blob).uploadData(bytes,{blobHTTPHeaders:{blobContentType:"application/pdf"}});
    const em=new Date().toISOString();c.boleto=numero;c.persistida=true;
    if(!c.eventos.some(v=>v.id===previa.id))c.eventos.push({id:previa.id,tipo:"documentos",data:hojeBrasil(),registradoEm:em,responsavel:"Sistema — Inter",detalhe:`Boleto ${numero} confirmado no Inter; PDF oficial anexado. Protocolo ${banco.codigoSolicitacao}. Nenhum e-mail enviado.`});
    const ent={partitionKey:`cobrancas-${emp}`,rowKey:c.id,json:JSON.stringify(c)};
    if(cr)await tabela().updateEntity(ent,"Replace",{etag:cr.etag});else await tabela().createEntity(ent);
    e.anexos=[...e.anexos.filter(a=>a.tipo!=="boleto"),{tipo:"boleto",nome:`boleto-${c.competencia}.pdf`,blob,tamanho:bytes.length}];
    e.fluxo!.boleto=numero;delete e.fluxo!.documentos;delete e.aprovacaoEnvio;e.status="rascunho";e.atualizadoEm=em;
    await tabela().updateEntity({partitionKey:`emails-${emp}`,rowKey:e.id,json:JSON.stringify(e)},"Replace",{etag:row.etag});
    return reply({email:e,mensagem:"Boleto confirmado e PDF anexado. Confira a nota e os dois PDFs antes de aprovar o envio."});
  }catch(e){return falha(e);}
}
