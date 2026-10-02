import { validarAutenticacaoInter } from "../src/services/inter.js";

process.env.KEY_VAULT_URI ??= "https://sysney-admin-kv-2602.vault.azure.net/";

try {
  await validarAutenticacaoInter("sysney");
  console.log("Autenticação da SYSNEY no Banco Inter confirmada.");
} catch (erro) {
  console.error(`Falha na autenticação da SYSNEY: ${erro.message}`);
  process.exitCode = 1;
}
