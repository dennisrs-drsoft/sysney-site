import {readFileSync} from "node:fs";
import {test} from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const compile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=uri(compile("../lib/cobrancas.ts"));
const {novoEmail,htmlEmail,validarDesconto}=await import(uri(compile("../lib/emails-cobranca.ts").replaceAll('"./cobrancas"',JSON.stringify(model))));
test("Desconto comercial separa original e total sem desconto duplo",()=>{
 const e={...novoEmail("drsoft"),centavos:350000,descontoCentavos:25000,descontoMotivo:"Condição comercial <aprovada>"};
 validarDesconto(e);const html=htmlEmail(e);
 assert.match(html,/Valor original/);assert.match(html,/3\.750,00/);assert.match(html,/250,00/);assert.match(html,/Total com desconto/);assert.match(html,/3\.500,00/);assert.match(html,/&lt;aprovada&gt;/);
 assert.equal(e.centavos,350000);
 assert.doesNotThrow(()=>validarDesconto({...novoEmail("sysney"),centavos:100}));
 assert.doesNotMatch(htmlEmail({...novoEmail("sysney"),centavos:100}),/Desconto comercial/);
});
test("Desconto rejeita negativos, frações, limites e motivo ausente",()=>{
 const base={centavos:350000,descontoMotivo:"Comercial"};
 for(const descontoCentavos of [-1,1.5,NaN,Infinity,10000000000])assert.throws(()=>validarDesconto({...base,descontoCentavos}));
 assert.throws(()=>validarDesconto({...base,descontoCentavos:25000,descontoMotivo:""}));
 assert.throws(()=>validarDesconto({...base,centavos:0,descontoCentavos:25000}));
});
