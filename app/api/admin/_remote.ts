import { NextRequest, NextResponse } from "next/server";
import { usuarioAdministrador } from "./_auth";

const rotas = new Set(["clientes", "cobrancas", "emails", "aprovacoes", "historico-inter", "status"]);
const destino = "https://sysney-admin-api-2602.azurewebsites.net";
const origens = new Set(["https://www.sysney.com", "https://sysney.com", "https://lively-ocean-0b7f9dd10.7.azurestaticapps.net"]);
const erro = (mensagem: string, status: number) => NextResponse.json({erro:mensagem},{status,headers:{"Cache-Control":"no-store"}});

/** The Function runs these same handlers locally; only the website forwards. */
export async function encaminharAdmin(req: NextRequest): Promise<Response | null> {
  if (process.env.ADMIN_BACKEND_EXECUTION === "true") return null;
  if (process.env.NODE_ENV !== "production" && process.env.ADMIN_BACKEND_ENABLED !== "true") return null;
  if (!usuarioAdministrador(req)) return erro("Não autorizado.",401);
  const rota = req.nextUrl.pathname.split("/").at(-1) || "";
  if (!rotas.has(rota) || !["GET","POST"].includes(req.method)) return erro("Operação não permitida.",405);
  if (!origens.has(req.nextUrl.origin)) return erro("Origem não permitida.",403);
  if (req.method === "POST" && req.headers.get("origin") !== req.nextUrl.origin) return erro("Origem inválida.",403);
  const key = process.env.ADMIN_BACKEND_KEY;
  if (!key) return erro("Serviço administrativo ainda não configurado.",503);
  if (Number(req.headers.get("content-length") || 0) > 5_500_000) return erro("Arquivo muito grande.",413);
  const body = req.method === "POST" ? await req.arrayBuffer() : undefined;
  if (body && body.byteLength > 5_500_000) return erro("Arquivo muito grande.",413);
  const headers = new Headers({
    "x-functions-key":key,
    "x-ms-client-principal":req.headers.get("x-ms-client-principal") || "",
    "x-admin-site-origin":req.nextUrl.origin,
  });
  if (req.method === "POST") headers.set("origin",req.nextUrl.origin);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type",contentType);
  try {
    const response = await fetch(`${destino}/api/financeiro/painel/${rota}${req.nextUrl.search}`,{
      method:req.method,headers,body,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(90000),
    });
    const safe = new Headers({"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
    for (const name of ["content-type","content-disposition"]) {
      const value=response.headers.get(name); if(value)safe.set(name,value);
    }
    return new Response(response.body,{status:response.status,headers:safe});
  } catch {
    return erro(req.method === "POST" ? "Não foi possível confirmar o resultado. Atualize o histórico antes de repetir a operação." : "Serviço administrativo temporariamente indisponível.",502);
  }
}
