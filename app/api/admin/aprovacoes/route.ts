import { NextRequest, NextResponse } from "next/server";
import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { createHash } from "node:crypto";
import { usuarioAdministrador } from "../_auth";
import { encaminharAdmin } from "../_remote";
import { hashEmissao, normalizarEmissao, type AprovacaoEmissao } from "@/lib/aprovacoes-emissao";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cred = new DefaultAzureCredential();
const reply = (data: unknown, status = 200) => NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
function contexto(req: NextRequest) {
  const empresa = req.nextUrl.searchParams.get("empresa");
  if (empresa !== "sysney" && empresa !== "drsoft") throw new Error("Empresa inválida.");
  const conta = process.env.ADMIN_STORAGE_ACCOUNT || (process.env.NODE_ENV !== "production" ? "sysneyadm2602" : "");
  if (!conta) throw new Error("Armazenamento não configurado.");
  return {empresa: empresa as "sysney" | "drsoft",part:`aprovacoes-emissao-${empresa}`,table:new TableClient(`https://${conta}.table.core.windows.net`,"AdminDocumentos",cred)};
}
function falha(e: unknown) {
  const code = (e as {statusCode?:number}).statusCode;
  return reply({erro:code === 409 || code === 412 ? "A versão mudou ou já existe. Atualize a fila antes de continuar." : code ? "Falha ao acessar a aprovação." : e instanceof Error ? e.message : "Operação inválida."},code === 409 || code === 412 ? 409 : code ? 503 : 400);
}
export async function GET(req: NextRequest) {
  const remote = await encaminharAdmin(req); if (remote) return remote;
  if (!usuarioAdministrador(req)) return reply({erro:"Não autorizado."},401);
  try {
    const {part,table} = contexto(req); const aprovacoes: AprovacaoEmissao[] = [];
    for await (const r of table.listEntities<{json:string}>({queryOptions:{filter:`PartitionKey eq '${part}'`}})) aprovacoes.push(JSON.parse(r.json));
    return reply({aprovacoes,emissaoDisponivel:false});
  } catch(e) { return falha(e); }
}
export async function POST(req: NextRequest) {
  const remote = await encaminharAdmin(req); if (remote) return remote;
  if (!usuarioAdministrador(req)) return reply({erro:"Não autorizado."},401);
  if (req.headers.get("origin") !== req.nextUrl.origin) return reply({erro:"Origem inválida."},403);
  try {
    const {empresa,part,table} = contexto(req);
    const raw = await req.text(); if (raw.length > 10000) throw new Error("Solicitação muito grande.");
    const body = JSON.parse(raw), em = new Date().toISOString();
    const principal = req.headers.get("x-ms-client-principal");
    const p = principal ? JSON.parse(Buffer.from(principal,"base64").toString("utf8")) : {};
    const por = String(p.userDetails || p.userId || "Administrador local").slice(0,254);
    if (body.acao === "criar") {
      const dados = normalizarEmissao(body.dados);
      const id = createHash("sha256").update(`${dados.clienteDocumento}:${dados.competencia}`).digest("hex");
      const registro: AprovacaoEmissao = {id,empresa,dados,versao:1,status:"pendente",atualizadoEm:em,historico:[{acao:"preparada",por,em,versao:1}]};
      await table.createEntity({partitionKey:part,rowKey:id,json:JSON.stringify(registro)});
      return reply({registro},201);
    }
    if (typeof body.id !== "string" || !/^[a-f0-9]{64}$/.test(body.id)) throw new Error("Aprovação inválida.");
    const row = await table.getEntity<{json:string}>(part,body.id);
    const registro: AprovacaoEmissao = JSON.parse(row.json);
    if (body.versao !== registro.versao || body.atualizadoEm !== registro.atualizadoEm) return reply({erro:"A versão mudou. Reabra e confira os dados atuais."},409);
    if (registro.historico.length >= 100) throw new Error("Limite de histórico atingido.");
    if (body.acao === "aprovar") {
      if (registro.status !== "pendente") throw new Error("Esta versão já foi aprovada.");
      registro.aprovacao = {por,em,hash:hashEmissao(empresa,registro.dados)};
      registro.status = "aprovada";
    } else if (body.acao === "revogar") {
      delete registro.aprovacao; registro.status = "pendente";
    } else if (body.acao === "alterar") {
      const dados = normalizarEmissao(body.dados);
      if (dados.clienteDocumento !== registro.dados.clienteDocumento || dados.competencia !== registro.dados.competencia) throw new Error("Cliente ou competência diferente: prepare outra cobrança.");
      registro.dados = dados; registro.versao++; registro.status = "pendente"; delete registro.aprovacao;
    } else throw new Error("Ação inválida. Emissão real continua bloqueada.");
    registro.atualizadoEm = em;
    registro.historico.push({acao:body.acao,por,em,versao:registro.versao});
    const json = JSON.stringify(registro);
    if (Buffer.byteLength(json,"utf16le") > 60000) throw new Error("Limite de histórico atingido.");
    await table.updateEntity({partitionKey:part,rowKey:registro.id,json},"Replace",{etag:row.etag});
    return reply({registro,emissaoDisponivel:false});
  } catch(e) { return falha(e); }
}
