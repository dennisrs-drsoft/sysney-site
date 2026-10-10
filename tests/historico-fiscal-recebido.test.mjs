import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planejarHistoricoRecebido } from '../admin-api/src/services/historico-fiscal-recebido.mjs';
const opts={empresa:'drsoft',excluidas:['927'],em:'2026-10-10T12:00:00Z',responsavel:'Titular'};
const nota=(numero,situacao='N')=>({numero,situacao,centavos:10000,documento:'12345678000199',cliente:'Cliente',emissao:'2025-02-01',xmlBlob:'privado',descricao:'Serviço'});
test('Exclui atual e canceladas; não inventa datas nem recorrência futura',()=>{
 const r=planejarHistoricoRecebido([nota('1'),nota('2','C'),nota('927')],[],opts);
 assert.equal(r.operacoes.length,1);const o=r.operacoes[0];assert.equal(o.plano.inicio,o.plano.fim);assert.equal(o.cobranca.vencimento,'');assert.equal(o.cobranca.eventos.at(-1).data,'');assert.equal(o.cobranca.eventos.at(-1).fonte,undefined);assert.equal(o.cobranca.eventos.at(-1).centavos,10000);
});
test('Reexecução não duplica recebimentos',()=>{
 const r=planejarHistoricoRecebido([nota('1'),nota('927')],[],opts);
 assert.equal(planejarHistoricoRecebido([nota('1'),nota('927')],[r.operacoes[0].cobranca],opts).operacoes.length,0);
});
test('Exige exceção encontrada, situação válida e identidade única',()=>{
 assert.throws(()=>planejarHistoricoRecebido([nota('1')],[],opts));
 assert.throws(()=>planejarHistoricoRecebido([nota('927'),nota('1','X')],[],opts));
 assert.throws(()=>planejarHistoricoRecebido([nota('927'),nota('1'),nota('1')],[],opts));
 assert.throws(()=>planejarHistoricoRecebido([nota('927'),nota('1')],[],{...opts,empresa:'sysney'}));
});
test('Cobrança atual fica intacta; divergência e estorno bloqueiam',()=>{
 const c={id:'existente',nota:'1',centavos:9000,eventos:[]};
 assert.throws(()=>planejarHistoricoRecebido([nota('927'),nota('1')],[c],opts));
 assert.throws(()=>planejarHistoricoRecebido([nota('927'),nota('1')],[{...c,centavos:10000,eventos:[{tipo:'estorno'}]}],opts));
 const atual={nota:'927',centavos:10000,eventos:[]};planejarHistoricoRecebido([nota('927'),nota('1')],[atual],opts);assert.equal(atual.eventos.length,0);
});
