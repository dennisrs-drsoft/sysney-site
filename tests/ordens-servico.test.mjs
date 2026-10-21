import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const code=ts.transpileModule(readFileSync(new URL("../lib/ordens-servico.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {calcularOS,resumirOS,validarEntradaOS,validarRegrasOS,selecionarParaCobrancaOS,valorMonetarioOS}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
test("valores monetários aceitam vírgula e ponto sem confundir centavos",()=>{
 assert.equal(valorMonetarioOS("62,50"),6250);assert.equal(valorMonetarioOS("62.50"),6250);
 assert.equal(valorMonetarioOS("1.234,56"),123456);assert.equal(valorMonetarioOS(""),null);
 assert.ok(Number.isNaN(valorMonetarioOS("abc")));
});
const regras={horaCentavos:6200,diariaCentavos:null,minimoMinutos:0,arredondamentoMinutos:1,adicionalBps:600};
const ordem=(id="1",mais={})=>({id,clienteId:"cliente",clienteNome:"Cliente demonstração",documento:"11111111111111",estado:"aberta",data:"2026-08-01",diaFim:"2026-08-01",inicio:"08:00",fim:"09:00",intervaloMinutos:0,tipo:"hora",quantidadeCentesimos:100,valorFixoCentavos:0,descricao:"Serviço demonstrativo",regras,...mais});
test("reproduz seis durações de 27h40, serviço1715,33 e total1818,25 com6%",()=>{
 const pares=[["16:30","17:45"],["16:30","19:45"],["16:30","20:30"],["11:00","18:00"],["10:00","14:40"],["10:00","17:30"]];
 const rows=pares.map(([inicio,fim],i)=>ordem(String(i),{inicio,fim}));
 assert.deepEqual(resumirOS(rows),{minutos:1660,subtotal:171533,adicional:10292,total:181825,adicionalBps:600});
});
test("precisão fracionária é mantida até o total; não soma arredondamentos de linhas",()=>{
 const r={...regras,horaCentavos:1,adicionalBps:0};
 const lista=[ordem("a",{inicio:"08:00",fim:"08:20",regras:r}),ordem("b",{inicio:"09:00",fim:"09:20",regras:r}),ordem("c",{inicio:"10:00",fim:"10:20",regras:r})];
 assert.equal(lista.reduce((s,o)=>s+calcularOS(o,r).centavos,0),0);assert.equal(resumirOS(lista).total,1);
});
test("intervalo, mínimo e incremento seguem regra congelada; virada exige datafinal",()=>{
 const o=ordem("1",{fim:"08:50",intervaloMinutos:10});assert.equal(calcularOS(o,{...regras,minimoMinutos:60,arredondamentoMinutos:30}).faturaveis,60);
 assert.equal(calcularOS(ordem("2",{fim:"09:01"}),{...regras,arredondamentoMinutos:15}).faturaveis,75);
 assert.throws(()=>validarEntradaOS(ordem("3",{inicio:"23:00",fim:"01:00"})));
 assert.equal(calcularOS(ordem("4",{inicio:"23:00",fim:"01:00",diaFim:"2026-08-02"}),regras).minutos,120);
 assert.throws(()=>calcularOS(ordem("5",{intervaloMinutos:60}),regras));
});
test("diária sem valor bloqueia; quantidade e preço configurados; fixo validado",()=>{
 assert.throws(()=>calcularOS(ordem("d",{tipo:"diaria"}),regras));
 assert.equal(calcularOS(ordem("d",{tipo:"diaria",quantidadeCentesimos:150}),{...regras,diariaCentavos:100000}).centavos,150000);
 assert.equal(calcularOS(ordem("f",{tipo:"fixo",valorFixoCentavos:35000}),regras).centavos,35000);
 assert.throws(()=>calcularOS(ordem("f",{tipo:"fixo"}),regras));
 assert.throws(()=>validarRegrasOS({...regras,horaCentavos:-1}));assert.throws(()=>validarRegrasOS({...regras,adicionalBps:NaN}));
});
test("histórico, já cobrado e reservado nunca geram nova cobrança; clientes e regras distintos bloqueiam",()=>{
 for(const estado of ["historico","cobrada","reservada","cancelada"])assert.throws(()=>selecionarParaCobrancaOS([ordem("1",{estado})],["1"]));
 assert.throws(()=>resumirOS([ordem("1"),ordem("2",{clienteId:"outro"})]));
 assert.throws(()=>resumirOS([ordem("1"),ordem("2",{regras:{...regras,horaCentavos:7000}})]));assert.throws(()=>resumirOS([ordem(),ordem()]));
});
test("ampliação do resumo da importação não aumenta o limite padrão de cobrança",()=>{
 const linhas=Array.from({length:41},(_,i)=>ordem(String(i)));
 assert.throws(()=>resumirOS(linhas));assert.throws(()=>selecionarParaCobrancaOS(linhas,linhas.map(o=>o.id)));
 assert.equal(resumirOS(linhas,1000).total,269452);
});
test("API mantém autenticação, origem, tamanho, segregação e PDFs somente leitura",()=>{
 const ui=readFileSync(new URL("../app/admin/ordens-servico.tsx",import.meta.url),"utf8"),api=readFileSync(new URL("../app/api/admin/ordens-servico/route.ts",import.meta.url),"utf8");
 assert.match(api,/usuarioAdministrador/);assert.match(api,/req.headers.get\("origin"\)!==req.nextUrl.origin/);assert.match(api,/lerCorpoLimitado\(req,excel\?LIMITE_EXCEL_OS:64000\)/);assert.match(api,/no-store/);assert.match(ui,/useConfirmarAdmin/);assert.match(ui,/Retomar lote/);assert.doesNotMatch(ui,/window.confirm|window.alert/);
});
