import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
await build({entryPoints:['lib/atp-municipal-preparation.ts'],outfile:'output/atp-municipal-preview.test.bundle.mjs',bundle:true,platform:'node',format:'esm',target:'node22'});
const {prepareAtpMunicipalPreview}=await import(pathToFileURL(resolve('output/atp-municipal-preview.test.bundle.mjs')));
const input=JSON.parse(await readFile(new URL('../postman/fixtures/atp-fiscal-v1.synthetic.json',import.meta.url)));
const approvedService={regime:'simples',codigoServico:'03158',aliquota:'0',issRetido:false,calcularRetencoes:false,serie:'SB001',numeroInicial:'3',dataEmissao:'2026-10-23',nbs:'',indicadorOperacao:'',classificacaoTributaria:'',consumidorFinal:false,municipioPrestacao:'3550308',retencaoPisCofins:'0',deducoes:0,pis:0,cofins:0,inss:0,ir:0,csll:0,ipi:0,endereco:{tipo:'AV',logradouro:'CLIENTE LEGADO NAO COPIAR',numero:'999',bairro:'Antigo',municipio:'3513009',uf:'SP',cep:'06707100'}};
const args={input,issuer:{cnpj:'57767099000179',inscricao:'15539300'},approvedService,profileVersion:'SYSNEY-ATP-CONFIRMADO-20261027',emissionDate:'2026-10-27',series:'ATP01',number:'1'};
test('prévia municipal reaproveita serviço autorizado sem copiar cliente/chave RPS e não emite',()=>{
 const before=JSON.stringify(approvedService),p=prepareAtpMunicipalPreview(args);
 assert.equal(p.dados.fiscal.codigoServico,'03158');assert.equal(p.dados.fiscal.aliquota,'0');assert.equal(p.dados.fiscal.issRetido,false);assert.equal(p.dados.fiscal.serie,'ATP01');assert.equal(p.dados.fiscal.dataEmissao,'2026-10-27');
 assert.equal(p.dados.fiscal.endereco.logradouro,input.recipient.address.street);assert.equal(p.dados.clienteDocumento,input.recipient.document);assert.equal(p.dados.centavos,19900);assert.match(p.xmlTeste,/CodigoServico>03158/);assert.match(p.xmlTeste,/Versao="1"/);assert.doesNotMatch(p.xmlTeste,/CLIENTE LEGADO/);
 assert.equal(p.numberReserved,false);assert.equal(p.emissionEnabled,false);assert.equal(p.nationalEnabled,false);assert.equal(JSON.stringify(approvedService),before);
});
test('novembro/retroativo e clientes não suportados exigem revisão, nunca fallback automático',()=>{
 assert.throws(()=>prepareAtpMunicipalPreview({...args,input:{...input,competence:'2026-11',servicePeriod:{startDate:'2026-11-01',endDate:'2026-11-30'}}}),/NOVEMBER_ROUTING_REVIEW/);
 assert.throws(()=>prepareAtpMunicipalPreview({...args,emissionDate:'2026-11-01'}),/RETROACTIVE_MUNICIPAL_REVIEW/);
 assert.throws(()=>prepareAtpMunicipalPreview({...args,input:{...input,recipient:{...input.recipient,documentType:'CPF',document:'52998224725'}}}),/CNPJ_ONLY/);
 assert.throws(()=>prepareAtpMunicipalPreview({...args,approvedService:{...approvedService,codigoServico:'01050'}}),/PROFILE_MISMATCH/);
 assert.throws(()=>prepareAtpMunicipalPreview({...args,input:{...input,recipient:{...input.recipient,legalName:'x'.repeat(76)}}}),/razão social/);
 assert.throws(()=>prepareAtpMunicipalPreview({...args,input:{...input,recipient:{...input.recipient,address:{...input.recipient.address,street:'x'.repeat(51)}}}}),/endereço/);
});
