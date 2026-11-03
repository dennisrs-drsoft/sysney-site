import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../lib/perfil-fiscal-historico.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('"fast-xml-parser"',JSON.stringify(import.meta.resolve('fast-xml-parser')));
const {perfilFiscalDoXml,orientacaoEmissor}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const esperado={numero:'50',documento:'12345678000199',cnpj:'98765432000199',inscricao:'12345678',regime:'simples',hoje:'2026-11-02'};
const xml=`<NFe><ChaveNFe><NumeroNFe>50</NumeroNFe><InscricaoPrestador>12345678</InscricaoPrestador></ChaveNFe><StatusNFe>N</StatusNFe><CPFCNPJPrestador><CNPJ>98765432000199</CNPJ></CPFCNPJPrestador><CPFCNPJTomador><CNPJ>12345678000199</CNPJ></CPFCNPJTomador><CodigoServico>3158</CodigoServico><AliquotaServicos>0</AliquotaServicos><ISSRetido>false</ISSRetido><EnderecoTomador><TipoLogradouro>R</TipoLogradouro><Logradouro>Rua de teste</Logradouro><NumeroEndereco>1</NumeroEndereco><Bairro>Centro</Bairro><Cidade>3550308</Cidade><UF>SP</UF><CEP>1000000</CEP></EnderecoTomador><ValorIR>0.00</ValorIR><ChaveRPS><SerieRPS>VELHA</SerieRPS><NumeroRPS>9999</NumeroRPS></ChaveRPS></NFe>`;
test('XML da mesma empresa/tomador recupera cadastro e normaliza zeros, sem série/numeração antigas',()=>{
 const p=perfilFiscalDoXml(xml,esperado);
 assert.equal(p.notaOrigem,'50');assert.equal(p.fiscal.codigoServico,'03158');assert.equal(p.fiscal.endereco.cep,'01000000');assert.equal(p.fiscal.endereco.logradouro,'Rua de teste');assert.equal(p.fiscal.dataEmissao,'2026-11-02');assert.equal(p.fiscal.regime,'simples');assert.equal(p.fiscal.ir,0);assert.equal(p.fiscal.serie,undefined);assert.equal(p.fiscal.numeroInicial,undefined);assert.equal(p.fiscal.centavos,undefined);
});
test('identidade, XML duplicado, status desconhecido/cancelado e retenção excepcional falham fechados',()=>{
 for(const replacement of [xml.replace('12345678000199','11111111000111'),xml.replace('98765432000199','11111111000111'),xml.replace('<StatusNFe>N','<StatusNFe>C'),xml.replace('<StatusNFe>N','<StatusNFe>'),xml.replace('</NFe>','<DataCancelamento>2026-10-01</DataCancelamento></NFe>'),xml.replace('<CodigoServico>3158</CodigoServico>','<CodigoServico>3158</CodigoServico><CodigoServico>1111</CodigoServico>'),xml.replace('<ISSRetido>false','<ISSRetido>true'),'<!DOCTYPE NFe [<!ENTITY x SYSTEM "file:///privado">]>'+xml,xml.repeat(10000)])assert.throws(()=>perfilFiscalDoXml(replacement,esperado));
 assert.throws(()=>perfilFiscalDoXml(xml,{...esperado,numero:'51'}));assert.throws(()=>perfilFiscalDoXml(xml,{...esperado,inscricao:'87654321'}));
});
test('Lucro Presumido recupera código/endereço, sem copiar retenções monetárias de outra cobrança',()=>{
 const p=perfilFiscalDoXml(xml.replace('<AliquotaServicos>0','<AliquotaServicos>0.029').replace('<ValorIR>0.00','<ValorIR>999.99'),{...esperado,regime:'presumido'});
 assert.equal(p.parcial,true);assert.equal(p.fiscal.aliquota,'2.9');assert.equal(p.fiscal.ir,undefined);assert.equal(p.fiscal.calcularRetencoes,undefined);
});
test('transição diferencia competência antiga de competência nova e mantém os demais regimes',()=>{
 assert.equal(orientacaoEmissor('simples','2026-09','2026-10-31').tipo,'municipal');
 assert.equal(orientacaoEmissor('simples','2026-10','2026-11-02').tipo,'municipal-retroativo');
 assert.equal(orientacaoEmissor('simples','2026-11','2026-11-02').tipo,'nacional');
 assert.equal(orientacaoEmissor('presumido','2026-11','2026-11-02').tipo,'municipal');
 assert.equal(orientacaoEmissor('simples','incerta','2026-11-02').tipo,'revisar');
});
