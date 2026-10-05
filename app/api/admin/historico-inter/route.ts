import { DefaultAzureCredential } from "@azure/identity";
import { TableClient } from "@azure/data-tables";
import { NextRequest, NextResponse } from "next/server";
import { usuarioAdministrador } from "../_auth";
import { encaminharAdmin } from "../_remote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const remote = await encaminharAdmin(req); if (remote) return remote;
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!usuarioAdministrador(req)) return reply({ erro: "Não autorizado." }, 401);
  const empresa = req.nextUrl.searchParams.get("empresa");
  if (empresa !== "sysney" && empresa !== "drsoft") return reply({ erro: "Empresa inválida." }, 400);
  const conta = process.env.ADMIN_STORAGE_ACCOUNT || (process.env.NODE_ENV !== "production" ? "sysneyadm2602" : "");
  if (!conta) return reply({ erro: "Armazenamento não configurado." }, 503);
  try {
    const table = new TableClient(`https://${conta}.table.core.windows.net`, "AdminDocumentos", new DefaultAzureCredential());
    const cobrancas = [];
    for await (const entity of table.listEntities<{ json: string; atualizadoEm: string }>({ queryOptions: { filter: `PartitionKey eq 'inter-historico-${empresa}'` } })) {
      const { cobranca: c, boleto } = JSON.parse(entity.json);
      if (!c) continue;
      cobrancas.push({ id: entity.rowKey, cliente: c.pagador?.nome || "Não informado", documento: c.pagador?.cpfCnpj || "", numero: c.seuNumero || "", nossoNumero: boleto?.nossoNumero || c.nossoNumero || "", emissao: c.dataEmissao || "", vencimento: c.dataVencimento || "", valor: Number(c.valorNominal), situacao: c.situacao || "Não informada", dataSituacao: c.dataSituacao || "", consultadoEm: entity.atualizadoEm });
    }
    cobrancas.sort((a, b) => b.vencimento.localeCompare(a.vencimento));
    return reply({ cobrancas });
  } catch {
    return reply({ erro: "Não foi possível consultar o histórico importado." }, 503);
  }
}
