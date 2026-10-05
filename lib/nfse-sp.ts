import {createHash} from "node:crypto";
import {calcularRetencoes,type RegimeFiscal,type TaxasRetencao} from "./retencoes-fiscais";
import {leiauteSP} from "./leiaute-nfse-sp";
export {leiauteSP} from "./leiaute-nfse-sp";

export type FiscalSP = {
  regime:RegimeFiscal; calcularRetencoes?:boolean; taxasRetencao?:TaxasRetencao;
  serie: string; numeroInicial: string; dataEmissao: string;
  codigoServico: string; aliquota: string; issRetido: boolean;
  nbs: string; indicadorOperacao: string; classificacaoTributaria: string;
  consumidorFinal: boolean; municipioPrestacao: string;
  retencaoPisCofins?: string;
  deducoes: number; pis: number; cofins: number; inss: number; ir: number; csll: number; ipi: number;
  endereco: {tipo: string; logradouro: string; numero: string; complemento?:string; bairro: string; municipio: string; uf: string; cep: string};
};
export type DadosNotaSP = {
  empresa: "drsoft"|"sysney"; cnpj: string; inscricao: string; clienteDocumento: string; clienteNome: string;
  competencia: string; centavos: number; descricao: string; po: string;
  numero: string; fiscal: FiscalSP;
};
export type ResultadoSP = {sucesso:boolean; erros:string[]; alertas:string[]; xml:string; numero?:string; verificacao?:string; inscricao?:string; tomador?:string; valorFinal?:string; descricao?:string; teste:boolean};
export type TrabalhoSP = {
  id:string; emailId:string; dados:DadosNotaSP; hash:string; atualizadoEm:string;
  status:"preparada"|"testando"|"testada"|"rejeitada"|"transmitindo"|"incerta"|"emitida";
  teste?:{hash:string; em:string; resultado:ResultadoSP}; resultado?:ResultadoSP;
  aprovacao?:{por:string; em:string; hash:string; xmlHash?:string; cadeiaHash?:string};
};
const esc=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");
export function normalizarFiscalSP(raw:unknown,centavos?:number):FiscalSP {
  if(!raw || typeof raw!=="object")throw Error("Preencha os dados fiscais para testar a nota.");
  const r={...raw} as Record<string,unknown>;
  if(!["simples","presumido"].includes(String(r.regime)))throw Error("Confirme o regime fiscal vigente do emitente.");
  const regime=r.regime as RegimeFiscal,simples=regime==="simples";
  const rtc=leiauteSP({regime,codigoServico:String(r.codigoServico),dataEmissao:String(r.dataEmissao)})===2;
  if(r.calcularRetencoes===true&&!simples){if(centavos===undefined)throw Error("Informe a base de cálculo das retenções.");Object.assign(r,calcularRetencoes(centavos,r.taxasRetencao as TaxasRetencao));}
  if(simples)Object.assign(r,{nbs:"",indicadorOperacao:"",classificacaoTributaria:"",consumidorFinal:false,issRetido:false,deducoes:0,pis:0,cofins:0,inss:0,ir:0,csll:0,ipi:0,aliquota:"0",retencaoPisCofins:"0"});
  const retencaoPisCofins=simples?"0":campoRetencao(r);
  const campo=(k:string,re:RegExp)=>{const v=r[k];if(typeof v!=="string"||!re.test(v))throw Error(`Confira o campo fiscal ${k}.`);return v;};
  const valor=(k:string)=>{const v=r[k];if(typeof v!=="number"||!Number.isSafeInteger(v)||v<0||v>10000000000)throw Error(`Confira o valor de ${k}, em centavos.`);return v;};
  const booleano=(k:string)=>{if(typeof r[k]!=="boolean")throw Error(`Confira ${k}.`);return r[k] as boolean;};
  const dataEmissao=campo("dataEmissao",/^20\d{2}-\d{2}-\d{2}$/);
  if(!Number.isFinite(Date.parse(dataEmissao))||new Date(dataEmissao).toISOString().slice(0,10)!==dataEmissao)throw Error("Data de emissão inválida.");
  const aliquota=campo("aliquota",/^\d{1,2}(\.\d{1,4})?$/);if(Number(aliquota)>5)throw Error("Alíquota de ISS fora da faixa suportada. Revise o enquadramento.");
  const e=r.endereco as Record<string,unknown>;if(!e||typeof e!=="object")throw Error("Informe o endereço fiscal do tomador.");
  const texto=(k:string,re:RegExp)=>{const v=e[k];if(typeof v!=="string"||!re.test(v)||/[\x00-\x1f]/.test(v))throw Error(`Confira o endereço: ${k}.`);return v.trim();};
  return {regime,calcularRetencoes:!simples&&r.calcularRetencoes===true,...(!simples&&r.calcularRetencoes===true?{taxasRetencao:r.taxasRetencao as TaxasRetencao}:{}),serie:campo("serie",/^[A-Z0-9]{1,5}$/),numeroInicial:campo("numeroInicial",/^[1-9]\d{0,11}$/),dataEmissao,codigoServico:campo("codigoServico",/^\d{5}$/),aliquota,issRetido:booleano("issRetido"),
    nbs:rtc?campo("nbs",/^\d{9}$/):"",indicadorOperacao:rtc?campo("indicadorOperacao",/^\d{6}$/):"",classificacaoTributaria:rtc?campo("classificacaoTributaria",/^\d{6}$/):"",consumidorFinal:rtc?booleano("consumidorFinal"):false,municipioPrestacao:campo("municipioPrestacao",/^\d{7}$/),retencaoPisCofins,
    deducoes:valor("deducoes"),pis:valor("pis"),cofins:valor("cofins"),inss:valor("inss"),ir:valor("ir"),csll:valor("csll"),ipi:valor("ipi"),
    endereco:{...(e.complemento!==undefined?{complemento:texto("complemento",/^.{0,30}$/)}:{}),tipo:texto("tipo",/^.{1,3}$/),logradouro:texto("logradouro",/^.{1,50}$/),numero:texto("numero",/^.{1,10}$/),bairro:texto("bairro",/^.{1,30}$/),municipio:texto("municipio",/^\d{7}$/),uf:texto("uf",/^[A-Z]{2}$/),cep:texto("cep",/^\d{8}$/)}};
}
function campoRetencao(r:Record<string,unknown>){
  // Sem valores, a ausência equivale a não retido. Com valores, exigir escolha explícita.
  const v=r.retencaoPisCofins??(r.pis===0&&r.cofins===0&&r.csll===0?"0":undefined);
  if(typeof v!=="string"||! /^(0|[3-9])$/.test(v))throw Error("Confirme o tipo de retenção de PIS/COFINS/CSLL.");
  if(v==="0"&&r.csll!==0)throw Error("CSLL informada exige tipo de retenção compatível.");
  return v;
}
export function validarNotaSP(d:DadosNotaSP) {
  if(!["drsoft","sysney"].includes(d.empresa)||!/^\d{14}$/.test(d.cnpj)||!/^\d{1,12}$/.test(d.inscricao)||!/^\d{14}$/.test(d.clienteDocumento)||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(d.competencia)||!Number.isSafeInteger(d.centavos)||d.centavos<=0||d.centavos>10000000000||! /^[1-9]\d{0,11}$/.test(d.numero))throw Error("Dados fiscais inválidos.");
  if(!d.clienteNome.trim()||d.clienteNome.length>75||!d.descricao.trim()||d.descricao.length>1500||d.po.length>100||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(d.clienteNome+d.descricao+d.po))throw Error("Confira razão social, descrição e PO.");
  const f=normalizarFiscalSP(d.fiscal,d.centavos);
  if(leiauteSP(f)===1&&d.inscricao.length>8)throw Error("Inscrição municipal fora da faixa do leiaute 1.");
  if(f.regime==="simples"&&(d.inscricao.length>8||d.fiscal.issRetido||[d.fiscal.deducoes,d.fiscal.pis,d.fiscal.cofins,d.fiscal.inss,d.fiscal.ir,d.fiscal.csll,d.fiscal.ipi].some(v=>v!==0)))throw Error("Perfil Simples sem retenções: revise os dados antes de preparar.");
  for(const k of ["ir","pis","cofins","csll"] as const)if(f[k]!==d.fiscal[k])throw Error("Os valores fiscais mudaram. Recalcule e prepare novamente.");
  if(d.fiscal.municipioPrestacao!=="3550308")throw Error("Este emissor suporta apenas tributação e prestação em São Paulo. Use o portal para outros locais.");
  if(d.fiscal.deducoes>d.centavos)throw Error("Deduções não podem superar o valor da nota.");
  if(d.fiscal.pis+d.fiscal.cofins+d.fiscal.inss+d.fiscal.ir+d.fiscal.csll>d.centavos)throw Error("Retenções não podem superar o valor da nota.");
}
export function hashNotaSP(d:DadosNotaSP){validarNotaSP(d);return createHash("sha256").update(JSON.stringify({...d,protocolo:`sp-${leiauteSP(d.fiscal)}-20260911`,fiscal:normalizarFiscalSP(d.fiscal,d.centavos)})).digest("hex");}
export function cadeiaAssinaturaSP(d:DadosNotaSP) {
  validarNotaSP(d);const f=d.fiscal;
  // Manual municipal 3.3.9: inscrição de 8 ou 12 posições conforme leiaute; sem intermediário.
  return d.inscricao.padStart(leiauteSP(d.fiscal)===1?8:12,"0")+f.serie.padEnd(5," ")+d.numero.padStart(12,"0")+f.dataEmissao.replaceAll("-","")+"TN"+(f.issRetido?"S":"N")+String(d.centavos).padStart(15,"0")+String(f.deducoes).padStart(15,"0")+f.codigoServico+"2"+d.clienteDocumento;
}
export function chaveRpsSP(d:DadosNotaSP){validarNotaSP(d);return `<ChaveRPS><InscricaoPrestador>${d.inscricao}</InscricaoPrestador><SerieRPS>${d.fiscal.serie}</SerieRPS><NumeroRPS>${d.numero}</NumeroRPS></ChaveRPS>`;}
export function montarXmlSP(d:DadosNotaSP,teste:boolean) {
  validarNotaSP(d);const f=d.fiscal,e=f.endereco,v=leiauteSP(f);
  const money=(v:number)=>(v/100).toFixed(2);
  const rps=`<RPS><Assinatura>AA==</Assinatura>${chaveRpsSP(d)}<TipoRPS>RPS</TipoRPS><DataEmissao>${f.dataEmissao}</DataEmissao><StatusRPS>N</StatusRPS><TributacaoRPS>T</TributacaoRPS>${v===1?`<ValorServicos>${money(d.centavos)}</ValorServicos>`:""}<ValorDeducoes>${money(f.deducoes)}</ValorDeducoes><ValorPIS>${money(f.pis)}</ValorPIS><ValorCOFINS>${money(f.cofins)}</ValorCOFINS><ValorINSS>${money(f.inss)}</ValorINSS><ValorIR>${money(f.ir)}</ValorIR><ValorCSLL>${money(f.csll)}</ValorCSLL><CodigoServico>${f.codigoServico}</CodigoServico><AliquotaServicos>${(Number(f.aliquota)/100).toFixed(6)}</AliquotaServicos><ISSRetido>${f.issRetido}</ISSRetido><CPFCNPJTomador><CNPJ>${d.clienteDocumento}</CNPJ></CPFCNPJTomador><RazaoSocialTomador>${esc(d.clienteNome)}</RazaoSocialTomador><EnderecoTomador><TipoLogradouro>${esc(e.tipo)}</TipoLogradouro><Logradouro>${esc(e.logradouro)}</Logradouro><NumeroEndereco>${esc(e.numero)}</NumeroEndereco>${e.complemento?`<ComplementoEndereco>${esc(e.complemento)}</ComplementoEndereco>`:""}<Bairro>${esc(e.bairro)}</Bairro><Cidade>${e.municipio}</Cidade><UF>${e.uf}</UF><CEP>${e.cep}</CEP></EnderecoTomador><Discriminacao>${esc(d.descricao+(d.po?`\nPO ${d.po}`:""))}</Discriminacao>${v===2?`<RetencaoPisCofins>${f.retencaoPisCofins??"0"}</RetencaoPisCofins><ValorFinalCobrado>${money(d.centavos)}</ValorFinalCobrado><ValorIPI>${money(f.ipi)}</ValorIPI><ExigibilidadeSuspensa>0</ExigibilidadeSuspensa><NBS>${f.nbs}</NBS><cLocPrestacao>${f.municipioPrestacao}</cLocPrestacao><IBSCBS><finNFSe>0</finNFSe><indFinal>${f.consumidorFinal?1:0}</indFinal><cIndOp>${f.indicadorOperacao}</cIndOp><indDest>0</indDest><valores><trib><gIBSCBS><cClassTrib>${f.classificacaoTributaria}</cClassTrib></gIBSCBS></trib></valores></IBSCBS>`:""}</RPS>`;
  const rpsComRetencao=v===1&&f.regime==="presumido"?rps.replace("</RPS>",`<RetencaoPisCofins>${f.retencaoPisCofins??"0"}</RetencaoPisCofins></RPS>`):rps;
  const remetente=`<CPFCNPJRemetente><CNPJ>${d.cnpj}</CNPJ></CPFCNPJRemetente>`;
  return teste?`<p:PedidoEnvioLoteRPS xmlns:p="http://www.prefeitura.sp.gov.br/nfe"><Cabecalho Versao="${v}">${remetente}<transacao>true</transacao><dtInicio>${f.dataEmissao}</dtInicio><dtFim>${f.dataEmissao}</dtFim><QtdRPS>1</QtdRPS>${v===1?`<ValorTotalServicos>${money(d.centavos)}</ValorTotalServicos><ValorTotalDeducoes>${money(f.deducoes)}</ValorTotalDeducoes>`:""}</Cabecalho>${rpsComRetencao}</p:PedidoEnvioLoteRPS>`:`<p:PedidoEnvioRPS xmlns:p="http://www.prefeitura.sp.gov.br/nfe"><Cabecalho Versao="${v}">${remetente}</Cabecalho>${rpsComRetencao}</p:PedidoEnvioRPS>`;
}
export function montarConsultaSP(d:DadosNotaSP){return `<p:PedidoConsultaNFe xmlns:p="http://www.prefeitura.sp.gov.br/nfe"><Cabecalho Versao="${leiauteSP(d.fiscal)}"><CPFCNPJRemetente><CNPJ>${d.cnpj}</CNPJ></CPFCNPJRemetente></Cabecalho><Detalhe>${chaveRpsSP(d)}</Detalhe></p:PedidoConsultaNFe>`;}
