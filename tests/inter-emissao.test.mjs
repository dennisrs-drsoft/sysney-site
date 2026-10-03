import test from "node:test";
import assert from "node:assert/strict";
import { emitirCobrancaInter, consultarCobrancaInter } from "../admin-api/src/services/inter.js";

test("Inter: emissão permanece desabilitada por padrão e rejeita entrada inválida antes de acessar o cofre", async () => {
  const anterior = process.env.INTER_WRITE_OPERATIONS_ENABLED;
  try {
    delete process.env.INTER_WRITE_OPERATIONS_ENABLED;
    await assert.rejects(emitirCobrancaInter({ empresa:"sysney", competencia:"2026-10", payload:{} }), /não habilitada/);
    process.env.INTER_WRITE_OPERATIONS_ENABLED = "true";
    await assert.rejects(emitirCobrancaInter({ empresa:"drsoft", competencia:"2026-10", payload:{} }), /inválida/);
    await assert.rejects(emitirCobrancaInter({ empresa:"sysney", competencia:"2026-99", payload:{} }), /inválida/);
    await assert.rejects(emitirCobrancaInter({ empresa:"sysney", competencia:"2026-10", payload:{} }), /incompleta/);
    await assert.rejects(consultarCobrancaInter("sysney", "../outro"), /inválido/);
  } finally {
    if (anterior === undefined) delete process.env.INTER_WRITE_OPERATIONS_ENABLED;
    else process.env.INTER_WRITE_OPERATIONS_ENABLED = anterior;
  }
});
