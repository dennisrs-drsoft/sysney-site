import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {XMLParser} from 'fast-xml-parser';
const js=ts.transpileModule(readFileSync(new URL('../lib/nfse-nacional.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {normalizarPerfilNacional,validarDadosNacionais,montarDpsNacional,identificadorDps,NFSE_NACIONAL_SYSNEY,pendenciasNacionais}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('DPS possui prefixo, município, CNPJ, série e número com tamanhos nacionais',()=>assert.equal(identificadorDps('3550308','00000000000000','1','1'),'DPS355030820000000000000000001000000000000001'));
test('recusa valores inválidos e caminhos no identificador',()=>{for(const numero of ['0','000','-1','1.2','../nfse','1234567890123456'])assert.throws(()=>identificadorDps('3550308','00000000000000','1',numero));});
test('preparação não desbloqueia produção e não altera DRSOFT',()=>{assert.equal(NFSE_NACIONAL_SYSNEY.transmissaoHabilitada,false);assert.equal(NFSE_NACIONAL_SYSNEY.homologacaoConcluida,false);assert.equal(NFSE_NACIONAL_SYSNEY.emissaoPrevista,'2026-11-01');assert.equal(NFSE_NACIONAL_SYSNEY.vencimento,'2026-12-08');assert.match(pendenciasNacionais('drsoft')[0],/não configurada/);});
const perfil={codigoNacional:'010701',codigoMunicipal:'',nbs:'',serie:'9',regimeEspecial:'0',apuracaoSimples:'1',retencaoIss:'1',aliquotaIss:'',transparencia:{tipo:'naoInformar',percentual:''}};
const dados={empresa:'sysney',cnpj:'12345678000199',regime:'simples',documento:'98765432000199',cliente:'Cliente fictício & teste',descricao:'Suporte <sintético>',centavos:324258,referencia:'2026-10',competenciaFiscal:'2026-11-01',emissao:'2026-11-02',endereco:{tipo:'R',logradouro:'Teste',numero:'1',bairro:'Centro',municipio:'3550308',uf:'SP',cep:'01000000',complemento:''},perfil};
test('DPS separa competência fiscal, emissão e referência; não usa RPS municipal',()=>{
 const d=montarDpsNacional(dados,'3','2026-11-02T12:00:00-03:00','homologacao');
 assert.match(d.idDps,/^DPS355030821234567800019900009000000000000003$/);
 const x=new XMLParser({parseTagValue:false}).parse(d.xml).DPS.infDPS;
 assert.equal(x.tpAmb,'2');assert.equal(x.dCompet,'2026-11-01');assert.equal(x.dhEmi,'2026-11-02T12:00:00-03:00');assert.equal(x.valores.vServPrest.vServ,'3242.58');assert.match(x.serv.cServ.xDescServ,/Referência comercial: 2026-10/);assert.equal(x.toma.xNome,dados.cliente);assert.doesNotMatch(d.xml,/SB001|SerieRPS|NumeroRPS/);
});
test('cada emitente e ambiente tem identidade/hash próprios, sem reclassificar Lucro Presumido',()=>{
 const presumido={...dados,empresa:'drsoft',cnpj:'11111111000191',regime:'presumido',perfil:{...perfil,apuracaoSimples:'',aliquotaIss:'2.9',federais:{cst:'01',pis:'0.65',cofins:'3',ir:'1.5',csll:'1',inss:'0',retencaoPisCofins:'3'}}};
 const h=montarDpsNacional(presumido,'1','2026-11-02T12:00:00-03:00','homologacao'),p=montarDpsNacional(presumido,'1','2026-11-02T12:00:00-03:00','producao');
 assert.notEqual(h.hash,p.hash);assert.match(p.xml,/<tpAmb>1<\/tpAmb>/);assert.match(p.xml,/<opSimpNac>1<\/opSimpNac>/);assert.doesNotMatch(p.xml,/regApTribSN/);assert.match(p.xml,/<vRetIRRF>48.64<\/vRetIRRF>/);assert.match(p.xml,/<vPis>21.08<\/vPis>/);assert.match(p.xml,/<vServ>3242.58<\/vServ>/);assert.notEqual(h.idDps,montarDpsNacional(dados,'1','2026-11-02T12:00:00-03:00','homologacao').idDps);
});
test('bloqueia datas artificiais/invalidas, código fictício, perfil incompleto e inferência municipal',()=>{
 for(const patch of [{competenciaFiscal:'2026-10-31'},{competenciaFiscal:'2026-11-03'},{competenciaFiscal:'2026-02-30'},{emissao:'2026-11-01'},{regime:'desconhecido'},{centavos:NaN},{documento:'123'},{perfil:{...perfil,codigoNacional:'000000'}},{perfil:{...perfil,codigoNacional:'03158'}},{perfil:{...perfil,codigoMunicipal:'03158'}},{perfil:{...perfil,nbs:'12'}},{perfil:{...perfil,apuracaoSimples:''}},{perfil:{...perfil,aliquotaIss:'9'}},{perfil:{...perfil,federais:{}}}])assert.throws(()=>validarDadosNacionais({...dados,...patch},'2026-11-02'));
 assert.throws(()=>normalizarPerfilNacional(null));assert.throws(()=>montarDpsNacional(dados,'0','2026-11-02T12:00:00-03:00','homologacao'));
 assert.throws(()=>montarDpsNacional(dados,'1','2026-11-03T12:00:00-03:00','producao'));
});
