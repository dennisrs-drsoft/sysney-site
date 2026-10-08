import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const uri = s => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const compile = p => ts.transpileModule(readFileSync(new URL(p, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const cobrancas = uri(compile("../lib/cobrancas.ts"));
const { consolidarFinanceiro, resumoFinanceiro, filtrarFinanceiro } = await import(uri(compile("../lib/visao-financeira.ts").replaceAll('"./cobrancas"', JSON.stringify(cobrancas))));
const hoje = "2026-10-05";
const plano = { id: "plano", documento: "12.345.678/0001-90" };
const c = (campos = {}) => ({ id: "c1", planoId: "plano", clienteNome: "Cliente", competencia: "2026-09", centavos: 10000, vencimento: "2026-10-09", nota: "", boleto: "", eventos: [], ...campos });
const b = (campos = {}) => ({ id: "b1", cliente: "Cliente", documento: "12345678000190", numero: "51", nossoNumero: "123", emissao: "2026-09-01", vencimento: "2026-10-09", valor: 100, situacao: "A_RECEBER", dataSituacao: "2026-09-01", consultadoEm: "2026-10-02T12:00:00Z", ...campos });
const montar = (cs = [], bs = [], es = []) => consolidarFinanceiro(cs, [plano], bs, es, hoje);

test("previsão não entra no saldo a receber; aprovação não confirma pagamento", () => {
  const linhas = montar([c()], [], [{ fluxo: { cobrancaId: "c1", documentos: {} }, competencia: "2026-09", centavos: 10000, vencimento: "2026-10-09", tentativas: [], aprovacaoEnvio: {} }]);
  const r = resumoFinanceiro(linhas, hoje);
  assert.equal(r.previsto, 10000); assert.equal(r.receber, 0); assert.equal(r.recebido, 0);
});
test("mesmo nosso número e dados compatíveis une banco e sistema apenas uma vez", () => {
  const linhas = montar([c({ nota: "51", boleto: "000123" })], [b({ situacao: "RECEBIDO" })]);
  assert.equal(linhas.length, 1); assert.equal(linhas[0].origem, "integrado");
  assert.equal(linhas[0].estado, "pago"); assert.equal(resumoFinanceiro(linhas, hoje).recebido, 10000);
});
test("coincidência de valor/documento/data não presume vínculo: exclui possíveis duplicatas dos totais", () => {
  const linhas = montar([c({ nota: "51", boleto: "456" })], [b()]);
  assert.equal(linhas.length, 2); assert.ok(linhas.every(r => r.estado === "conferir"));
  const r = resumoFinanceiro(linhas, hoje); assert.equal(r.receber, 0); assert.equal(r.conferir, 2);
});
test("canceladas, expiradas e situação desconhecida não viram contas vencidas", () => {
  const linhas = montar([], [b({ situacao: "CANCELADO", vencimento: "2026-01-01" }), b({ id: "b2", situacao: "EXPIRADO" }), b({ id: "b3", situacao: "OUTRA" })]);
  const r = resumoFinanceiro(linhas, hoje); assert.equal(r.receber, 0); assert.equal(r.vencido, 0); assert.equal(r.conferir, 1);
});
test("pagamento parcial e estorno preservam saldo, com janelas de vencimento acumuladas", () => {
  const linhas = montar([c({ nota: "51", eventos: [
    { id: "p1", tipo: "pagamento", centavos: 2000 }, { id: "p2", tipo: "pagamento", centavos: 3000 },
    { id: "e1", tipo: "estorno", referencia: "p1" },
  ] })]);
  const r = resumoFinanceiro(linhas, hoje); assert.equal(r.recebido, 3000); assert.equal(r.receber, 7000); assert.equal(r.sete, 7000); assert.equal(r.trinta, 7000);
});
test("snapshot antigo não apaga pagamento posterior registrado no sistema", () => {
  const linhas = montar([c({ nota: "51", boleto: "123", eventos: [{ id: "p1", tipo: "pagamento", centavos: 10000, registradoEm: "2026-10-04T12:00:00Z" }] })], [b()]);
  assert.equal(linhas[0].estado, "pago"); assert.equal(linhas[0].saldo, 0);
});
test("competência desconhecida no banco não é inferida; vencimento permite ver histórico", () => {
  const linhas = montar([], [b()]);
  assert.equal(filtrarFinanceiro(linhas, { mes: "2026-09", por: "competencia", estado: "", busca: "" }).length, 0);
  assert.equal(filtrarFinanceiro(linhas, { mes: "2026-10", por: "vencimento", estado: "", busca: "12345678" }).length, 1);
});
test("identificador repetido no sistema exige conferência em vez de duplicar recebimentos", () => {
  const linhas = montar([c({ boleto: "123" }), c({ id: "c2", boleto: "123" })], [b({ situacao: "RECEBIDO" })]);
  assert.ok(linhas.every(r => r.estado === "conferir")); assert.equal(resumoFinanceiro(linhas, hoje).recebido, 0);
});
test("envio aceito gera pendência financeira, nunca pagamento", () => {
  const linhas = montar([c({ eventos: [{ tipo: "envio" }] })]);
  assert.equal(linhas[0].envio, true); assert.equal(resumoFinanceiro(linhas, hoje).recebido, 0); assert.equal(resumoFinanceiro(linhas, hoje).receber, 10000);
});
