import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const uri = s => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const compile = p => ts.transpileModule(readFileSync(new URL(p, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const core = uri(compile("../lib/cobrancas.ts"));
const view = uri(compile("../lib/visao-financeira.ts").replaceAll('"./cobrancas"', JSON.stringify(core)));
const { consolidarFinanceiro, filtrarFinanceiro } = await import(view);
const { periodoAnoAnterior, variacaoPercentual, compararFinanceiro, compararNotas, serieMensalNotas, analisarClientes, ordenarClientes, auditarEmissoes } = await import(uri(compile("../lib/analise-financeira.ts").replaceAll('"./cobrancas"', JSON.stringify(core)).replaceAll('"./visao-financeira"', JSON.stringify(view))));
const banco = (id, campos = {}) => ({ id, cliente: "Cliente", documento: "12345678000190", numero: id, emissao: "2026-09-01", vencimento: "2026-10-09", valor: 100, situacao: "RECEBIDO", dataSituacao: "2026-10-09", consultadoEm: "2026-10-10T00:00:00Z", ...campos });
const montar = bs => consolidarFinanceiro([], [], bs, [], "2026-10-15");
test("intervalo inclui as duas pontas e aceita somente inicial/final", () => {
  const rs = montar([banco("1", { vencimento: "2026-10-01" }), banco("2", { vencimento: "2026-10-15" }), banco("3", { vencimento: "2026-10-16" })]);
  const f = { inicio: "2026-10-01", fim: "2026-10-15", por: "vencimento", estado: "", busca: "" };
  assert.equal(filtrarFinanceiro(rs, f).length, 2);
  assert.equal(filtrarFinanceiro(rs, { ...f, inicio: "", fim: "2026-10-15" }).length, 2);
  assert.equal(filtrarFinanceiro(rs, { ...f, inicio: "2026-10-16" }).length, 0);
});
test("comparação anual ajusta 29/02 e rejeita datas inválidas; não divide por zero", () => {
  assert.deepEqual(periodoAnoAnterior("2024-02-29", "2024-03-01"), { inicio: "2023-02-28", fim: "2023-03-01" });
  assert.equal(periodoAnoAnterior("2026-02-30", "2026-03-01"), null);
  assert.equal(variacaoPercentual(100, 0), null); assert.equal(variacaoPercentual(120, 100), 20);
});
test("comparações conservam filtros, excluem previsões e não presumem base anterior ausente", () => {
  const rs = montar([banco("1"), banco("2", { valor: 50, vencimento: "2025-10-09" })]);
  const r = compararFinanceiro(rs, { inicio: "2026-10-01", fim: "2026-10-31", por: "vencimento", estado: "", busca: "Cliente" }, "2026-10-15");
  assert.equal(r.atual.emitidos, 10000); assert.equal(r.anterior.emitidos, 5000);
  assert.equal(compararFinanceiro(rs, { inicio: "", fim: "", por: "vencimento", estado: "", busca: "" }, "2026-10-15"), null);
});
test("perfil de cliente separa baixa no prazo, tardia e sem data; CNPJ prevalece sobre nome", () => {
  const rs = montar([banco("1"), banco("2", { cliente: "Mesmo cliente renomeado", dataSituacao: "2026-10-12" }), banco("3", { dataSituacao: "" })]);
  const [c] = analisarClientes(rs);
  assert.equal(c.liquidadas, 3); assert.equal(c.comData, 2); assert.equal(c.semData, 1);
  assert.equal(c.noPrazo, 1); assert.equal(c.aposVencimento, 1); assert.equal(c.atrasoMaximo, 3);
  assert.equal(c.atrasoMedio, 1.5); assert.equal(c.mesesRecebidos, 1); assert.equal(c.baixasBancarias, 3);
});
test("recebimento usa valor real bancário; desconhecido não entra em perfil nem recebimentos", () => {
  const rs = montar([banco("1", { valorRecebido: 102.5 }), banco("2", { documento: "999", situacao: "DESCONHECIDA" })]);
  assert.equal(rs.find(r => r.id === "inter:1").recebido, 10250);
  assert.equal(analisarClientes(rs).length, 1);
});
test("ranking não classifica cliente sem data como 100% pontual", () => {
  const rs = montar([banco("1", { dataSituacao: "", documento: "111", cliente: "Sem data" }), banco("2", { documento: "222", cliente: "No prazo" })]);
  assert.equal(ordenarClientes(analisarClientes(rs), "pontualidade")[0].nome, "No prazo");
});
test("filtro de baixa usa data de situação somente para cobranças pagas", () => {
  const rs = montar([banco("1"), banco("2", { situacao: "A_RECEBER" })]);
  assert.equal(filtrarFinanceiro(rs, { inicio: "2026-10-01", fim: "2026-10-31", por: "pagamento", estado: "", busca: "" }).length, 1);
});
test("auditoria exige data fiscal e plano; registro de PDF tardio não prova emissão atrasada", () => {
  const base = { id: "1", origem: "sistema", nota: "52", emissaoPrevista: "2026-10-01", emissao: "2026-10-15", emissaoNota: "", estado: "aberto" };
  const r = auditarEmissoes([base, { ...base, id: "2", nota: "", estado: "previsto" }, { ...base, id: "3", emissaoNota: "2026-10-05" }, { ...base, id: "4", nota: "", emissaoPrevista: "2026-11-01" }], "2026-10-15");
  assert.equal(r.pendentes.length, 1); assert.equal(r.tardias.length, 1); assert.equal(r.semDataFiscal.length, 1);
});
test("comparação de notas é fiscal, independente dos boletos, e exclui canceladas", () => {
  const notas = [{numero:"1",cliente:"Cliente",documento:"111",centavos:10000,emissao:"2026-10-05T12:00:00",situacao:"N"},{numero:"2",cliente:"Cliente",documento:"111",centavos:30000,emissao:"2026-10-06",situacao:"C"},{numero:"3",cliente:"Cliente",documento:"111",centavos:5000,emissao:"2025-10-05",situacao:"N"}];
  const r = compararNotas(notas, "2026-10-01", "2026-10-31");
  assert.equal(r.atual.valor, 10000); assert.equal(r.atual.canceladas, 1); assert.equal(r.anterior.valor, 5000);
});

test("série mensal conserva limites parciais, meses vazios e ano anterior equivalente", () => {
  const n = (emissao) => ({numero:emissao,documento:"111",centavos:100,emissao,situacao:"N"});
  const r = serieMensalNotas([n("2026-09-01"), n("2026-09-15"), n("2025-09-15"), n("2026-11-06")], "2026-09-15", "2026-11-05");
  assert.equal(r.length, 3);
  assert.equal(r[0].atual.quantidade, 1); assert.equal(r[0].anterior.quantidade, 1);
  assert.equal(r[1].atual.quantidade, 0); assert.equal(r[2].fim, "2026-11-05");
  assert.equal(r[2].atual.quantidade, 0);
  assert.equal(serieMensalNotas([], "2026-11-05", "2026-09-15").length, 0);
  assert.equal(serieMensalNotas([], "2000-01-01", "2026-12-31").length, 240);
});
