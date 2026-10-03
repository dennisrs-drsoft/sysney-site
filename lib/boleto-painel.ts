import {createHash} from "node:crypto";
import {dataValida,hojeBrasil,type Cobranca} from "./cobrancas";
import type {EmailCobranca} from "./emails-cobranca";

export type PagadorBoleto = Record<string,string>;
export type PayloadBoleto = {seuNumero:string;valorNominal:number;dataVencimento:string;numDiasAgenda:number;pagador:PagadorBoleto;multa:{codigo:string;taxa:number};mora:{codigo:string;taxa:number};mensagem:Record<string,string>};
export type PreviaBoleto = {id:string;emailId:string;empresa:"sysney";cobrancaId:string;documento:string;competencia:string;po:string;descricao:string;hash:string;criadoEm:string;payload:PayloadBoleto};
export function hashDadosBoleto(e:EmailCobranca,c:Cobranca,documento:string) {
  return createHash("sha256").update(JSON.stringify({id:e.id,empresa:e.empresa,cobrancaId:c.id,documento,competencia:c.competencia,centavos:c.centavos,vencimento:c.vencimento,descricao:e.descricao,po:e.po || ""})).digest("hex");
}
export function conferirDadosBoleto(e:EmailCobranca,c:Cobranca) {
  if(e.empresa!=="sysney" || e.fluxo?.cobrancaId!==c.id || e.centavos!==c.centavos || e.competencia!==c.competencia || e.vencimento!==c.vencimento) throw new Error("Cobrança divergente. Atualize antes de emitir.");
  if(!Number.isSafeInteger(c.centavos) || c.centavos<250 || c.centavos>100000000 || !dataValida(c.vencimento) || c.vencimento<hojeBrasil()) throw new Error("Confira valor e vencimento do boleto.");
}
export function montarPayloadBoleto(e:EmailCobranca,c:Cobranca,documento:string,pessoa:PagadorBoleto,termos:{multa?:{codigo:string;taxa:number};mora?:{codigo:string;taxa:number};descontos?:unknown[]}) : PayloadBoleto {
  conferirDadosBoleto(e,c);
  if(pessoa.cpfCnpj?.replace(/\D/g,"")!==documento) throw new Error("Pagador bancário não corresponde ao cliente.");
  const pagador:PagadorBoleto={};
  for(const k of ["cpfCnpj","tipoPessoa","nome","endereco","numero","complemento","bairro","cidade","uf","cep"]) if(typeof pessoa[k]==="string")pagador[k]=pessoa[k];
  for(const k of ["cpfCnpj","tipoPessoa","nome","endereco","cidade","uf","cep"]) if(!pagador[k]?.trim())throw new Error(`Cadastro bancário incompleto: ${k}. Emita manualmente e atualize o cadastro no banco.`);
  if(termos.multa?.codigo!=="PERCENTUAL" || termos.mora?.codigo!=="TAXAMENSAL" || !Number.isFinite(termos.multa.taxa) || termos.multa.taxa<0 || termos.multa.taxa>2 || !Number.isFinite(termos.mora.taxa) || termos.mora.taxa<0 || termos.mora.taxa>1 || termos.descontos?.length) throw new Error("As condições do boleto anterior exigem conferência manual no banco.");
  const texto=`${e.descricao.trim()}${e.po ? ` | PO ${e.po}` : ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
  if(!e.descricao.trim() || texto.length>390)throw new Error("Descrição e PO devem caber em 390 caracteres para o boleto.");
  const mensagem:Record<string,string>={};
  for(let i=0;i<texto.length;i+=78)mensagem[`linha${i/78+1}`]=texto.slice(i,i+78);
  return {seuNumero:`S${createHash("sha256").update(c.id).digest("hex").slice(0,14)}`,valorNominal:c.centavos/100,dataVencimento:c.vencimento,numDiasAgenda:30,pagador,multa:{codigo:"PERCENTUAL",taxa:termos.multa.taxa},mora:{codigo:"TAXAMENSAL",taxa:termos.mora.taxa},mensagem};
}
