import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const source = readFileSync(new URL("../lib/cobrancas.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { dataMensal, dataValida, carteira, prevista, pago, situacao, integrarEnvios, validarAlteracaoVencimento } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const plano = { id: "p1", inicio: "2026-08", fim: "", clienteNome: "Cliente de teste", descricao: "Suporte", email: "teste@example.com", centavos: 123456, diaEnvio: 4, mesEnvio: 1, diaVencimento: 8, mesVencimento: 2 };

test("alterar vencimento preserva a recorrência e impede alteração após documentos ou tentativas",()=>{
 const c=prevista(plano,"2026-08");
 const e={status:"rascunho",tentativas:[],anexos:[],fluxo:{cobrancaId:c.id,nota:"",boleto:""}};
 assert.doesNotThrow(()=>validarAlteracaoVencimento(c,e,"2026-10-09","2026-10-05"));
 assert.equal(c.vencimento,"2026-10-08");assert.equal(plano.diaVencimento,8);
 for(const v of ["2026-02-30","2026-10-04","2026-08-01",""])assert.throws(()=>validarAlteracaoVencimento(c,e,v,"2026-10-05"));
 for(const status of ["enviando","aceito","incerto","emitindo_documento"])assert.throws(()=>validarAlteracaoVencimento(c,{...e,status},"2026-10-09","2026-10-05"));
 for(const patch of [{nota:"926"},{boleto:"112"},{eventos:[{tipo:"pagamento"}]},{eventos:[{tipo:"envio"}]}])assert.throws(()=>validarAlteracaoVencimento({...c,...patch},e,"2026-10-09","2026-10-05"));
 for(const patch of [{anexos:[{}]},{tentativas:[{status:"incerto"}]},{fluxo:{...e.fluxo,nota:"926"}},{fluxo:{...e.fluxo,boleto:"1"}},{fluxo:{...e.fluxo,cobrancaId:"outro"}}])assert.throws(()=>validarAlteracaoVencimento(c,{...e,...patch},"2026-10-09","2026-10-05"));
 const corrigida={...c,vencimento:"2026-10-09",eventos:[{tipo:"alteracao"}],persistida:true};
 assert.doesNotThrow(()=>validarAlteracaoVencimento(corrigida,e,"2026-10-12","2026-10-05"));
 assert.equal(carteira([plano],[corrigida],"2026-09").find(x=>x.id===c.id).vencimento,"2026-10-09");
});

test("acompanhamento reconhece aceitação, sem duplicar ou inferir recebimento",()=>{
 const c=prevista(plano,"2026-08");
 const email={empresa:"sysney",competencia:c.competencia,centavos:c.centavos,vencimento:c.vencimento,fluxo:{cobrancaId:c.id},tentativas:[{id:"tentativa",status:"aceito",data:"2026-10-03T02:56:29Z",messageId:"protocolo"}]};
 const [r]=integrarEnvios([c],[email],"sysney");
 assert.equal(r.eventos[0].data,"2026-10-02");assert.equal(c.eventos.length,0);
 assert.equal(situacao(r,"2026-10-03"),"Aguardando pagamento");assert.equal(pago(r),0);
 assert.equal(integrarEnvios([r],[email],"sysney")[0].eventos.length,1);
 assert.equal(integrarEnvios([c],[email],"drsoft")[0].eventos.length,0);
 assert.equal(integrarEnvios([c],[{...email,centavos:1}],"sysney")[0].eventos.length,0);
 assert.equal(integrarEnvios([c],[{...email,tentativas:[{...email.tentativas[0],status:"incerto"}]}],"sysney")[0].eventos.length,0);
});
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
