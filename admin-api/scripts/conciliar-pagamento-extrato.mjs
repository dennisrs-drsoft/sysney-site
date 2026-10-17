// Conciliação explícita de um crédito comprovado no extrato; nunca escreve no banco.
import {createHash} from "node:crypto";
import {TableClient} from "@azure/data-tables";
import {DefaultAzureCredential} from "@azure/identity";
import {consultarPaginaExtratoInter} from "../src/services/inter.js";
import {pago,dataValida} from "../../lib/cobrancas.ts";
const [empresa,id,data,valor,tipo,confirmar]=process.argv.slice(2),centavos=Number(valor);
if(!["sysney","drsoft"].includes(empresa)||!/^[a-f0-9]{64}_20\d{2}-\d{2}$/.test(id||"")||!dataValida(data)||!Number.isSafeInteger(centavos)||centavos<=0||!["PIX","BOLETO_COBRANCA"].includes(tipo))throw Error("Informe empresa, cobrança, data, valor em centavos e tipo. Sem --confirmar somente confere.");
const cred=new DefaultAzureCredential(),conta=process.env.ADMIN_STORAGE_ACCOUNT;if(!conta)throw Error("Armazenamento ausente.");
const table=new TableClient(`https://${conta}.table.core.windows.net`,"AdminDocumentos",cred),config=new TableClient(`https://${conta}.table.core.windows.net`,"AdminConfiguracoes",cred);
const row=await table.getEntity(`cobrancas-${empresa}`,id),c=JSON.parse(row.json);
const p=JSON.parse((await config.getEntity(`cobrancas-${empresa}`,c.planoId)).json),doc=p.documento.replace(/\D/g,"");
const transacoes=[];
for(let pagina=0;pagina<10;pagina++){
 const r=await consultarPaginaExtratoInter({empresa,dataInicial:data,dataFinal:data,pagina});
 if(!Array.isArray(r.transacoes)||!Number.isSafeInteger(r.totalPaginas))throw Error("Extrato incompleto.");
 transacoes.push(...r.transacoes);if(r.ultimaPagina===true&&pagina+1>=r.totalPaginas)break;if(pagina===9)throw Error("Extrato excede limite; não conciliar parcialmente.");
}
const candidatos=transacoes.filter(t=>t.tipoOperacao==="C"&&t.tipoTransacao===tipo&&t.dataTransacao===data&&Math.round(Number(t.valor)*100)===centavos&&String(t.detalhes?.cpfCnpjPagador||t.detalhes?.cpfCnpj||"").replace(/\D/g,"")===doc);
if(candidatos.length!==1||!c.nota)throw Error("Não há um único crédito compatível ou a nota está ausente.");
const t=candidatos[0],b=t.detalhes,hash=createHash("sha256").update(`${tipo}:${t.idTransacao}`).digest("hex"),eventoId=`extrato-${hash}`;
if(c.eventos.some(e=>e.id===eventoId)){console.log(JSON.stringify({jaConciliado:true,nota:c.nota}));process.exit(0);}
const saldo=c.centavos-pago(c);let principal;
if(tipo==="PIX"){
 if(c.boleto||centavos!==saldo||!b.endToEndId)throw Error("PIX não corresponde ao saldo integral restante ou há boleto.");
 principal=saldo;
}else{
 const bancos=[];for await(const r of table.listEntities({queryOptions:{filter:`PartitionKey eq 'inter-historico-${empresa}'`}})){const v=JSON.parse(r.json);if(String(v.boleto?.nossoNumero)===String(b.nossoNumero))bancos.push(v);}
 const bank=bancos[0]?.cobranca;
 const normal=v=>String(v||"").replace(/\D/g,"").replace(/^0+/,"");
 if(bancos.length!==1||!bank||bank.pagador?.cpfCnpj?.replace(/\D/g,"")!==doc||bank.dataVencimento!==c.vencimento||b.dataVencimento!==c.vencimento||Math.round(Number(bank.valorNominal)*100)!==c.centavos||normal(bank.seuNumero)!==normal(c.nota)||normal(b.seuNumero)!==normal(c.nota)||saldo!==c.centavos||centavos<saldo)throw Error("Crédito de boleto não possui identidade inequívoca ou já há pagamento parcial.");
 principal=saldo;
}
const resumo={empresa,nota:c.nota,data,tipo,documento:doc,nossoNumero:tipo==="BOLETO_COBRANCA"?String(b.nossoNumero):"",vencimento:c.vencimento,principalCentavos:principal,recebidoCentavos:centavos,diferencaNaoClassificadaCentavos:centavos-principal};
if(confirmar!=="--confirmar"){console.log(JSON.stringify({...resumo,previa:true}));process.exit(0);}
const reservar=async(partitionKey,rowKey,entity)=>{
 try{await table.createEntity({partitionKey,rowKey,...entity});}catch(e){if(e.statusCode!==409)throw e;const old=await table.getEntity(partitionKey,rowKey);const v=JSON.parse(old.json);if(v.cobrancaId!==id)throw Error("Transação já reservada para outra cobrança.");}
};
await reservar(`recebimentos-conferidos-${empresa}`,hash,{json:JSON.stringify({...resumo,cobrancaId:id,transacao:t.idTransacao,registradoEm:new Date().toISOString()})});
if(tipo==="PIX")await reservar(`pix-conciliacao-${empresa}`,`p-${createHash("sha256").update(b.endToEndId).digest("hex")}`,{json:JSON.stringify({tipo:"reserva",cobrancaId:id,pixId:b.endToEndId,modo:"Conferência de parcela no extrato"})});
c.eventos.push({id:eventoId,tipo:"pagamento",centavos:principal,recebidoCentavos:centavos,data,registradoEm:new Date().toISOString(),responsavel:"Sistema — conferência autorizada do extrato Inter",fonte:"banco",referencia:t.idTransacao,detalhe:`Crédito ${tipo} confirmado no extrato. Principal ${(principal/100).toFixed(2)}; recebido ${(centavos/100).toFixed(2)}; diferença ${((centavos-principal)/100).toFixed(2)} a classificar, sem presumir multa/juros. Nenhuma nova nota, boleto ou mensagem emitida.`});
await table.updateEntity({partitionKey:`cobrancas-${empresa}`,rowKey:id,json:JSON.stringify(c)},"Replace",{etag:row.etag});
console.log(JSON.stringify({...resumo,conciliado:true,saldoCentavos:c.centavos-pago(c)}));
