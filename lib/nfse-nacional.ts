import {createHash} from "node:crypto";
import type {FiscalSP} from "./nfse-sp";

// Compatibilidade com a tela de diagnóstico existente: preparar não autoriza emissão.
export const NFSE_NACIONAL_SYSNEY = {
  empresa:"SYSNEY",municipio:"3550308",obrigatoriedade:"2026-11-01",referencia:"2026-10",
  emissaoPrevista:"2026-11-01",vencimento:"2026-12-08",ultimaVerificacaoPortal:"2026-10-02",
  habilitacao:"nao_confirmada",transmissaoHabilitada:false,homologacaoConcluida:false,
} as const;
export function identificadorDps(municipio:string,cnpj:string,serie:string,numero:string){
  if(!/^\d{7}$/.test(municipio)||!/^\d{14}$/.test(cnpj)||!/^\d{1,5}$/.test(serie)||!/^\d{1,15}$/.test(numero)||/^0+$/.test(numero))throw Error("Identificação de DPS inválida.");
  return `DPS${municipio}2${cnpj}${serie.padStart(5,"0")}${numero.padStart(15,"0")}`;
}
export function pendenciasNacionais(empresa:string){
  const comuns=["Confirmar habilitação para a competência fiscal correta no Emissor Nacional.","Validar código nacional, NBS e enquadramento; não converter o código municipal automaticamente.","Reservar série e sequência DPS exclusivas, separadas dos RPS municipais.","Concluir assinatura, XML, consulta oficial e download do DANFSe antes de liberar produção.","Configurar o serviço fiscal com o certificado do emitente, sem disponibilizar a chave privada ao navegador."];
  return empresa==="sysney"?comuns:["DRSOFT: migração nacional não configurada. Confirmar habilitação para o regime vigente, sem aplicar automaticamente as regras do Simples Nacional.",...comuns];
}

export type PerfilNacional = {
  codigoNacional:string; codigoMunicipal:string; nbs:string; serie:string;
  regimeEspecial:string; apuracaoSimples:string; retencaoIss:string; aliquotaIss:string;
  transparencia:{tipo:"naoInformar"|"simples"; percentual:string};
  federais?:{cst:string; pis:string; cofins:string; ir:string; csll:string; inss:string; retencaoPisCofins:string};
};
export type DadosNacionais = {
  empresa:"sysney"|"drsoft"; cnpj:string; regime:"simples"|"presumido";
  documento:string; cliente:string; descricao:string; centavos:number;
  referencia:string; competenciaFiscal:string; emissao:string;
  endereco:FiscalSP["endereco"]; perfil:PerfilNacional;
};
const esc=(s:string)=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");
export function dataFiscalValida(s:string){return /^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
function texto(v:unknown,max:number,multilinha=false){if(typeof v!=="string"||v.length>max||(multilinha?/[\x00-\x08\x0b\x0c\x0e-\x1f]/:/[\x00-\x1f]/).test(v))throw Error("Campo fiscal nacional inválido.");return v.trim();}
export function normalizarPerfilNacional(value:unknown):PerfilNacional {
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Preencha o perfil fiscal nacional.");
  const v=value as Record<string,unknown>;
  const campo=(k:string,p:RegExp,max=20)=>{const s=texto(v[k],max);if(!p.test(s))throw Error(`Confira o campo nacional: ${k}.`);return s;};
  const t=v.transparencia as Record<string,unknown>|undefined;
  if(!t||!["naoInformar","simples"].includes(String(t.tipo)))throw Error("Confirme a transparência tributária.");
  const percentual=texto(t.percentual,5);
  if(t.tipo==="simples"&&!/^\d{1,2}\.\d{2}$/.test(percentual)||t.tipo==="naoInformar"&&percentual!=="")throw Error("Confira o percentual de transparência tributária.");
  const p:PerfilNacional={codigoNacional:campo("codigoNacional",/^(?!000000)\d{6}$/),codigoMunicipal:campo("codigoMunicipal",/^\d{0,3}$/),nbs:campo("nbs",/^\d{0,9}$/),serie:campo("serie",/^[1-9]\d{0,4}$/),regimeEspecial:campo("regimeEspecial",/^[0-6]$|^9$/),apuracaoSimples:campo("apuracaoSimples",/^[123]?$|^$/),retencaoIss:campo("retencaoIss",/^[123]$/),aliquotaIss:campo("aliquotaIss",/^$|^\d{1,2}(\.\d{1,2})?$/),transparencia:{tipo:t.tipo as "naoInformar"|"simples",percentual}};
  if(p.nbs&&!/^\d{9}$/.test(p.nbs)||p.aliquotaIss&&Number(p.aliquotaIss)>5)throw Error("Confira NBS e alíquota do ISS.");
  if(v.federais!==undefined){
    const f=v.federais as Record<string,unknown>;
    if(!f||typeof f!=="object"||Array.isArray(f))throw Error("Confirme o enquadramento federal.");
    const taxa=(k:string)=>{const s=texto(f[k],5);if(!/^\d{1,2}(\.\d{1,2})?$/.test(s)||Number(s)>100)throw Error("Alíquota federal inválida.");return s;};
    const cst=texto(f.cst,2),retencaoPisCofins=texto(f.retencaoPisCofins,1);
    if(!/^(00|01|02|04|06|07|08|09|49|99)$/.test(cst)||!/^\d$/.test(retencaoPisCofins))throw Error("Confira CST e retenções federais.");
    p.federais={cst,retencaoPisCofins,pis:taxa("pis"),cofins:taxa("cofins"),ir:taxa("ir"),csll:taxa("csll"),inss:taxa("inss")};
  }
  return p;
}
export function validarDadosNacionais(d:DadosNacionais,hoje:string){
  if(!["sysney","drsoft"].includes(d.empresa)||!/^\d{14}$/.test(d.cnpj)||!/^\d{14}$/.test(d.documento)||!["simples","presumido"].includes(d.regime))throw Error("Identidade fiscal nacional inválida.");
  if(!dataFiscalValida(d.competenciaFiscal)||d.competenciaFiscal>hoje||d.emissao!==hoje||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(d.referencia))throw Error("Confirme a data real da competência fiscal e a emissão de hoje.");
  if(d.regime==="simples"&&d.competenciaFiscal<"2026-11-01")throw Error("São Paulo mantém a emissão municipal para competências anteriores a novembro/2026. Não altere a competência para liberar o nacional.");
  if(!Number.isSafeInteger(d.centavos)||d.centavos<=0||d.centavos>10000000000||!texto(d.cliente,150)||!texto(d.descricao,1500,true))throw Error("Confira o tomador, o valor e a descrição do serviço.");
  const p=normalizarPerfilNacional(d.perfil),a=d.endereco;
  if((d.descricao+". Referência comercial: "+d.referencia).length>1500)throw Error("Descrição fiscal com referência excede 1500 caracteres.");
  if(!a||!/^\d{7}$/.test(a.municipio)||!/^\d{8}$/.test(a.cep)||!texto(a.tipo,3)||!texto(a.logradouro,100)||!texto(a.numero,20)||!texto(a.bairro,60)||! /^[A-Z]{2}$/.test(a.uf))throw Error("Complete o endereço fiscal do tomador.");
  if(a.complemento!==undefined)texto(a.complemento,60);
  if(d.regime==="simples"&&(!p.apuracaoSimples||p.federais))throw Error("Confirme o regime de apuração do Simples; retenções federais especiais exigem revisão.");
  if(d.regime==="presumido"&&(!p.federais||p.apuracaoSimples||p.transparencia.tipo==="simples"||!p.aliquotaIss))throw Error("Lucro Presumido exige perfil federal, ISS e transparência compatíveis, sem alterar o regime da empresa.");
  return p;
}
export function montarDpsNacional(d:DadosNacionais,numero:string,instante:string,ambiente:"homologacao"|"producao"){
  const p=validarDadosNacionais(d,d.emissao);
  if(!/^[1-9]\d{0,14}$/.test(numero)||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/.test(instante)||!Number.isFinite(Date.parse(instante))||instante.slice(0,10)!==d.emissao||!["homologacao","producao"].includes(ambiente))throw Error("Identidade e instante da DPS inválidos.");
  const tag=(k:string,v:string)=>`<${k}>${esc(v)}</${k}>`,opt=(k:string,v:string)=>v?tag(k,v):"",a=d.endereco;
  const money=(v:number)=>(v/100).toFixed(2),valor=(t:string)=>money(Number((BigInt(d.centavos)*BigInt(Math.round(Number(t)*100))+BigInt(5000))/BigInt(10000)));
  const id=identificadorDps("3550308",d.cnpj,p.serie,numero);
  const f=p.federais;
  const federal=f?`<tribFed><piscofins>${tag("CST",f.cst)}${tag("vBCPisCofins",money(d.centavos))}${tag("pAliqPis",Number(f.pis).toFixed(2))}${tag("pAliqCofins",Number(f.cofins).toFixed(2))}${tag("vPis",valor(f.pis))}${tag("vCofins",valor(f.cofins))}${tag("tpRetPisCofins",f.retencaoPisCofins)}</piscofins>${tag("vRetCP",valor(f.inss))}${tag("vRetIRRF",valor(f.ir))}${tag("vRetCSLL",valor(f.csll))}</tribFed>`:"";
  const xml=`<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infDPS Id="${id}">${tag("tpAmb",ambiente==="producao"?"1":"2")}${tag("dhEmi",instante)}<verAplic>SYSNEY-ADMIN-1</verAplic>${tag("serie",p.serie)}${tag("nDPS",numero)}${tag("dCompet",d.competenciaFiscal)}<tpEmit>1</tpEmit>${ambiente==="homologacao"?"<finNFSe>0</finNFSe>":""}<cLocEmi>3550308</cLocEmi><prest>${tag("CNPJ",d.cnpj)}<regTrib>${tag("opSimpNac",d.regime==="simples"?"3":"1")}${opt("regApTribSN",p.apuracaoSimples)}${tag("regEspTrib",p.regimeEspecial)}</regTrib></prest><toma>${tag("CNPJ",d.documento)}${tag("xNome",d.cliente)}<end><endNac>${tag("cMun",a.municipio)}${tag("CEP",a.cep)}</endNac>${tag("xLgr",a.tipo+" "+a.logradouro)}${tag("nro",a.numero)}${opt("xCpl",a.complemento||"")}${tag("xBairro",a.bairro)}</end></toma><serv><locPrest><cLocPrestacao>3550308</cLocPrestacao></locPrest><cServ>${tag("cTribNac",p.codigoNacional)}${opt("cTribMun",p.codigoMunicipal)}${opt("cNBS",p.nbs)}${tag("xDescServ",d.descricao+". Referência comercial: "+d.referencia)}</cServ></serv><valores><vServPrest>${tag("vServ",money(d.centavos))}</vServPrest><trib><tribMun><tribISSQN>1</tribISSQN>${tag("tpRetISSQN",p.retencaoIss)}${opt("pAliq",p.aliquotaIss?Number(p.aliquotaIss).toFixed(2):"")}</tribMun>${federal}<totTrib>${p.transparencia.tipo==="simples"?tag("pTotTribSN",p.transparencia.percentual):"<indTotTrib>0</indTotTrib>"}</totTrib></trib></valores></infDPS></DPS>`;
  return {idDps:id,xml,hash:createHash("sha256").update(xml).digest("hex"),ambiente};
}
