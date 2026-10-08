import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { centavosExtrato, validarPlanejamentoFiscal, resumoRegularizacao } from "../lib/regularizacao-fiscal.ts";
const registro={id:"a".repeat(64),empresa:"sysney",centavos:12345,competencia:"",nota:"",notasCandidatas:[],recebimento:"2025-02-11"};
const b={competencia:"2025-01",evidenciaCompetencia:"Memória de cálculo",emissaoPlanejada:"2026-10-09",nota:""};
test("valores de extrato usam centavos exatos e não aceitam débitos/formatos ambíguos",()=>{
 assert.equal(centavosExtrato("1511.56"),151156);assert.equal(centavosExtrato("125.79"),12579);assert.equal(centavosExtrato("1.5"),150);
 for(const v of ["-1","0","1,5","1.234",1,null,"NaN"])assert.throws(()=>centavosExtrato(v));
});
test("competência não é inferida do recebimento, planejamento exige evidência",()=>{
 assert.equal(validarPlanejamentoFiscal(registro,b,"2026-10-08").competencia,"2025-01");
 assert.throws(()=>validarPlanejamentoFiscal(registro,{...b,evidenciaCompetencia:" "},"2026-10-08"));
 assert.throws(()=>validarPlanejamentoFiscal(registro,{...b,competencia:""},"2026-10-08"));
 assert.throws(()=>validarPlanejamentoFiscal(registro,{...b,competencia:"2026-11"},"2026-10-08"));
 assert.throws(()=>validarPlanejamentoFiscal(registro,{...b,emissaoPlanejada:"2026-10-07"},"2026-10-08"));
 assert.throws(()=>validarPlanejamentoFiscal(registro,{...b,emissaoPlanejada:"2027-02-30"},"2026-10-08"));
});
test("não se planeja reemissão de nota vinculada nem se remove vínculo pelo formulário",()=>{
 assert.throws(()=>validarPlanejamentoFiscal({...registro,nota:"4"},b,"2026-10-08"));
 assert.throws(()=>validarPlanejamentoFiscal(registro,{...b,nota:"4"},"2026-10-08"));
 assert.equal(validarPlanejamentoFiscal(registro,{...b,nota:"4",emissaoPlanejada:""},"2026-10-08").nota,"4");
});
test("resumo distingue dinheiro recebido de fiscal ainda não conciliado",()=>{
 const r=resumoRegularizacao([registro,{...registro,id:"b".repeat(64),nota:"4",competencia:"2025-01"}]);
 assert.equal(r.recebido,24690);assert.equal(r.vinculado,12345);assert.equal(r.semNotaVinculada,12345);assert.equal(r.conferir,1);
});
test("API conserva isolamento, ETag e vínculo único em lote atômico",()=>{
 const s=readFileSync(new URL("../app/api/admin/cobrancas/route.ts",import.meta.url),"utf8");
 assert.match(s,/regularizacao-\$\{emp\}/);assert.match(s,/registro\.empresa!==emp/);assert.match(s,/submitTransaction/);assert.match(s,/etag:original\.etag/);assert.match(s,/nota\.centavos!==registro\.centavos/);assert.match(s,/nota\.situacao!=="N"/);
 const trecho=s.slice(s.indexOf('if(body.acao==="planejar-regularizacao")'),s.indexOf('const planosTable'));
 assert.doesNotMatch(trecho,/emitirCobrancaInter|executarNotaSP|sendgrid|mail\.send/);
});
