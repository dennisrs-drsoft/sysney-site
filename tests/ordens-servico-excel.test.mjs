import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {excelOS,arquivosOS,zipOS} from './fixtures/os-excel.mjs';
await mkdir('output',{recursive:true});
await build({entryPoints:['lib/ordens-servico-excel.ts'],outfile:'output/os-excel-teste.mjs',bundle:true,platform:'node',format:'esm',packages:'external',target:'node22'});
const {lerExcelOS}=await import(pathToFileURL(process.cwd()+'/output/os-excel-teste.mjs'));
test('lê OSS por blocos com datas, horários e descrição; fórmulas calculadas não são executadas',()=>{
 const r=lerExcelOS(excelOS([{data:46204,inicio:0.6875,fim:0.7395833333333334,descricao:'Descrição com acentos & detalhes',formula:true}]));
 assert.equal(r.linhas.length,1);assert.equal(r.linhas[0].entrada.data,'2026-07-01');assert.equal(r.linhas[0].entrada.inicio,'16:30');assert.equal(r.linhas[0].entrada.fim,'17:45');assert.equal(r.linhas[0].entrada.descricao,'Descrição com acentos & detalhes');assert.equal(r.hash.length,64);
 const d=lerExcelOS(excelOS([{data:44742,inicio:0.6875,fim:0.7395833333333334,descricao:'Data 1904'}],{date1904:true}));assert.equal(d.linhas[0].entrada.data,'2026-07-01');
 const f=arquivosOS();f['xl/worksheets/sheet1.xml']=f['xl/worksheets/sheet1.xml'].replace('</sheetData>','<row r="4"><c r="A4" t="inlineStr"><is><t>Vencto:</t></is></c><c r="B4"><v>46287</v></c></row></sheetData>');assert.equal(lerExcelOS(zipOS(f)).linhas.length,1);
});
test('erros de dados aparecem na prévia, sem preencher datas ou descrições fictícias',()=>{
 for(const row of [{data:'31/02/2026',inicio:'08:00',fim:'09:00',descricao:'Serviço'},{data:'01/08/2026',inicio:'08:00',fim:'',descricao:'Serviço'},{data:'01/08/2026',inicio:'23:00',fim:'01:00',descricao:'Serviço'},{data:'01/08/2026',inicio:'08:00',fim:'09:00',descricao:''}])assert.ok(lerExcelOS(excelOS([row])).linhas[0].erro);
 const f=arquivosOS();f['xl/worksheets/sheet1.xml']=f['xl/worksheets/sheet1.xml'].replace('<c r="A1"','<c r="A1"').replace('<is><t>01/08/2026</t></is>','<f>TODAY()</f><v>46235</v>');assert.ok(lerExcelOS(zipOS(f)).linhas[0].erro);
});
test('rejeita formatos desconhecidos, arquivos grandes, macros, XML externo e ZIP corrompido',()=>{
 assert.throws(()=>lerExcelOS(Buffer.from('arquivo falso')));assert.throws(()=>lerExcelOS(Buffer.alloc(2097153)));
 assert.throws(()=>lerExcelOS(excelOS(undefined,{aba:'Outra'})));
 assert.throws(()=>lerExcelOS(zipOS({...arquivosOS(),'xl/vbaProject.bin':'macro'})));
 assert.throws(()=>lerExcelOS(zipOS({...arquivosOS(),'xl/workbook.xml':'<!DOCTYPE x [<!ENTITY a SYSTEM "file:///secret">]><workbook/>'})));
 const b=excelOS();b[50]^=0xff;assert.throws(()=>lerExcelOS(b));
 assert.throws(()=>lerExcelOS(zipOS({...arquivosOS(),'xl/sharedStrings.xml':'x'.repeat(4*1024*1024+1)})));
 assert.throws(()=>lerExcelOS(excelOS(Array.from({length:41},()=>({data:'01/08/2026',inicio:'08:00',fim:'09:00',descricao:'Serviço'})))));
});
