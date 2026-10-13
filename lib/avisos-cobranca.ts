import {dataBr,dataValida,moeda,pago,type Cobranca} from "./cobrancas";
import type {EmailCobranca} from "./emails-cobranca";
export const AUDITORIA_AVISOS="drsoft.log@gmail.com";
export type TipoAviso="lembrete"|"vencimento"|"atraso"|"reenvio";
export const tiposAviso:Record<TipoAviso,string>={lembrete:"Lembrete de pagamento",vencimento:"Aviso de vencimento",atraso:"Pagamento em atraso",reenvio:"Reenvio da cobrança"};
export function saldoAviso(c:Cobranca,tipo:TipoAviso,hoje:string){
 if(!Object.hasOwn(tiposAviso,tipo)||!dataValida(hoje)||!dataValida(c.vencimento))throw Error("Confira o tipo de aviso e o vencimento da cobrança.");
 const recebido=pago(c),saldo=c.centavos-recebido;
 if(!Number.isSafeInteger(saldo)||saldo<=0||saldo>c.centavos)throw Error("A cobrança já foi quitada ou o saldo precisa ser conferido. Aviso bloqueado.");
 if(tipo==="atraso"&&c.vencimento>=hoje)throw Error("A cobrança ainda não está em atraso.");
 if(tipo==="vencimento"&&c.vencimento!==hoje)throw Error("Use Aviso de vencimento somente no dia do vencimento.");
 if(tipo==="lembrete"&&c.vencimento<hoje)throw Error("Esta cobrança já venceu. Use Pagamento em atraso.");
 return {recebido,saldo};
}
export function prepararAviso(origem:EmailCobranca,c:Cobranca,tipo:TipoAviso,hoje:string,id:string,em:string):EmailCobranca{
 if(origem.status!=="aceito"||origem.fluxo?.cobrancaId!==c.id||!origem.tentativas.some(t=>t.status==="aceito")||origem.centavos!==c.centavos||origem.competencia!==c.competencia||origem.vencimento!==c.vencimento)throw Error("Confirme o envio anterior e o vínculo com a cobrança antes de preparar um aviso.");
 const {recebido,saldo}=saldoAviso(c,tipo,hoje);
 const e:EmailCobranca={...origem,id,status:"rascunho",tentativas:[],atualizadoEm:em,assunto:`{{empresa}} — ${tiposAviso[tipo]} — {{competencia}}`,introducao:`${tiposAviso[tipo]} referente à cobrança abaixo. Saldo em aberto: ${moeda(saldo)}, com vencimento em ${dataBr(c.vencimento)}.`,observacoes:"Se o pagamento já foi realizado, por favor desconsidere esta mensagem e, se possível, envie o comprovante para conferência e baixa. Caso ainda não tenha pago, pedimos que efetue o pagamento o quanto antes para evitar multa, juros e possíveis interrupções dos serviços, conforme as condições do contrato. Não há suspensão automática por este aviso.",confirmarRecebimento:true,aviso:{tipo,cobrancaId:c.id,origemId:origem.id,recebidoCentavos:recebido,saldoCentavos:saldo,data:hoje}};
 e.cliente=c.clienteNome;delete e.fluxo;delete e.aprovacaoEnvio;return e;
}
export function conferirAviso(e:EmailCobranca,c:Cobranca,hoje:string){
 if(!e.aviso)throw Error("Aviso sem vínculo.");const v=saldoAviso(c,e.aviso.tipo,hoje);
 if(e.aviso.cobrancaId!==c.id||e.centavos!==c.centavos||e.competencia!==c.competencia||e.vencimento!==c.vencimento||e.cliente!==c.clienteNome||v.saldo!==e.aviso.saldoCentavos||v.recebido!==e.aviso.recebidoCentavos)throw Error("A cobrança ou o pagamento mudou. Prepare o aviso novamente antes de aprovar ou enviar.");
 if(e.aviso.data!==hoje)throw Error("Este aviso foi preparado em outra data. Prepare um aviso atualizado.");
 if(`${e.para};${e.cc}`.split(/[;,]/).some(x=>x.trim().toLowerCase()===AUDITORIA_AVISOS))throw Error("Retire o e-mail de auditoria dos destinatários visíveis. Ele será incluído em cópia oculta.");
}
