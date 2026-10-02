import {
  dataValida,
  periodoPadrao,
  sincronizarClientesInter,
} from "../src/services/clientes-inter.js";

process.env.KEY_VAULT_URI ??= "https://sysney-admin-kv-2602.vault.azure.net/";
process.env.ADMIN_STORAGE_ACCOUNT ??= "sysneyadm2602";
process.env.ADMIN_STORAGE_TABLE_CLIENTES ??= "AdminClientes";

const padrao = periodoPadrao();
const dataInicial = process.argv[2] || padrao.dataInicial;
const dataFinal = process.argv[3] || padrao.dataFinal;

if (!dataValida(dataInicial) || !dataValida(dataFinal)) {
  console.error("Informe as datas no formato AAAA-MM-DD.");
  process.exit(1);
}

try {
  const resultado = await sincronizarClientesInter({
    empresa: "sysney",
    dataInicial,
    dataFinal,
  });
  console.log(
    `Consulta concluída: ${resultado.cobrancasConsultadas} cobranças e ` +
      `${resultado.clientesSincronizados} clientes sincronizados.`
  );
} catch (erro) {
  console.error(`Falha na sincronização: ${erro.message}`);
  process.exitCode = 1;
}
