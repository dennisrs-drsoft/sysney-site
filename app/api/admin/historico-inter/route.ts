import { DefaultAzureCredential } from "@azure/identity";
import { TableClient } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";
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
    if(req.nextUrl.searchParams.get("arquivo")==="pdf"){
      const id=req.nextUrl.searchParams.get("id")||"";
      if(!/^[a-f0-9]{64}$/.test(id))return reply({erro:"Boleto inválido."},400);
      const row=await table.getEntity<{pdfBlob?:string}>(`inter-historico-${empresa}`,id);
      if(!row.pdfBlob?.startsWith(`historico/${empresa}/inter/`))return reply({erro:"PDF ainda não importado."},404);
      const bytes=await new BlobServiceClient(`https://${conta}.blob.core.windows.net`,new DefaultAzureCredential()).getContainerClient("admin-anexos").getBlockBlobClient(row.pdfBlob).downloadToBuffer();
      return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=\"boleto.pdf\"","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
    const cobrancas = [];
    for await (const entity of table.listEntities<{ json: string; atualizadoEm: string; pdfBlob?:string }>({ queryOptions: { filter: `PartitionKey eq 'inter-historico-${empresa}'` } })) {
      const { cobranca: c, boleto } = JSON.parse(entity.json);
      if (!c) continue;
      cobrancas.push({ id: entity.rowKey, cliente: c.pagador?.nome || "Não informado", documento: c.pagador?.cpfCnpj || "", numero: c.seuNumero || "", nossoNumero: boleto?.nossoNumero || c.nossoNumero || "", emissao: c.dataEmissao || "", vencimento: c.dataVencimento || "", valor: Number(c.valorNominal), valorRecebido: Number.isFinite(Number(c.valorTotalRecebido)) && c.valorTotalRecebido !== null && c.valorTotalRecebido !== undefined ? Number(c.valorTotalRecebido) : undefined, situacao: c.situacao || "Não informada", dataSituacao: c.dataSituacao || "", consultadoEm: entity.atualizadoEm, pdf:!!entity.pdfBlob });
    }
    cobrancas.sort((a, b) => b.vencimento.localeCompare(a.vencimento));
    return reply({ cobrancas });
  } catch {
    return reply({ erro: "Não foi possível consultar o histórico importado." }, 503);
  }
}
