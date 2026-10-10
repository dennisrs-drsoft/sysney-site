import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const codigo=ts.transpileModule(readFileSync(new URL('../lib/ordenacao-tabela.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {ordenarTabela}=await import('data:text/javascript;base64,'+Buffer.from(codigo).toString('base64'));
test('Vencimento padrão decrescente; ausentes ao final; desempata sem inventar data',()=>{
 const rows=[{id:1,data:'',emissao:'2020-01-01'},{id:2,data:'2026-10-09',emissao:'2026-10-01'},{id:3,data:'2026-11-03',emissao:'2026-10-01'},{id:4,data:'',emissao:'2025-01-01'}];
 assert.deepEqual(ordenarTabela(rows,r=>r.data,'desc',r=>r.emissao).map(r=>r.id),[3,2,4,1]);
 assert.deepEqual(ordenarTabela(rows,r=>r.data,'asc',r=>r.emissao).map(r=>r.id),[2,3,4,1]);
 assert.deepEqual(rows.map(r=>r.id),[1,2,3,4]);
});
test('Notas e valores são ordenados numericamente; texto respeita português',()=>{
 assert.deepEqual(ordenarTabela(['2','100','10'],v=>v,'asc'),['2','10','100']);
 assert.deepEqual(ordenarTabela([120000,900,2000],v=>v,'asc'),[900,2000,120000]);
 assert.deepEqual(ordenarTabela(['Zélia','Álvaro','Bruno'],v=>v,'asc'),['Álvaro','Bruno','Zélia']);
 assert.deepEqual(ordenarTabela([null,0,undefined,NaN,5],v=>v,'desc').slice(0,2),[5,0]);
});
test('Ordenação é global, antes de paginar; cabeçalhos são acessíveis',()=>{
 const rows=Array.from({length:30},(_,i)=>i);
 assert.deepEqual(ordenarTabela(rows,v=>v).slice(0,12),[29,28,27,26,25,24,23,22,21,20,19,18]);
 const ui=readFileSync(new URL('../app/admin/ordenacao-tabela.tsx',import.meta.url),'utf8');
 assert.match(ui,/aria-sort/);assert.match(ui,/type="button"/);assert.match(ui,/setSelecao\(null\)/);
 const carteira=readFileSync(new URL('../app/admin/visao-financeira.tsx',import.meta.url),'utf8');assert.match(carteira,/const visiveis = ordenadas.slice/);
});
test('Cabeçalho renderiza ordem padrão e ação acessível sem alterar dados',async()=>{
 const require=createRequire(import.meta.url);
 let ui=ts.transpileModule(readFileSync(new URL('../app/admin/ordenacao-tabela.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 for(const nome of ['react','react/jsx-runtime'])ui=ui.replaceAll(JSON.stringify(nome),JSON.stringify(pathToFileURL(require.resolve(nome)).href));
 ui=ui.replaceAll(JSON.stringify('@/lib/ordenacao-tabela'),JSON.stringify('data:text/javascript;base64,'+Buffer.from(codigo).toString('base64')));
 const {useOrdenacaoTabela}=await import('data:text/javascript;base64,'+Buffer.from(ui).toString('base64'));
 function Tabela(){const r=useOrdenacaoTabela([{valor:1},{valor:3}],[{titulo:'Valor',valor:r=>r.valor},{titulo:'Arquivo'}],'Valor');return React.createElement('table',null,React.createElement('thead',null,React.createElement('tr',null,r.cabecalhos)),React.createElement('tbody',null,r.ordenadas.map(r=>React.createElement('tr',{key:r.valor},React.createElement('td',null,r.valor)))));}
 const html=renderToStaticMarkup(React.createElement(Tabela));
 assert.match(html,/aria-sort="descending"/);assert.match(html,/Ordenar por Valor, crescente/);assert.match(html,/<td>3<\/td>.*<td>1<\/td>/);assert.match(html,/scope="col"/);
});
