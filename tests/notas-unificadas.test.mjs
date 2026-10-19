import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const js = ts.transpileModule(readFileSync(new URL("../lib/notas-unificadas.ts", import.meta.url), "utf8"), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {unificarNotas,filtrarNotas} = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const email = {id:"e928",empresa:"drsoft",cliente:"TWENTY FOUR SEVEN FRANQUIA LTDA",para:"financeiro@tfseven.com.br",contato:"Álvaro",fluxo:{nota:"928",cobrancaId:"c1"},anexos:[{tipo:"nota"}],atualizadoEm:"2026-10-13T13:35:00Z",competencia:"2026-09",centavos:350000};
const historica = {numero:"000928",cliente:email.cliente,documento:"12345678000190",emissao:"2026-10-13",centavos:350000,situacao:"C",pdf:false,xml:true,consultadoEm:"2026-10-19"};
test("nota928 aparece com PDF sem histórico, sem inventar data ou situação fiscal",()=>{
 const [n]=unificarNotas([], [email], "drsoft");
 assert.equal(n.numero,"928");assert.equal(n.emailPdf,"e928");assert.equal(n.emissao,"");assert.equal(n.situacao,"Registrada na cobrança");assert.equal(n.xml,false);
 assert.equal(filtrarNotas([n],"TFSeven","2026-09-01","2026-10-19").length,1);
 assert.equal(filtrarNotas([n],"928","2026-09-01","2026-10-19",false).length,0);
});
test("histórico e sistema não duplicam; cancelamento, data e XML oficiais prevalecem",()=>{
 const rows=unificarNotas([historica],[email,{...email,id:"e2",atualizadoEm:"2026-10-12"}],"drsoft");
 assert.equal(rows.length,1);assert.equal(rows[0].origem,"ambos");assert.equal(rows[0].situacao,"C");assert.equal(rows[0].emissao,"2026-10-13");assert.equal(rows[0].xml,true);assert.equal(rows[0].emailPdf,"e928");
 assert.equal(historica.pdf,false);
});
test("TFSeven encontra razão social histórica; busca ignora acentos e pontuação",()=>{
 const rows=unificarNotas([historica],[],"drsoft");
 assert.equal(filtrarNotas(rows,"TFSeven","","").length,1);
 assert.equal(filtrarNotas(rows,"12.345.678/0001-90","","").length,1);
 assert.equal(filtrarNotas(unificarNotas([],[email],"drsoft"),"Alvaro","","").length,1);
 assert.equal(filtrarNotas(rows,"TFSeven","2026-11-01","").length,0);
});
test("exclui outra empresa, avisos e rascunhos sem nota; não depende de pagamento",()=>{
 assert.equal(unificarNotas([], [email],"sysney").length,0);
 assert.equal(unificarNotas([], [{...email,aviso:{}},{...email,fluxo:{cobrancaId:"c1",nota:""}}],"drsoft").length,0);
 assert.equal(unificarNotas([], [{...email,anexos:[]}],"drsoft")[0].emailPdf,undefined);
});
test("consulta parcial e proteção por empresa; links existentes e nenhuma mutação",()=>{
 const ui=readFileSync(new URL("../app/admin/historico-fiscal.tsx",import.meta.url),"utf8");
 assert.match(ui,/Promise.allSettled/);assert.match(ui,/empresaCarregada === empresa/);assert.match(ui,/encodeURIComponent\(n.emailPdf\)/);assert.match(ui,/MensagemAdmin/);assert.doesNotMatch(ui,/method:\s*["']POST/);
});
