import { NextRequest, NextResponse } from "next/server";
import { DefaultAzureCredential } from "@azure/identity";
import { TableClient, type TableEntityResult } from "@azure/data-tables";
import { createHash } from "node:crypto";
import { usuarioAdministrador } from "../_auth";
import { encaminharAdmin } from "../_remote";
import { carteira, dataValida, hojeBrasil, mesValido, pago, prevista, integrarEnvios, type Plano, type Cobranca, type Evento } from "@/lib/cobrancas";
import type { EmailCobranca } from "@/lib/emails-cobranca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const credential = new DefaultAzureCredential();
type Registro = { json: string };
function tabela(nome: string) {
  const conta = process.env.ADMIN_STORAGE_ACCOUNT || (process.env.NODE_ENV !== "production" ? "sysneyadm2602" : "");
  if (!conta) throw new Error("Armazenamento não configurado.");
  return new TableClient(`https://${conta}.table.core.windows.net`, nome, credential);
}
function resposta(dados: unknown, status = 200) {
  return NextResponse.json(dados, { status, headers: { "Cache-Control": "no-store" } });
}
function empresa(req: NextRequest) {
  const v = req.nextUrl.searchParams.get("empresa");
  if (v !== "sysney" && v !== "drsoft") throw new Error("Empresa inválida.");
  return v;
}
function texto(v: unknown, limite = 500) {
  if (typeof v !== "string" || !v.trim() || v.length > limite) throw new Error("Preencha os campos obrigatórios dentro do limite permitido.");
  return v.trim();
}
function inteiro(v: unknown, min: number, max: number) {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max) throw new Error("Valor ou prazo inválido.");
  return v;
}
async function ler<T>(table: TableClient, partitionKey: string) {
  const lista: T[] = [];
  for await (const e of table.listEntities<Registro>({ queryOptions: { filter: `PartitionKey eq '${partitionKey}'` } })) lista.push(JSON.parse(e.json) as T);
  return lista;
}
function falha(e: unknown) {
  const status = (e as { statusCode?: number }).statusCode;
  if (status === 409 || status === 412) return resposta({ erro: "O registro foi atualizado. Atualize a lista antes de repetir a ação." }, 409);
  if (status) return resposta({ erro: "Não foi possível acessar o registro na base. Tente novamente." }, 503);
  return resposta({ erro: e instanceof Error ? e.message : "Operação inválida." }, 400);
}
export async function GET(req: NextRequest) {
  const remote = await encaminharAdmin(req); if (remote) return remote;
  if (!usuarioAdministrador(req)) return resposta({ erro: "Não autorizado." }, 401);
  try {
    const part = `cobrancas-${empresa(req)}`;
    const mes = req.nextUrl.searchParams.get("mes") || hojeBrasil().slice(0, 7);
    if (!mesValido(mes)) throw new Error("Competência inválida.");
    const [planos, salvas] = await Promise.all([
      ler<Plano>(tabela("AdminConfiguracoes"), part), ler<Cobranca>(tabela("AdminDocumentos"), part),
    ]);
    const ate = mes > hojeBrasil().slice(0, 7) ? mes : hojeBrasil().slice(0, 7);
    const emails = await ler<EmailCobranca>(tabela("AdminDocumentos"), `emails-${empresa(req)}`);
    return resposta({ planos, cobrancas: integrarEnvios(carteira(planos, salvas, ate), emails, empresa(req)), hoje: hojeBrasil() });
  } catch (e) { return falha(e); }
}
export async function POST(req: NextRequest) {
  const remote = await encaminharAdmin(req); if (remote) return remote;
  if (!usuarioAdministrador(req)) return resposta({ erro: "Não autorizado." }, 401);
  if (req.headers.get("origin") !== req.nextUrl.origin) return resposta({ erro: "Origem inválida." }, 403);
  try {
    const emp = empresa(req);
    const part = `cobrancas-${emp}`;
    const raw = await req.text();
    if (raw.length > 12000) throw new Error("Solicitação muito grande.");
    const body = JSON.parse(raw);
    const planosTable = tabela("AdminConfiguracoes");
    if (body.acao === "plano") {
      const clienteId = texto(body.clienteId, 100);
      if (!/^[a-zA-Z0-9-]+$/.test(clienteId)) throw new Error("Cliente inválido.");
      const cliente = await tabela(process.env.ADMIN_STORAGE_TABLE_CLIENTES || "AdminClientes").getEntity<{ nome: string; documento: string }>(emp, clienteId);
      if (!mesValido(body.inicio) || (body.fim && (!mesValido(body.fim) || body.fim < body.inicio))) throw new Error("Período da recorrência inválido.");
      if (body.inicio < dataValidaInicio()) throw new Error("Para o controle inicial, use uma competência dos últimos cinco anos.");
      const email = texto(body.email, 254);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
      const p: Plano = {
        id: createHash("sha256").update(cliente.documento).digest("hex"), clienteId,
        clienteNome: cliente.nome, documento: cliente.documento, email,
        descricao: texto(body.descricao), centavos: inteiro(body.centavos, 1, 10000000000),
        inicio: body.inicio, fim: body.fim || "", diaEnvio: inteiro(body.diaEnvio, 1, 31),
        mesEnvio: inteiro(body.mesEnvio, 0, 3), diaVencimento: inteiro(body.diaVencimento, 1, 31),
        mesVencimento: inteiro(body.mesVencimento, 0, 3), criadoEm: new Date().toISOString(),
      };
      const c = prevista(p, p.inicio);
      if (p.mesVencimento < p.mesEnvio || (p.mesVencimento === p.mesEnvio && p.diaVencimento < p.diaEnvio) || c.vencimento < c.envioPrevisto) throw new Error("O vencimento deve ser igual ou posterior ao envio previsto em todos os meses.");
      await planosTable.createEntity({ partitionKey: part, rowKey: p.id, json: JSON.stringify(p) });
      return resposta({ sucesso: true }, 201);
    }
    const id = texto(body.id, 100);
    if (!/^[a-f0-9]{64}_20\d{2}-(0[1-9]|1[0-2])$/.test(id)) throw new Error("Cobrança inválida.");
    const [planoId, competencia] = id.split("_");
    const table = tabela("AdminDocumentos");
    let original: TableEntityResult<Registro> | undefined;
    try { original = await table.getEntity<Registro>(part, id); }
    catch (e) { if ((e as { statusCode?: number }).statusCode !== 404) throw e; }
    let c: Cobranca;
    if (original) c = JSON.parse(original.json);
    else {
      const p: Plano = JSON.parse((await planosTable.getEntity<Registro>(part, planoId)).json);
      if (competencia < p.inicio || (p.fim && competencia > p.fim)) throw new Error("Competência fora do contrato.");
      c = prevista(p, competencia);
    }
    c = integrarEnvios([c], await ler<EmailCobranca>(table, `emails-${emp}`), emp)[0];
    const operacaoId = texto(body.operacaoId, 36);
    if (!/^[a-f0-9-]{36}$/.test(operacaoId)) throw new Error("Identificador inválido.");
    if (c.eventos.some(e => e.id === operacaoId)) return resposta({ sucesso: true });
    if (c.eventos.length >= 100) throw new Error("Limite de histórico atingido para esta competência.");
    const data = body.data || hojeBrasil();
    if (!dataValida(data) || data > hojeBrasil()) throw new Error("Informe uma data válida, até hoje.");
    let responsavel = "Administrador local";
    const principal = req.headers.get("x-ms-client-principal");
    if (principal) {
      const user = JSON.parse(Buffer.from(principal, "base64").toString("utf8"));
      responsavel = String(user.userDetails || user.userId || "Administrador").slice(0, 254);
    }
    const evento: Evento = { id: operacaoId, tipo: body.acao, data, registradoEm: new Date().toISOString(), responsavel, detalhe: "" };
    switch (body.acao) {
      case "documentos":
        c.nota = texto(body.nota, 120); c.boleto = texto(body.boleto, 120);
        c.demonstrativo = body.demonstrativo === true;
        if (!c.demonstrativo) throw new Error("Confirme a preparação do demonstrativo.");
        evento.detalhe = `Documentos conferidos manualmente: NFS-e ${c.nota}; boleto ${c.boleto}.`;
        break;
      case "envio":
        if (!c.nota || !c.boleto || !c.demonstrativo) throw new Error("Confira demonstrativo, nota e boleto antes de registrar o envio.");
        evento.detalhe = `Envio informado manualmente: ${texto(body.detalhe)}`;
        break;
      case "recebimento":
        if (!c.eventos.some(e => e.tipo === "envio" && e.data <= data)) throw new Error("Registre primeiro o envio com data anterior ou igual.");
        evento.detalhe = `Recebimento confirmado manualmente: ${texto(body.detalhe)}`;
        break;
      case "pagamento":
        evento.centavos = inteiro(body.centavos, 1, c.centavos - pago(c));
        evento.detalhe = `Pagamento informado manualmente: ${texto(body.detalhe)}`;
        break;
      case "estorno": {
        const pagamento = c.eventos.find(e => e.id === body.referencia && e.tipo === "pagamento");
        if (!pagamento || c.eventos.some(e => e.tipo === "estorno" && e.referencia === pagamento.id)) throw new Error("Pagamento não disponível para correção.");
        evento.referencia = pagamento.id;
        evento.detalhe = `Correção de registro manual, sem movimentação bancária: ${texto(body.detalhe)}`;
        break;
      }
      default: throw new Error("Ação inválida.");
    }
    c.eventos.push(evento); c.persistida = true;
    const json = JSON.stringify(c);
    if (Buffer.byteLength(json, "utf16le") > 60000) throw new Error("Limite de histórico atingido.");
    const entity = { partitionKey: part, rowKey: id, json };
    if (original) await table.updateEntity(entity, "Replace", { etag: original.etag });
    else await table.createEntity(entity);
    return resposta({ sucesso: true });
  } catch (e) { return falha(e); }
}
function dataValidaInicio() {
  const ano = Number(hojeBrasil().slice(0, 4)) - 5;
  return `${ano}-01`;
}
