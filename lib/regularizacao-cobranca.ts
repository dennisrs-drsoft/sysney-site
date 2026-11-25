import {createHash} from "node:crypto";
import type {TableClient} from "@azure/data-tables";
import {DefaultAzureCredential} from "@azure/identity";
import {BlobServiceClient} from "@azure/storage-blob";
import {dataValida,hojeBrasil,type Plano,type Cobranca,type RegularizacaoDocumental,type VinculoPix} from "./cobrancas";
import {novoEmail,validarRegularizacaoEmail,type EmailCobranca} from "./emails-cobranca";
import type {LoteEmissaoFiscal,ItemLoteFiscal} from "./regularizacao-emissao-modelo";
import type {RegularizacaoFiscal} from "./regularizacao-fiscal";

type Tabela=(nome?:string)=>TableClient;
export type ArquivoRegularizacao=(blob:string)=>Promise<{tamanho:number}>;
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
export function identidadesHistorico(empresa:string,recebimentoId:string,dataPagamento:string){
  const id=hash(`regularizacao-cobranca-v1:${empresa}:${recebimentoId}`);
  return {planoId:id,cobrancaId:`${id}_${dataPagamento.slice(0,7)}`,emailId:`${id.slice(0,8)}-${id.slice(8,12)}-4${id.slice(13,16)}-a${id.slice(17,20)}-${id.slice(20,32)}`};
}
export const conferirArquivoRegularizacao:ArquivoRegularizacao=async path=>{
  const conta=process.env.ADMIN_STORAGE_ACCOUNT||(process.env.NODE_ENV!=="production"?"sysneyadm2602":"");
  if(!conta)throw Error("Armazenamento não configurado.");
  const props=await new BlobServiceClient(`https://${conta}.blob.core.windows.net`,new DefaultAzureCredential()).getContainerClient("admin-anexos").getBlobClient(path).getProperties();
  if(!props.contentLength||props.contentLength>5000000)throw Error("Documento de regularização fora do limite.");
  return {tamanho:props.contentLength};
};

/** Só materializa nota confirmada. Não chama emissor, banco ou provedor de e-mail. */
export async function criarCobrancaRegularizada({table,lote:l,item:i,recebimento:r,por,em,arquivo=conferirArquivoRegularizacao}:{table:Tabela;lote:LoteEmissaoFiscal;item:ItemLoteFiscal;recebimento:RegularizacaoFiscal;por:string;em:string;arquivo?:ArquivoRegularizacao}){
  if(l.configuracao.ambiente!=="producao"||l.aprovacao?.hash!==l.hash||i.status!=="emitida"||!i.nota||!i.pdf||!i.xml||r.empresa!==l.empresa||r.id!==i.recebimentoId||r.documento!==i.documento||r.centavos!==i.centavos||r.recebimento!==i.recebimento||r.nota!==i.nota||!dataValida(r.recebimento)||!r.transacao)throw Error("Confirme a nota, seus documentos e o vínculo ao pagamento antes de organizar o histórico.");
  for(const path of [i.pdf,i.xml])if(!path.startsWith(`historico/${l.empresa}/nfse/`)||path.includes(".."))throw Error("Documento de outra empresa ou ambiente.");
  const ids=identidadesHistorico(l.empresa,r.id,r.recebimento),emp=l.empresa,part=`cobrancas-${emp}`;
  async function opcional(p:string,k:string,nome="AdminDocumentos"){try{return await table(nome).getEntity<{json:string}>(p,k);}catch(e){if((e as {statusCode?:number}).statusCode!==404)throw e;return null;}}
  // Reserva no mesmo namespace da conciliação normal: o PIX não quita outra cobrança.
  const pixId=r.endToEndId||r.transacao,pk=`pix-conciliacao-${emp}`,vk=`c-${hash(ids.cobrancaId)}`,rk=`p-${hash(pixId)}`;
  const [reserva,vinculo]=await Promise.all([opcional(pk,rk),opcional(pk,vk)]);
  if(reserva&&JSON.parse(reserva.json).cobrancaId!==ids.cobrancaId)throw Error("O PIX já está vinculado a outra cobrança. Confira o histórico sem duplicar a baixa.");
  if(vinculo){const v=JSON.parse(vinculo.json) as VinculoPix;if(v.cobrancaId!==ids.cobrancaId||v.pixId!==pixId||v.documento!==r.documento||v.centavos!==r.centavos||v.data!==r.recebimento)throw Error("O vínculo bancário mudou. Confira antes de criar outro registro.");}
  if(!reserva||!vinculo){
    const v:VinculoPix={tipo:"vinculo",cobrancaId:ids.cobrancaId,pixId,documento:r.documento,centavos:r.centavos,vencimento:r.recebimento,data:r.recebimento,em,responsavel:por,modo:"regularização documental de pagamento histórico"};
    await table().submitTransaction([
      ...(vinculo?[]:[["create",{partitionKey:pk,rowKey:vk,json:JSON.stringify(v)}] as import("@azure/data-tables").TransactionAction]),
      ...(reserva?[]:[["create",{partitionKey:pk,rowKey:rk,json:JSON.stringify({tipo:"reserva",cobrancaId:ids.cobrancaId,pixId})}] as import("@azure/data-tables").TransactionAction]),
    ]);
  }
  const meta:RegularizacaoDocumental={loteId:l.id,recebimentoId:r.id,documento:r.documento,dataPagamento:r.recebimento,emissaoFiscal:l.dataFiscal,referenciaHistorica:r.competencia,transacao:r.transacao,endToEndId:r.endToEndId,registradoEm:em};
  const cp=await opcional(part,ids.cobrancaId),ep=await opcional(`emails-${emp}`,ids.emailId);
  const same=(a:RegularizacaoDocumental|undefined)=>!!a&&a.loteId===meta.loteId&&a.recebimentoId===r.id&&a.documento===r.documento&&a.transacao===r.transacao&&a.endToEndId===r.endToEndId&&a.dataPagamento===r.recebimento&&a.emissaoFiscal===l.dataFiscal;
  // Nunca sobrescrever um rascunho editado/aprovado/enviado numa repetição ou retomada.
  let c=cp?JSON.parse(cp.json) as Cobranca:null,e=ep?JSON.parse(ep.json) as EmailCobranca:null;
  if(c&&(!same(c.regularizacao)||c.centavos!==r.centavos||c.nota!==i.nota||c.notaChave!==(i.chave||"")||c.boleto))throw Error("Cobrança histórica divergente. Confira o registro existente.");
  if(e&&(!same(e.regularizacao)||e.centavos!==r.centavos||e.fluxo?.nota!==i.nota||e.fluxo?.notaChave!==(i.chave||"")||e.fluxo?.cobrancaId!==ids.cobrancaId))throw Error("Rascunho histórico divergente. Confira a mensagem existente.");
  const registradoEm=c?.regularizacao?.registradoEm||e?.regularizacao?.registradoEm||em;
  meta.registradoEm=registradoEm;
  if(!c)c={id:ids.cobrancaId,planoId:ids.planoId,competencia:r.recebimento.slice(0,7),clienteNome:r.cliente,email:r.email,descricao:r.descricao,centavos:r.centavos,envioPrevisto:r.recebimento,vencimento:r.recebimento,nota:i.nota,notaEmissor:l.configuracao.emissor,notaChave:i.chave||"",boleto:"",demonstrativo:false,persistida:true,regularizacao:meta,eventos:[
    {id:`regularizacao-${r.id}`,tipo:"alteracao",data:hojeBrasil(),registradoEm,responsavel:por,detalhe:"Registro histórico de serviço já pago. Emissão fiscal atual; sem presumir envio anterior nem solicitar novo pagamento."},
    {id:`documento-${r.id}`,tipo:"documentos",data:l.dataFiscal,registradoEm,responsavel:por,detalhe:`NFS-e ${i.nota} vinculada após regularização. PDF e XML preservados; sem nova emissão.`},
    {id:`pix-${hash(pixId)}`,tipo:"pagamento",data:r.recebimento,registradoEm,responsavel:por,detalhe:"PIX histórico conferido no extrato Inter, vinculado à nota de regularização. Não representa novo crédito.",centavos:r.centavos,fonte:"banco",referencia:pixId},
  ]};
  const salvarNovo=async(p:string,k:string,obj:object,nome="AdminDocumentos")=>{await table(nome).createEntity({partitionKey:p,rowKey:k,json:JSON.stringify(obj)});};
  if(!cp)await salvarNovo(part,c.id,c);
  if(!e){
    const [pdf,xml]=await Promise.all([arquivo(i.pdf),arquivo(i.xml)]);
    e={...novoEmail(emp,r.cliente),id:ids.emailId,para:r.email,contato:r.contato,competencia:r.recebimento.slice(0,7),vencimento:r.recebimento,centavos:r.centavos,descricao:r.descricao,responderPara:emp==="sysney"?"financeiro@sysney.com":"financeiro@drsoftinformatica.com",formaPagamento:"pix",regularizacao:meta,
      assunto:`{{empresa}} — Regularização de serviço já pago — NFS-e ${i.nota}`,
      introducao:`Encaminhamos o PDF e o XML da NFS-e nº ${i.nota}, emitida para regularizar a documentação de um serviço anterior já quitado. O pagamento por PIX foi recebido em ${r.recebimento.split("-").reverse().join("/")}.`,
      observacoes:"Este envio é exclusivamente documental. O pagamento anterior está vinculado à nota e não há novo valor a pagar.",atualizadoEm:em,
      fluxo:{cobrancaId:c.id,nota:i.nota,notaEmissor:l.configuracao.emissor,notaChave:i.chave||"",boleto:""},
      anexos:[{tipo:"nota",nome:`NFSe_${i.nota}.pdf`,blob:i.pdf,tamanho:pdf.tamanho},{tipo:"xml",nome:`NFSe_${i.nota}.xml`,blob:i.xml,tamanho:xml.tamanho}],
    };
    validarRegularizacaoEmail(e,c);await salvarNovo(`emails-${emp}`,e.id,e);
  }else validarRegularizacaoEmail(e,c);
  const plano=await opcional(part,ids.planoId,"AdminConfiguracoes");
  if(plano){const p=JSON.parse(plano.json) as Plano;if(p.documento!==r.documento||p.id!==c.planoId||p.centavos!==c.centavos||p.inicio!==c.competencia||p.fim!==c.competencia||!p.avulsa)throw Error("Cadastro histórico divergente. Não crie outra cobrança.");}
  else await salvarNovo(part,ids.planoId,{id:ids.planoId,clienteId:r.documento,clienteNome:r.cliente,documento:r.documento,email:r.email,descricao:r.descricao,centavos:r.centavos,inicio:c.competencia,fim:c.competencia,diaEnvio:Number(r.recebimento.slice(-2)),mesEnvio:0,diaVencimento:Number(r.recebimento.slice(-2)),mesVencimento:0,criadoEm:registradoEm,avulsa:true,regularizacao:{recebimentoId:r.id,loteId:l.id}} satisfies Plano,"AdminConfiguracoes");
  const fila=await opcional(`fila-${emp}`,`fila-${c.id}`);
  if(fila&&String((fila as unknown as {emailId:string}).emailId)!==e.id)throw Error("Outra mensagem foi vinculada à cobrança. Confira a fila.");
  if(!fila)await table().createEntity({partitionKey:`fila-${emp}`,rowKey:`fila-${c.id}`,emailId:e.id});
  return {cobrancaId:c.id,emailId:e.id,criadoEm:registradoEm};
}
