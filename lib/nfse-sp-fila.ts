import {randomUUID,createHash} from "node:crypto";
import {TableClient} from "@azure/data-tables";
import {DefaultAzureCredential} from "@azure/identity";
import type {ResultadoSP} from "./nfse-sp";
export type EntradaFiscalVM={acao:"testar"|"consultar";cnpj:string;xml:string;cadeia:string};
export function validarEntradaVM(e:EntradaFiscalVM){
  if(!["testar","consultar"].includes(e.acao)||!/^\d{14}$/.test(e.cnpj)||typeof e.xml!=="string"||e.xml.length>24000||typeof e.cadeia!=="string")throw Error("Pedido fiscal inválido para a VM de testes.");
}
export async function executarNaVM(entrada:EntradaFiscalVM):Promise<ResultadoSP>{
  validarEntradaVM(entrada);
  const conta=process.env.ADMIN_STORAGE_ACCOUNT||(process.env.NODE_ENV!=="production"?"sysneyadm2602":"");
  if(!/^[a-z0-9]{3,24}$/.test(conta))throw Error("Fila fiscal não configurada.");
  const tabela=new TableClient(`https://${conta}.table.core.windows.net`,"FiscalFila",new DefaultAzureCredential());
  const saude=await tabela.getEntity<{em:string;modo:string}>("servico","drserver");
  const idade=Date.now()-Date.parse(saude.em);
  if(saude.modo!=="teste"||!Number.isFinite(idade)||idade< -30000||idade>120000)throw Error("Serviço fiscal da VM indisponível. Nenhuma transmissão iniciada.");
  const id=randomUUID(),pedido=JSON.stringify(entrada),hash=createHash("sha256").update(pedido).digest("hex");
  await tabela.createEntity({partitionKey:"pedidos",rowKey:id,estado:"pendente",pedido,hash,expira:new Date(Date.now()+85000).toISOString()});
  const limite=Date.now()+90000;
  while(Date.now()<limite){
    await new Promise(r=>setTimeout(r,1500));
    const registro=await tabela.getEntity<{estado:string;hash:string;resultado?:string}>("pedidos",id);
    if(registro.hash!==hash)throw Error("Resposta fiscal divergente. Consulte antes de repetir.");
    if(registro.estado==="erro")throw Error("Teste fiscal na VM não concluído. Confira o diagnóstico do serviço; nenhuma emissão real é permitida neste modo.");
    if(registro.estado==="concluido"){
      const r:ResultadoSP=JSON.parse(registro.resultado||"null");
      if(!r||typeof r.sucesso!=="boolean"||typeof r.xml!=="string"||!Array.isArray(r.erros)||!Array.isArray(r.alertas)||r.teste!==(entrada.acao==="testar"))throw Error("Retorno da VM não confirmado.");
      return r;
    }
  }
  // Não recriar o pedido automaticamente: a VM pode ainda estar concluindo o teste.
  throw Error("Tempo de resposta da VM excedido. Nenhuma emissão real é permitida; atualize e confira antes de repetir.");
}
