import { DefaultAzureCredential } from "@azure/identity";
import { TableClient } from "@azure/data-tables";
import { NextRequest, NextResponse } from "next/server";
import { usuarioAdministrador } from "../_auth";
import { encaminharAdmin } from "../_remote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmpresaId = "drsoft" | "sysney";

type ClienteEntity = {
  partitionKey: string;
  rowKey: string;
  nome?: string;
  documento?: string;
  email?: string;
  telefone?: string;
  atualizadoEm?: string;
  origem?: string;
};

function empresaValida(valor: string | null): valor is EmpresaId {
  return valor === "drsoft" || valor === "sysney";
}

export async function GET(request: NextRequest) {
  const remote = await encaminharAdmin(request); if (remote) return remote;
  if (!usuarioAdministrador(request)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const empresa = request.nextUrl.searchParams.get("empresa");
  if (!empresaValida(empresa)) {
    return NextResponse.json({ erro: "Empresa inválida." }, { status: 400 });
  }

  const conta =
    process.env.ADMIN_STORAGE_ACCOUNT ||
    (process.env.NODE_ENV !== "production" ? "sysneyadm2602" : "");
  const tabela =
    process.env.ADMIN_STORAGE_TABLE_CLIENTES || "AdminClientes";
  if (!conta) {
    return NextResponse.json(
      { erro: "Armazenamento administrativo não configurado." },
      { status: 503 }
    );
  }

  try {
    const tableClient = new TableClient(
      `https://${conta}.table.core.windows.net`,
      tabela,
      new DefaultAzureCredential()
    );
    const clientes = [];

    for await (const entity of tableClient.listEntities<ClienteEntity>({
      queryOptions: {
        filter: `PartitionKey eq '${empresa}'`,
        select: [
          "PartitionKey",
          "RowKey",
          "nome",
          "documento",
          "email",
          "telefone",
          "atualizadoEm",
          "origem",
        ],
      },
    })) {
      if (!entity.nome || !entity.documento) continue;
      clientes.push({
        id: entity.rowKey,
        empresaId: empresa,
        nome: entity.nome,
        documento: entity.documento,
        email: entity.email || "",
        telefone: entity.telefone || "",
        criadoEm: entity.atualizadoEm || "",
        origem: entity.origem || "azure",
      });
    }

    clientes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return NextResponse.json(
      { clientes },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (erro) {
    console.error("Falha ao consultar clientes administrativos", erro);
    return NextResponse.json(
      { erro: "Não foi possível carregar os clientes neste momento." },
      { status: 503 }
    );
  }
}
