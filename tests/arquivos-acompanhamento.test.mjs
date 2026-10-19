import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const fonte = readFileSync(new URL("../lib/arquivos-acompanhamento.ts", import.meta.url), "utf8");
const js = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { emailsDaCobranca, notasDaCobranca } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
test("arquivos exigem vínculo explícito e empresa; cobrança paga permanece acessível", () => {
  const original = { id: "original", empresa: "drsoft", status: "aceito", fluxo: { cobrancaId: "c1" } };
  assert.deepEqual(emailsDaCobranca([original, { ...original, empresa: "sysney" }, { ...original, fluxo: { cobrancaId: "c2" } }, { ...original, aviso: {} }, { id: "sem-vinculo", empresa: "drsoft" }], "drsoft", "c1"), [original]);
});
test("nota usa referência exata; não associa número parcial nem referência ausente", () => {
  const notas = [{ numero: "928" }, { numero: "1928" }];
  assert.deepEqual(notasDaCobranca(notas, "000928"), [notas[0]]);
  assert.deepEqual(notasDaCobranca(notas, ""), []);
  assert.deepEqual(notasDaCobranca(notas, "92"), []);
});
test("acesso no acompanhamento é consulta: sem emissão ou envio; falhas parciais e atualização", () => {
  const ui = readFileSync(new URL("../app/admin/arquivos-acompanhamento.tsx", import.meta.url), "utf8");
  assert.match(ui, /Promise.allSettled/);
  assert.match(ui, /controller.abort/);
  assert.match(ui, /encodeURIComponent\(a.emailId\)/);
  assert.doesNotMatch(ui, /method:\s*["']POST/);
  const tela = readFileSync(new URL("../app/admin/cobrancas.tsx", import.meta.url), "utf8");
  assert.match(tela, /<ArquivosAcompanhamento empresa=\{empresa\} c=\{c\}/);
});
