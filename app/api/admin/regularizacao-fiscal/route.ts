import {NextRequest,NextResponse} from "next/server";
import {TableClient} from "@azure/data-tables";
import {DefaultAzureCredential} from "@azure/identity";
import {BlobServiceClient} from "@azure/storage-blob";
import {usuarioAdministrador} from "../_auth";
import {encaminharAdmin} from "../_remote";
import {criarRegularizacaoEmissao} from "@/lib/regularizacao-emissao";
import type {Empresa} from "@/lib/cobrancas";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const cred=new DefaultAzureCredential();
const conta=()=>process.env.ADMIN_STORAGE_ACCOUNT||(process.env.NODE_ENV!=="production"?"sysneyadm2602":"");
const table=(nome="AdminDocumentos")=>new TableClient(`https://${conta()}.table.core.windows.net`,nome,cred);
const service=criarRegularizacaoEmissao({table});
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
function empresa(req:NextRequest):Empresa{const v=req.nextUrl.searchParams.get("empresa");if(v!=="sysney"&&v!=="drsoft")throw Error("Empresa inválida.");return v;}
function falha(e:unknown){const code=(e as {statusCode?:number}).statusCode;return reply({erro:code===409||code===412?"O lote mudou ou outra execução está em andamento. Atualize sem repetir uma transmissão.":code?"Não foi possível consultar os registros do lote.":e instanceof Error?e.message:"Etapa não confirmada. Consulte o mesmo lote."},code===409||code===412?409:code?503:400);}

export async function GET(req:NextRequest){
  const remote=await encaminharAdmin(req);if(remote)return remote;
  if(!usuarioAdministrador(req))return reply({erro:"Não autorizado."},401);
  try{
    const emp=empresa(req),id=req.nextUrl.searchParams.get("lote"),arquivo=req.nextUrl.searchParams.get("arquivo");
    if(id){
      const {l}=await service.lote(emp,id);
      if(arquivo){
        const item=l.itens.find(i=>i.recebimentoId===req.nextUrl.searchParams.get("recebimentoId"));
        if(!item||!["emitida","homologada"].includes(item.status)||!["pdf","xml"].includes(arquivo))throw Error("Documento ainda não confirmado neste lote.");
        const path=arquivo==="pdf"?item.pdf:item.xml;
        if(!path||(!path.startsWith(`historico/${emp}/nfse/`)&&!path.startsWith(`qa/nacional-admin/${emp}/`)))return reply({erro:"Documento ainda não disponível. Consulte a mesma nota para recuperá-lo."},404);
        const blob=new BlobServiceClient(`https://${conta()}.blob.core.windows.net`,cred).getContainerClient("admin-anexos").getBlobClient(path),props=await blob.getProperties();
        if(!props.contentLength||props.contentLength>5000000)throw Error("Documento fora do limite.");
        const bytes=await blob.downloadToBuffer(0,props.contentLength,{conditions:{ifMatch:props.etag}});
        const numero=String(item.nota||"").replace(/\D/g,"")||"documento";
        return new NextResponse(new Uint8Array(bytes),{headers:{"Cache-Control":"no-store","Content-Type":arquivo==="pdf"?"application/pdf":"application/xml","Content-Disposition":`attachment; filename="NFSe_${numero}.${arquivo}"`,"X-Content-Type-Options":"nosniff"}});
      }
      return reply({lote:l});
    }
    const documento=req.nextUrl.searchParams.get("documento")||undefined;
    return reply({lotes:await service.listar(emp),configuracao:await service.configuracao(emp,documento)});
  }catch(e){return falha(e);}
}
export async function POST(req:NextRequest){
  const remote=await encaminharAdmin(req);if(remote)return remote;
  if(!usuarioAdministrador(req))return reply({erro:"Não autorizado."},401);
  if(req.headers.get("origin")!==req.nextUrl.origin)return reply({erro:"Origem inválida."},403);
  try{
    const emp=empresa(req),raw=await req.text();if(raw.length>20000)throw Error("Solicitação muito grande.");
    const body=JSON.parse(raw);
    const l=body.acao==="preparar"?await service.criar(emp,body,req):body.acao==="aprovar"?await service.aprovar(emp,body.loteId,body,req):body.acao==="avancar"?await service.avancar(emp,body.loteId,body,req):body.acao==="organizar-historico"?await service.organizarHistorico(emp,body.loteId,body,req):null;
    if(!l)throw Error("Operação inválida.");
    return reply({lote:l,emailEnviado:false,novaDividaCriada:false,cobrancasPagas:l.itens.filter(i=>i.historicoCobranca).length});
  }catch(e){return falha(e);}
}
