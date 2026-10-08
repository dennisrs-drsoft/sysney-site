import {test} from "node:test";
import assert from "node:assert/strict";
import {normalizarPix,compativelPix,paresPix,paresNotas} from "../admin-api/src/services/conciliacao-regras.mjs";
import {vincularPix,sincronizarPix,partPix} from "../admin-api/src/services/conciliacao-inter.js";
import {integrarPagamentosPix} from "../lib/cobrancas.ts";
const c={id:"c1",planoId:"p",centavos:10000,vencimento:"2026-10-09",boleto:"",eventos:[]};
const regra={tipo:"regra",cobrancaId:c.id,documento:"12345678000190",centavos:c.centavos,vencimento:c.vencimento,inicio:"2026-10-01",fim:"2026-10-31",automatica:true,_rowKey:"regra",_etag:"1"};
const bruto={tipoTransacao:"PIX",tipoOperacao:"C",idTransacao:"bank-id",valor:"100.00",dataTransacao:"2026-10-09",detalhes:{endToEndId:"E123",cpfCnpjPagador:regra.documento,nomePagador:"Cliente"}};
const pix=normalizarPix(bruto,"2026-10-09T15:00:00Z");
test("normaliza apenas créditos PIX identificados, nunca débitos, devoluções ou valores inválidos",()=>{
 assert.equal(pix.documento,regra.documento);assert.equal(pix.centavos,10000);
 for(const extra of [{tipoOperacao:"D"},{tipoTransacao:"BOLETO"},{titulo:"Devolução PIX"},{valor:"-100"},{valor:"abc"},{detalhes:{}},{dataTransacao:"inválido"}])assert.equal(normalizarPix({...bruto,...extra},"agora"),null);
});
test("baixa automática requer regra autorizada e unicidade nos dois sentidos",()=>{
 assert.deepEqual(paresPix([c],[regra],[pix]),[{cobrancaId:c.id,pixId:pix.id}]);
 assert.equal(paresPix([c],[{...regra,automatica:false}],[pix]).length,0);
 assert.equal(paresPix([c],[regra],[pix,{...pix,id:"outro"}]).length,0);
 assert.equal(paresPix([c,{...c,id:"c2"}],[regra,{...regra,cobrancaId:"c2"}],[pix]).length,0);
 assert.equal(paresPix([c],[regra],[pix],[pix.id]).length,0);
 for(const extra of [{boleto:"123"},{centavos:9999},{vencimento:"2026-10-10"},{eventos:[{tipo:"pagamento"}]},{eventos:[{tipo:"estorno"}]}])assert.equal(compativelPix({...c,...extra},regra,pix),false);
 for(const extra of [{documento:"outro"},{centavos:9999},{data:"2026-09-01"}])assert.equal(compativelPix(c,regra,{...pix,...extra}),false);
});
test("reserva de PIX e cobrança é atômica e usa somente uma partição",async()=>{
 let acoes;
 await vincularPix({submitTransaction:async a=>{acoes=a;}},c,regra,pix,"Admin","teste");
 assert.equal(acoes.length,3);assert.ok(acoes.every(a=>a[1].partitionKey===partPix));assert.equal(acoes[2][3].etag,"1");
 assert.equal(JSON.parse(acoes[0][1].json).pixId,pix.id);
 await assert.rejects(()=>vincularPix({submitTransaction:async()=>{throw Error("não deveria chegar");}},{...c,boleto:"123"},regra,pix,"Admin","teste"),/incompatível/);
});
test("projeção PIX não duplica manual, preserva estorno e valida versão/documento",()=>{
 const v={tipo:"vinculo",cobrancaId:c.id,pixId:pix.id,documento:pix.documento,centavos:pix.centavos,vencimento:c.vencimento,data:pix.data,em:"2026-10-09T15:00:00Z",responsavel:"Banco",modo:"automatico"};
 const p=[{id:"p",documento:regra.documento}],e=[{formaPagamento:"pix",fluxo:{cobrancaId:c.id},centavos:c.centavos,vencimento:c.vencimento}];
 assert.equal(integrarPagamentosPix([c],p,[v],e)[0].eventos[0].fonte,"banco");
 for(const change of [{documento:"outro"},{centavos:1},{vencimento:"2026-10-10"},{data:"inválido"}])assert.equal(integrarPagamentosPix([c],p,[{...v,...change}],e)[0].eventos.length,0);
 const manual={...c,eventos:[{tipo:"pagamento",centavos:10}]};assert.equal(integrarPagamentosPix([manual],p,[v],e)[0],manual);
 assert.equal(integrarPagamentosPix([c],p,[v,{...v,cobrancaId:"outro"}],e)[0].eventos.length,0);
 assert.equal(integrarPagamentosPix([c],p,[v],[])[0].eventos.length,0);
});
test("cruzamento fiscal exige referência explícita, não valor/nome; rejeita canceladas e repetidas",()=>{
 const b={id:"b1",cobranca:{seuNumero:"000048",dataEmissao:"2026-09-04",valorNominal:100,situacao:"RECEBIDO",pagador:{cpfCnpj:regra.documento}},boleto:{nossoNumero:"111"}};
 const n={numero:"48",documento:regra.documento,centavos:10000,situacao:"N",emissao:"2026-09-04T15:00:00"};
 assert.equal(paresNotas([b],[n])[0].numero,"48");
 for(const extra of [{situacao:"C"},{documento:"outro"},{centavos:9999},{emissao:"2026-09-05"}])assert.equal(paresNotas([b],[{...n,...extra}]).length,0);
 assert.equal(paresNotas([b,{...b,id:"b2"}],[n]).length,0);
 assert.equal(paresNotas([{...b,cobranca:{...b.cobranca,seuNumero:"sem referência"}}],[n]).length,0);
 assert.equal(paresNotas([{...b,cobranca:{...b.cobranca,seuNumero:"SYS202610LEV"}}],[n],[{nota:"48",boleto:"111"}]).length,1);
});
test("extrato incompleto impede todas as baixas; paginação é limitada",async()=>{
 let escritas=0,consultas=0;const table={upsertEntity:async()=>{escritas++;}};
 await assert.rejects(()=>sincronizarPix(table,async()=>({transacoes:null,totalPaginas:1})),/incompleto/);
 await assert.rejects(()=>sincronizarPix(table,async()=>{consultas++;return{transacoes:[bruto],totalPaginas:6,ultimaPagina:false};}),/limite/);
 assert.equal(escritas,0);assert.equal(consultas,5);
});
