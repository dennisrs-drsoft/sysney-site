import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compararPgdas} from '../lib/pgdas.ts';
const apuracao=(mes,receita=10000,debito=600)=>({mes,receita,debito,rbt12:100000,declaracao:'teste',regime:'Competência',atividade:'teste',importadoEm:'teste',rbt12p:null});
const nota=(emissao,situacao='N')=>({numero:'1',emissao,situacao,centavos:10000,documento:'1',cliente:'Cliente'});
test('PGDAS não presume ausência como zero e não usa canceladas no faturamento',()=>{
 const rows=compararPgdas([apuracao('2026-01')],[nota('2026-01-10'),nota('2026-01-15','C'),nota('2026-02-10')],'','');
 assert.equal(rows[0].fiscal,10000);assert.equal(rows[0].canceladas,1);assert.equal(rows[0].diferenca,0);assert.equal(rows[0].aliquota,6);
 assert.equal(rows[1].apuracao,undefined);assert.equal(rows[1].diferenca,null);assert.equal(rows[1].aliquota,null);
});
test('filtro de apuração usa meses completos, intervalo inválido não mostra totais',()=>{
 const a=[apuracao('2025-12'),apuracao('2026-01'),apuracao('2026-02')];
 assert.deepEqual(compararPgdas(a,[],'2026-01-20','2026-02-05').map(r=>r.mes),['2026-01','2026-02']);
 assert.deepEqual(compararPgdas(a,[],'2026-02-05','2026-01-20'),[]);
 assert.equal(compararPgdas([apuracao('2026-01',0,0)],[],'','')[0].aliquota,null);
});
