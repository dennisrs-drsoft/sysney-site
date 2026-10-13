import {readFileSync} from "node:fs";
import {test} from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const compile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=uri(compile("../lib/cobrancas.ts"));
const {filtrarFila}=await import(uri(compile("../lib/fila-cobrancas.ts").replaceAll('"./cobrancas"',JSON.stringify(model))));
const {prepararAviso,conferirAviso,saldoAviso}=await import(uri(compile("../lib/avisos-cobranca.ts").replaceAll('"./cobrancas"',JSON.stringify(model))));
const {novoEmail,htmlEmail}=await import(uri(compile("../lib/emails-cobranca.ts").replaceAll('"./cobrancas"',JSON.stringify(model))));
const c={id:"a".repeat(64)+"_2026-09",planoId:"a".repeat(64),competencia:"2026-09",clienteNome:"Cliente Árvore",email:"cliente@example.com",descricao:"Suporte presencial",centavos:350000,envioPrevisto:"2026-09-23",vencimento:"2026-10-10",nota:"928",boleto:"",demonstrativo:true,persistida:true,eventos:[{id:"p1",tipo:"pagamento",centavos:210000,data:"2026-09-25"}]};
const origem={...novoEmail("drsoft",c.clienteNome),id:"origem",competencia:c.competencia,centavos:c.centavos,vencimento:c.vencimento,para:c.email,status:"aceito",fluxo:{cobrancaId:c.id,nota:"928",boleto:""},tentativas:[{status:"aceito",id:"t1"}],anexos:[{tipo:"nota",nome:"nota.pdf",blob:"privado"}],aprovacaoEnvio:{hash:"anterior"}};
test("Fila oculta recebidas por padrão, busca sem acentos e filtra intervalo inclusivo",()=>{
 const paga={...c,id:"paga",vencimento:"",eventos:[{id:"p",tipo:"pagamento",centavos:350000}]};
 const f={busca:"arvore",situacao:"abertas",inicio:"2026-10-10",fim:"2026-10-10",data:"vencimento"};
 assert.deepEqual(filtrarFila([c,paga],f,"2026-10-13"),[c]);
 assert.equal(filtrarFila([c,paga],{...f,busca:"928",situacao:"pagas",inicio:"",fim:""},"2026-10-13").length,1);
 assert.equal(filtrarFila([c],{...f,inicio:"2026-10-11"},"2026-10-13").length,0);
 assert.equal(filtrarFila([c],{...f,busca:"",data:"competencia",inicio:"2026-09-01",fim:"2026-09-30"},"2026-10-13").length,1);
 const arquivo=readFileSync(new URL("../app/admin/fila-cobrancas.tsx",import.meta.url),"utf8");
 assert.match(arquivo,/ordem\.ordenadas\.slice/);assert.match(arquivo,/Paginação das cobranças/);assert.match(arquivo,/Histórico de avisos/);
});
test("Aviso reutiliza PDFs, cobra saldo parcial e mantém origem e aprovações separados",()=>{
 const e=prepararAviso(origem,c,"atraso","2026-10-13","novo","agora");
 assert.equal(e.aviso.saldoCentavos,140000);assert.equal(e.aviso.recebidoCentavos,210000);
 assert.equal(e.fluxo,undefined);assert.equal(e.aprovacaoEnvio,undefined);assert.equal(e.tentativas.length,0);assert.equal(e.status,"rascunho");assert.deepEqual(e.anexos,origem.anexos);
 assert.equal(origem.status,"aceito");assert.equal(origem.tentativas.length,1);
 assert.doesNotThrow(()=>conferirAviso(e,c,"2026-10-13"));
 assert.match(htmlEmail(e),/Saldo em aberto/);assert.match(htmlEmail(e),/1\.400,00/);assert.match(e.observacoes,/comprovante/);assert.match(e.observacoes,/contrato/);
});
test("Avisos bloqueiam quitação, saldo alterado, resultado incerto e data expirada",()=>{
 const e=prepararAviso(origem,c,"atraso","2026-10-13","novo","agora");
 assert.throws(()=>conferirAviso(e,{...c,eventos:[...c.eventos,{tipo:"pagamento",centavos:140000}]} ,"2026-10-13"));
 assert.throws(()=>conferirAviso(e,{...c,eventos:[...c.eventos,{tipo:"pagamento",centavos:10000}]} ,"2026-10-13"));
 assert.throws(()=>conferirAviso(e,c,"2026-10-14"));
 assert.throws(()=>prepararAviso({...origem,status:"incerto"},c,"atraso","2026-10-13","novo","agora"));
 assert.throws(()=>saldoAviso(c,"vencimento","2026-10-13"));assert.throws(()=>saldoAviso(c,"lembrete","2026-10-13"));assert.throws(()=>saldoAviso(c,"atraso","2026-10-10"));
 assert.throws(()=>conferirAviso({...e,cc:"drsoft.log@gmail.com"},c,"2026-10-13"));
});
