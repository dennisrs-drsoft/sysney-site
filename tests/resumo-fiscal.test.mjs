import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extrairTributosXml} from '../lib/extrato-fiscal-xml.ts';
import {resumoFiscal,filtrarNotasFiscais,baseSimplesPorNotas} from '../lib/resumo-fiscal.ts';
const xml=(campos='')=>`<p:NFe xmlns:p="http://www.prefeitura.sp.gov.br/nfe"><ChaveNFe><NumeroNFe>1</NumeroNFe><InscricaoPrestador>123</InscricaoPrestador></ChaveNFe>${campos}</p:NFe>`;
test('XML preserva zero, ausência e quitação sem presumir valor pago',()=>{
 const t=extrairTributosXml(xml('<ValorISS>0.00</ValorISS><ValorIR>48.64</ValorIR><ISSRetido>false</ISSRetido><NumeroGuia>123</NumeroGuia><DataQuitacaoGuia>2026-10-05</DataQuitacaoGuia>'),'1','123');
 assert.equal(t.iss,0);assert.equal(t.ir,4864);assert.equal(t.pis,null);assert.equal(t.issRetido,false);assert.equal(t.quitacaoGuia,'2026-10-05');assert.equal(t.valorPago,undefined);
});
test('XML recusa identidade divergente, DTD, duplicidade e valores inválidos',()=>{
 assert.throws(()=>extrairTributosXml(xml(),'2','123'));
 assert.throws(()=>extrairTributosXml('<!DOCTYPE NFe>'+xml(),'1','123'));
 assert.throws(()=>extrairTributosXml(xml('<ValorISS>1</ValorISS><ValorISS>2</ValorISS>'),'1','123'));
 assert.throws(()=>extrairTributosXml(xml('<ValorIR>-5</ValorIR>'),'1','123'));
});
const nota=(numero,emissao,situacao='N')=>({numero,documento:'111',cliente:'Cliente',emissao,situacao,centavos:10000,tributos:extrairTributosXml(xml('<ValorISS>2.90</ValorISS><ISSRetido>true</ISSRetido>'),'1','123')});
test('faturamento exclui canceladas/desconhecidas e não mistura tributos em imposto pago',()=>{
 const r=resumoFiscal([nota('1','2026-10-01'),nota('2','2026-10-02','C'),nota('3','2026-10-03','?')]);
 assert.equal(r.faturado,10000);assert.equal(r.valorCancelado,10000);assert.equal(r.desconhecidas,1);
 assert.equal(r.tributos.find(t=>t.campo==='iss').valor,290);assert.equal(r.tributos.find(t=>t.campo==='ir').informadas,0);
 assert.equal(r.impostoPago,undefined);
});
test('referência de 12 meses exclui mês atual e inclui as duas extremidades anteriores',()=>{
 const ns=[nota('1','2025-10-01'),nota('2','2026-09-30'),nota('3','2026-10-01'),nota('4','2025-09-30'),nota('5','2026-09-15','C')];
 const r=baseSimplesPorNotas(ns,'2026-10');
 assert.equal(r.receita12,20000);assert.equal(r.receitaMes,10000);assert.equal(r.inicio,'2025-10-01');assert.equal(r.fim,'2026-09-30');
 assert.equal(baseSimplesPorNotas(ns,'2026-13'),null);
 assert.equal(filtrarNotasFiscais(ns,'2026-10-01','2026-09-01','').length,0);
});
