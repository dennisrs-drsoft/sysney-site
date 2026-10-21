import { NextRequest, NextResponse } from "next/server";
import { usuarioAdministrador } from "../_auth";
import { encaminharAdmin } from "../_remote";
import { lerCorpoLimitado, ErroRequisicao } from "@/admin-api/src/services/seguranca-http.mjs";
import { OrdensServicoStore } from "@/lib/ordens-servico-store";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const resposta=(dados:unknown,status=200)=>NextResponse.json(dados,{status,headers:{"Cache-Control":"no-store"}});
function store(req:NextRequest){const e=req.nextUrl.searchParams.get("empresa");if(e!=="sysney"&&e!=="drsoft")throw Error("Empresa inválida.");return new OrdensServicoStore(e);}
function falha(e:unknown){if(e instanceof ErroRequisicao)return resposta({erro:e.message},e.status);const status=(e as {statusCode?:number}).statusCode;if(status===409||status===412)return resposta({erro:"Registro alterado, duplicado ou reservado. Atualize a lista; para uma cobrança incerta, retome o lote existente, sem selecionar novamente."},409);if(status)return resposta({erro:"Não foi possível acessar os registros privados. Atualize antes de repetir."},status===404?404:503);return resposta({erro:e instanceof Error?e.message:"Operação inválida."},400);}
export async function GET(req:NextRequest){const remote=await encaminharAdmin(req);if(remote)return remote;if(!usuarioAdministrador(req))return resposta({erro:"Não autorizado."},401);try{const s=store(req);if(req.nextUrl.searchParams.get("arquivo")==="pdf"){const ids=(req.nextUrl.searchParams.get("ids")||"").split(",");const pdf=await s.relatorio(ids);return new NextResponse(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":"inline; filename=Relatorio-servicos.pdf","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});}return resposta(await s.listar());}catch(e){return falha(e);}}
export async function POST(req:NextRequest){
  const remote=await encaminharAdmin(req);if(remote)return remote;
  if(!usuarioAdministrador(req))return resposta({erro:"Não autorizado."},401);
  if(req.headers.get("origin")!==req.nextUrl.origin)return resposta({erro:"Origem inválida."},403);
  try{
    const raw=await lerCorpoLimitado(req,64000);if(!raw)throw Error("Corpo da solicitação vazio.");
    const body=JSON.parse(raw.toString("utf8"));let por="Administrador";
    const encoded=req.headers.get("x-ms-client-principal");
    if(encoded){const p=JSON.parse(Buffer.from(encoded,"base64").toString("utf8"));por=String(p.userDetails||p.userId||por).slice(0,254);}
    return resposta({resultado:await store(req).executar(body,por)});
  }catch(e){return falha(e);}
}
