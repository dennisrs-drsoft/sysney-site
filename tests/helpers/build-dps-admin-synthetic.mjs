import {nationalModel} from './load-national-model.mjs';

const {montarDpsNacional}=nationalModel;
const p={codigoNacional:'010701',codigoMunicipal:'',nbs:'',serie:'9',regimeEspecial:'0',apuracaoSimples:'1',retencaoIss:'1',aliquotaIss:'',transparencia:{tipo:'naoInformar',percentual:''}};
const d={empresa:'sysney',cnpj:'12345678000199',regime:'simples',documento:'98765432000199',cliente:'TESTE SINTETICO NAO TRANSMITIR',descricao:'TESTE LOCAL NAO TRANSMITIR',centavos:324258,referencia:'2026-10',competenciaFiscal:'2026-11-01',emissao:'2026-11-02',endereco:{tipo:'R',logradouro:'Teste',numero:'1',bairro:'Centro',municipio:'3550308',uf:'SP',cep:'01000000'},perfil:p};
const variants=[d,{...d,empresa:'drsoft',cnpj:'11111111000191',regime:'presumido',perfil:{...p,apuracaoSimples:'',aliquotaIss:'2.9',federais:{cst:'01',pis:'0.65',cofins:'3',ir:'1.5',csll:'1',inss:'0',retencaoPisCofins:'3'}}}];
console.log(JSON.stringify(variants.flatMap(d=>['homologacao','producao'].map(ambiente=>({cnpj:d.cnpj,ambiente,...montarDpsNacional(d,'1','2026-11-02T12:00:00-03:00',ambiente)})))));
