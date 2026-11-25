import {createHash} from "node:crypto";
import type {Empresa} from "./cobrancas";
import type {FiscalSP} from "./nfse-sp";
import type {PerfilNacional} from "./nfse-nacional";
import type {RegularizacaoFiscal} from "./regularizacao-fiscal";

export type ConfiguracaoLoteFiscal = {
  emissor:"nacional"|"municipal"; ambiente:"homologacao"|"producao";
  perfil?:PerfilNacional; endereco?:FiscalSP["endereco"]; fiscal?:FiscalSP;
};
export type ItemLoteFiscal = {
  recebimentoId:string; documento:string; cliente:string; centavos:number;
  recebimento:string; referencia:string; descricao:string; fonteHash:string;
  status:"pendente"|"validando"|"pronta"|"processando"|"incerta"|"rejeitada"|"emitida"|"homologada";
  nota?:string; chave?:string; mensagem?:string; pdf?:string; xml?:string; consultaPendente?:boolean;
  historicoCobranca?:{cobrancaId:string;emailId:string;criadoEm:string}; erroHistorico?:string;
};
export type LoteEmissaoFiscal = {
  id:string; tipo:"emissao-regularizacao"; empresa:Empresa; dataFiscal:string;
  configuracao:ConfiguracaoLoteFiscal; versao:number; hash:string;
  estado:"preparado"|"validando"|"pronto"|"aprovado"|"processando"|"revisar"|"concluido";
  criadoEm:string; atualizadoEm:string; responsavel:string; itens:ItemLoteFiscal[];
  aprovacao?:{hash:string;por:string;em:string};
  execucao?:{id:string;em:string;recebimentoId:string};
  historico?:{em:string;hash:string;versao:number;motivo:string}[];
};
export const digestFiscal=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function fonteRecebimento(r:RegularizacaoFiscal){
  return digestFiscal({id:r.id,empresa:r.empresa,documento:r.documento,cliente:r.cliente,centavos:r.centavos,descricao:r.descricao,transacao:r.transacao,endToEndId:r.endToEndId,recebimento:r.recebimento,competencia:r.competencia});
}
export function validarRecebimentosEmissao(lista:RegularizacaoFiscal[],empresa:Empresa){
  if(!lista.length||lista.length>30||new Set(lista.map(r=>r.id)).size!==lista.length)throw Error("Selecione de 1 a 30 pagamentos distintos.");
  for(const r of lista){
    if(r.empresa!==empresa||!/^[a-f0-9]{64}$/.test(r.id)||!/^\d{14}$/.test(r.documento)||!Number.isSafeInteger(r.centavos)||r.centavos<=0||!r.cliente?.trim()||!r.descricao?.trim()||!r.transacao?.trim()||(!/^20\d{2}-\d{2}-\d{2}$/.test(r.recebimento)||!Number.isFinite(Date.parse(r.recebimento))||new Date(r.recebimento).toISOString().slice(0,10)!==r.recebimento))throw Error("Confira a identidade e os dados do pagamento importado.");
    if(r.nota||r.notasCandidatas?.length)throw Error("Há nota vinculada ou candidata. Confira o documento existente antes de preparar nova emissão.");
  }
  if(new Set(lista.map(r=>r.documento)).size!==1)throw Error("Selecione um cliente por lote; cada pagamento terá sua própria nota.");
}
export function manifestoLote(l:LoteEmissaoFiscal){
  return digestFiscal({empresa:l.empresa,dataFiscal:l.dataFiscal,configuracao:l.configuracao,versao:l.versao,itens:l.itens.map(i=>({recebimentoId:i.recebimentoId,fonteHash:i.fonteHash,centavos:i.centavos,documento:i.documento,descricao:i.descricao}))});
}
export function identidadesItem(l:LoteEmissaoFiscal,id:string){
  const hash=digestFiscal({origem:"regularizacao",empresa:l.empresa,recebimento:id,versao:l.versao});
  return {idNota:hash,emailId:`${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`,controleId:`${hash}_${l.dataFiscal.slice(0,7)}`};
}
export function podeRevisarLote(l:LoteEmissaoFiscal){
  return !l.execucao&&(!l.itens.some(i=>["processando","incerta","emitida","homologada"].includes(i.status))||l.configuracao.ambiente==="homologacao"&&l.itens.every(i=>i.status==="homologada"&&!!i.pdf&&!!i.xml));
}
