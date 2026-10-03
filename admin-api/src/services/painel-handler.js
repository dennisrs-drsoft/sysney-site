import { NextRequest } from "../compat/next-server.mjs";

const origens = new Set(["https://www.sysney.com","https://sysney.com","https://lively-ocean-0b7f9dd10.7.azurestaticapps.net"]);
const resposta = (status,erro) => ({status,headers:{"Cache-Control":"no-store"},jsonBody:{erro}});

export function criarHandlerPainel(rotas) {
  return async (request) => {
    // Azure Functions enforces the function key before invoking this handler.
    // Principal is accepted only over that authenticated, server-to-server channel.
    if (process.env.ADMIN_BACKEND_EXECUTION !== "true") return resposta(503,"Serviço não configurado.");
    const origem = request.headers.get("x-admin-site-origin");
    if (!origens.has(origem)) return resposta(403,"Origem não permitida.");
    if (request.method === "POST" && request.headers.get("origin") !== origem) return resposta(403,"Origem inválida.");
    const encoded = request.headers.get("x-ms-client-principal");
    try {
      const p = JSON.parse(Buffer.from(encoded || "","base64").toString("utf8"));
      if (!Array.isArray(p.userRoles) || !p.userRoles.some(r=>typeof r === "string" && r.toLowerCase() === "administrador")) return resposta(401,"Não autorizado.");
    } catch { return resposta(401,"Não autorizado."); }
    const rota = request.params.recurso;
    const modulo = Object.hasOwn(rotas,rota) ? rotas[rota] : null;
    const handler = ["GET","POST"].includes(request.method) ? modulo?.[request.method] : null;
    if (!handler) return resposta(405,"Operação não permitida.");
    if (Number(request.headers.get("content-length") || 0) > 5_500_000) return resposta(413,"Arquivo muito grande.");
    try {
      const body = request.method === "POST" ? await request.arrayBuffer() : undefined;
      if(body && body.byteLength > 5_500_000)return resposta(413,"Arquivo muito grande.");
      const headers = new Headers({"x-ms-client-principal":encoded});
      for (const name of ["content-type","origin"]) { const value=request.headers.get(name); if(value)headers.set(name,value); }
      const req = new NextRequest(`${origem}/api/admin/${rota}${new URL(request.url).search}`,{method:request.method,headers,body});
      const response = await handler(req);
      return {status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())};
    } catch { return resposta(500,"Falha ao processar a solicitação. Consulte o histórico antes de repetir."); }
  };
}
