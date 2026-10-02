import { createHash } from "node:crypto";
import { DefaultAzureCredential } from "@azure/identity";
import { TableClient } from "@azure/data-tables";
import { listarCobrancasInter } from "./inter.js";

function dataIso(data) {
  return data.toISOString().slice(0, 10);
}

export function periodoPadrao() {
  const final = new Date();
  const inicial = new Date(final);
  inicial.setUTCDate(inicial.getUTCDate() - 89);
  return { dataInicial: dataIso(inicial), dataFinal: dataIso(final) };
}

export function dataValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor ?? "");
}

function pagadorDaCobranca(cobranca) {
  const pessoa =
    cobranca.pagador ??
    cobranca.pessoa ??
    cobranca.devedor ??
    cobranca.cobranca?.pagador ??
    cobranca.cobranca?.pessoa;
  if (!pessoa) return null;

  const documento = String(
    pessoa.cpfCnpj ?? pessoa.cpf ?? pessoa.cnpj ?? ""
  ).replace(/\D/g, "");
  const nome = String(pessoa.nome ?? pessoa.nomeCompleto ?? "").trim();
  if (!documento || !nome) return null;

  return {
    documento,
    nome,
    email: String(pessoa.email ?? "").trim(),
    telefone: String(pessoa.telefone ?? pessoa.celular ?? "").trim(),
  };
}

function clientesUnicos(cobrancas) {
  const clientes = new Map();
  for (const cobranca of cobrancas) {
    const cliente = pagadorDaCobranca(cobranca);
    if (cliente) clientes.set(cliente.documento, cliente);
  }
  return [...clientes.values()];
}

function tableClient() {
  const conta = process.env.ADMIN_STORAGE_ACCOUNT;
  const tabela =
    process.env.ADMIN_STORAGE_TABLE_CLIENTES || "AdminClientes";
  if (!conta) throw new Error("ADMIN_STORAGE_ACCOUNT não configurado.");
  return new TableClient(
    `https://${conta}.table.core.windows.net`,
    tabela,
    new DefaultAzureCredential()
  );
}

export async function sincronizarClientesInter({
  empresa,
  dataInicial,
  dataFinal,
}) {
  const cobrancas = await listarCobrancasInter({
    empresa,
    dataInicial,
    dataFinal,
  });
  const clientes = clientesUnicos(cobrancas);
  const tabela = tableClient();
  const atualizadoEm = new Date().toISOString();

  for (const cliente of clientes) {
    const rowKey = createHash("sha256")
      .update(cliente.documento)
      .digest("hex");
    await tabela.upsertEntity(
      {
        partitionKey: empresa,
        rowKey,
        ...cliente,
        origem: "inter-cobrancas",
        atualizadoEm,
      },
      "Merge"
    );
  }

  return {
    empresa,
    periodo: { dataInicial, dataFinal },
    cobrancasConsultadas: cobrancas.length,
    clientesSincronizados: clientes.length,
    operacoesTransacionais: false,
  };
}
