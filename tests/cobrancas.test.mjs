import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const source = readFileSync(new URL("../lib/cobrancas.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { dataMensal, dataValida, carteira, prevista, pago, situacao } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const plano = { id: "p1", inicio: "2026-08", fim: "", clienteNome: "Cliente de teste", descricao: "Suporte", email: "teste@example.com", centavos: 123456, diaEnvio: 4, mesEnvio: 1, diaVencimento: 8, mesVencimento: 2 };
test("competência, envio e vencimento em meses distintos", () => {
  const c = prevista(plano, "2026-08");
  assert.equal(c.envioPrevisto, "2026-09-04");
  assert.equal(c.vencimento, "2026-10-08");
});
test("dias 31 ajustados em fevereiro e virada do ano", () => {
  assert.equal(dataMensal("2026-01", 1, 31), "2026-02-28");
  assert.equal(dataMensal("2024-01", 1, 31), "2024-02-29");
  assert.equal(dataMensal("2026-12", 1, 10), "2027-01-10");
  assert.equal(dataValida("2026-02-30"), false);
});
test("envio não significa pagamento; atraso começa após o vencimento", () => {
  const c = prevista(plano, "2026-08");
  assert.equal(situacao(c, "2026-09-03"), "Programado");
  assert.equal(situacao(c, "2026-09-04"), "Enviar cobrança");
  c.eventos.push({ tipo: "envio" });
  assert.equal(situacao(c, "2026-10-08"), "Aguardando pagamento");
  assert.equal(situacao(c, "2026-10-09"), "Atrasado");
});
test("pagamento parcial, quitação e correção preservam saldo", () => {
  const c = prevista(plano, "2026-08");
  c.eventos.push({ id: "a", tipo: "pagamento", centavos: 10000 });
  assert.equal(pago(c), 10000);
  assert.equal(situacao(c, "2026-10-08"), "Pagamento parcial");
  c.eventos.push({ id: "b", tipo: "pagamento", centavos: 113456 });
  assert.equal(situacao(c, "2026-10-09"), "Pago");
  c.eventos.push({ tipo: "estorno", referencia: "b" });
  assert.equal(pago(c), 10000);
  assert.equal(situacao(c, "2026-10-09"), "Atrasado");
});
test("recorrência não duplica competência e preserva o valor já registrado", () => {
  const c = { ...prevista(plano, "2026-08"), persistida: true };
  const lista = carteira([{ ...plano, centavos: 900000 }], [c], "2026-10");
  assert.equal(lista.length, 3);
  assert.equal(lista.find(x => x.id === c.id).centavos, 123456);
  assert.equal(carteira([{ ...plano, fim: "2026-09" }], [], "2026-12").length, 2);
});
