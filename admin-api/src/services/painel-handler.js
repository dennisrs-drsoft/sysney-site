import { NextRequest } from "../compat/next-server.mjs";
import {randomUUID} from "node:crypto";
import {limitarAcesso} from "./limite-acesso.js";
import {lerCorpoLimitado,ErroRequisicao,headersPrivados} from "./seguranca-http.mjs";

const origens = new Set(["https://www.sysney.com","https://sysney.com","https://lively-ocean-0b7f9dd10.7.azurestaticapps.net"]);
const resposta = (status,erro) => ({status,headers:{...headersPrivados},jsonBody:{erro}});

export function criarHandlerPainel(rotas,{limitar=limitarAcesso}={}) {
  return async (request) => {
    // Azure Functions enforces the function key before invoking this handler.
    // Principal is accepted only over that authenticated, server-to-server channel.
    if (process.env.ADMIN_BACKEND_EXECUTION !== "true") return resposta(503,"Serviço não configurado.");
    const origem = request.headers.get("x-admin-site-origin");
    if (!origens.has(origem)) return resposta(403,"Origem não permitida.");
    if (request.method === "POST" && request.headers.get("origin") !== origem) return resposta(403,"Origem inválida.");
    const encoded = request.headers.get("x-ms-client-principal");
    let principal;
    try {
      if(!encoded||encoded.length>16384)return resposta(401,"Não autorizado.");
      const p = JSON.parse(Buffer.from(encoded,"base64").toString("utf8"));
      if (!Array.isArray(p.userRoles) || !p.userRoles.some(r=>typeof r === "string" && r.toLowerCase() === "administrador")) return resposta(401,"Não autorizado.");
      principal=p;
    } catch { return resposta(401,"Não autorizado."); }
    const rota = request.params.recurso;
    const modulo = Object.hasOwn(rotas,rota) ? rotas[rota] : null;
    const handler = ["GET","POST"].includes(request.method) ? modulo?.[request.method] : null;
    if (!handler) return resposta(405,"Operação não permitida.");
    const requestId=randomUUID();
    let reserva;
    try{reserva=await limitar(principal,request.method);}catch{
      console.warn(JSON.stringify({evento:"limite-indisponivel",requestId,rota,metodo:request.method}));
      return {...resposta(503,"Verificação de segurança indisponível. Tente novamente sem repetir uma emissão ou envio incerto."),headers:{...headersPrivados,"Retry-After":"60","X-Request-Id":requestId}};
    }
    if(!reserva.permitido){
      console.warn(JSON.stringify({evento:"limite-excedido",requestId,rota,metodo:request.method,actor:reserva.actor}));
      return {...resposta(429,"Muitas solicitações. Aguarde antes de tentar novamente."),headers:{...headersPrivados,"Retry-After":String(reserva.retryAfter),"X-Request-Id":requestId}};
    }
    try {
      const body = request.method === "POST" ? await lerCorpoLimitado(request) : undefined;
      const headers = new Headers({"x-ms-client-principal":encoded});
      for (const name of ["content-type","origin"]) { const value=request.headers.get(name); if(value)headers.set(name,value); }
      const req = new NextRequest(`${origem}/api/admin/${rota}${new URL(request.url).search}`,{method:request.method,headers,body});
      const response = await handler(req);
      const safeHeaders=new Headers(response.headers);
      for(const [nome,valor] of Object.entries(headersPrivados))safeHeaders.set(nome,valor);
      safeHeaders.set("X-Request-Id",requestId);
      return {status:response.status,headers:Object.fromEntries(safeHeaders),body:Buffer.from(await response.arrayBuffer())};
    } catch(e) {
      if(e instanceof ErroRequisicao)return resposta(e.status,e.message);
      console.warn(JSON.stringify({evento:"falha-painel",requestId,rota,metodo:request.method}));
      return {...resposta(500,"Falha ao processar a solicitação. Consulte o histórico antes de repetir."),headers:{...headersPrivados,"X-Request-Id":requestId}};
    }
  };
}
