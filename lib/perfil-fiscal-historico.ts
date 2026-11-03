import {XMLParser, XMLValidator} from "fast-xml-parser";
import type {FiscalSP} from "./nfse-sp";
import type {RegimeFiscal} from "./retencoes-fiscais";

export type PerfilFiscalHistorico = {
  fiscal: Partial<FiscalSP>;
  fonte: string;
  notaOrigem: string;
  parcial: boolean;
};

// Sugestão de cadastro, nunca autorização, série, numeração ou valores da nota antiga.
export function perfilFiscalDoXml(xml:string, esperado:{numero:string;documento:string;cnpj:string;inscricao:string;regime:RegimeFiscal;hoje:string}):PerfilFiscalHistorico {
  if(Buffer.byteLength(xml,"utf8")>100000||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error("XML histórico inválido.");
  const root=new XMLParser({removeNSPrefix:true,parseTagValue:false,ignoreAttributes:true}).parse(xml);
  const objeto=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=="object"||Array.isArray(v))throw Error("Campo histórico ausente ou duplicado.");return v as Record<string,unknown>;};
  const texto=(v:unknown,max=150)=>{if(typeof v!=="string"||v.length>max||/[\x00-\x1f]/.test(v))throw Error("Campo histórico inválido.");return v.trim();};
  const numero=(v:unknown,len:number)=>{const s=texto(v,len);if(!/^\d+$/.test(s))throw Error("Identificação histórica inválida.");return s.padStart(len,"0");};
  const n=objeto(root.NFe),chave=objeto(n.ChaveNFe);
  if(numero(chave.NumeroNFe,15)!==esperado.numero.padStart(15,"0")||numero(chave.InscricaoPrestador,8)!==esperado.inscricao.padStart(8,"0")||numero(objeto(n.CPFCNPJPrestador).CNPJ,14)!==esperado.cnpj||numero(objeto(n.CPFCNPJTomador).CNPJ,14)!==esperado.documento)throw Error("Emitente ou tomador do histórico divergente.");
  if(n.StatusNFe!=="N"||n.DataCancelamento||n.NumeroNFeSubstituta)throw Error("Nota cancelada, substituída ou sem situação confirmada.");
  const e=objeto(n.EnderecoTomador);
  const endereco={tipo:texto(e.TipoLogradouro,3),logradouro:texto(e.Logradouro,50),numero:texto(e.NumeroEndereco,10),...(e.ComplementoEndereco?{complemento:texto(e.ComplementoEndereco,30)}:{}),bairro:texto(e.Bairro,30),municipio:numero(e.Cidade,7),uf:texto(e.UF,2),cep:numero(e.CEP,8)};
  if(!endereco.tipo||!endereco.logradouro||!endereco.numero||!endereco.bairro||!/^[A-Z]{2}$/.test(endereco.uf))throw Error("Endereço fiscal histórico incompleto.");
  const aliquota=texto(n.AliquotaServicos,12);
  if(!/^\d+(\.\d+)?$/.test(aliquota)||Number(aliquota)*100>5)throw Error("Alíquota histórica inválida.");
  if(!["true","false","1","0"].includes(String(n.ISSRetido)))throw Error("Retenção histórica não informada.");
  const simples=esperado.regime==="simples";
  if(simples&&["true","1"].includes(String(n.ISSRetido)))throw Error("Retenção de ISS exige conferência individual do perfil Simples.");
  if(simples)for(const campo of ["ValorDeducoes","ValorPIS","ValorCOFINS","ValorINSS","ValorIR","ValorCSLL","ValorIPI"]){
    if(n[campo]!==undefined&&!/^0(?:\.0+)?$/.test(texto(n[campo],20)))throw Error("Deduções ou retenções históricas exigem conferência individual.");
  }
  const fiscal:Partial<FiscalSP>={regime:esperado.regime,dataEmissao:esperado.hoje,codigoServico:numero(n.CodigoServico,5),aliquota:String(Number((Number(aliquota)*100).toFixed(4))),issRetido:["true","1"].includes(String(n.ISSRetido)),endereco};
  if(simples)Object.assign(fiscal,{aliquota:"0",issRetido:false,nbs:"",indicadorOperacao:"",classificacaoTributaria:"",consumidorFinal:false,deducoes:0,pis:0,cofins:0,inss:0,ir:0,csll:0,ipi:0,retencaoPisCofins:"0"});
  return {fiscal,fonte:`XML oficial da NFS-e ${esperado.numero}; conferir enquadramento e endereço atuais.`,notaOrigem:esperado.numero,parcial:!simples};
}

export function orientacaoEmissor(regime:string,competencia:string,hoje:string) {
  if(regime!=="simples"||hoje<"2026-11-01")return {tipo:"municipal",mensagem:"Emissão municipal com revisão e aprovação específicas."};
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(competencia))return {tipo:"revisar",mensagem:"Confirme a competência fiscal do serviço para definir o emissor."};
  if(competencia>="2026-11")return {tipo:"nacional",mensagem:"Simples Nacional: competências a partir de novembro/2026 exigem o Emissor Nacional. A integração nacional de produção ainda não está liberada neste painel."};
  return {tipo:"municipal-retroativo",mensagem:"Referência anterior a novembro/2026: São Paulo mantém a emissão municipal para fatos geradores até 31/10/2026. Confirme a data real do fato gerador. Este fluxo ainda não separa essa data da data do RPS; use o portal municipal para a emissão retroativa e vincule a nota existente. Não altere datas apenas para liberar a emissão."};
}
