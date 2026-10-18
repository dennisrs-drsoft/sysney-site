import {createHash} from "node:crypto";
import {TableClient} from "@azure/data-tables";
import {DefaultAzureCredential} from "@azure/identity";

// Contador distribuído com ETag: funciona entre instâncias, sem guardar e-mail/IP.
// Uma linha por identidade/método, reaproveitada a cada minuto (sem crescimento por janela).
export function criarLimitador(table, {agora=Date.now, leitura=300, escrita=40}={}) {
  return async (principal, metodo) => {
    const identidade = `${principal.identityProvider||""}:${principal.userId||principal.userDetails||"administrador"}`;
    const actor = createHash("sha256").update(identidade).digest("hex");
    const rowKey = `${metodo}-${actor}`, partitionKey = "seguranca-limites";
    const now = agora(), janela = Math.floor(now/60000), retryAfter = Math.max(1,Math.ceil(((janela+1)*60000-now)/1000));
    const limite = metodo === "POST" ? escrita : leitura;
    for (let tentativa=0; tentativa<5; tentativa++) {
      let row;
      try { row=await table.getEntity(partitionKey,rowKey); } catch(e) { if(e.statusCode!==404)throw e; }
      const contagem = row?.janela===janela ? row.contagem : 0;
      if (!Number.isSafeInteger(contagem)||contagem<0) throw Error("Contador inválido.");
      if(contagem>=limite)return {permitido:false,retryAfter,actor};
      const entity={partitionKey,rowKey,janela,contagem:contagem+1};
      try {
        if(row)await table.updateEntity(entity,"Replace",{etag:row.etag});else await table.createEntity(entity);
        return {permitido:true,retryAfter,actor};
      }catch(e){if(![409,412].includes(e.statusCode))throw e;}
    }
    throw Error("Não foi possível reservar o limite de acesso.");
  };
}
let limitador;
export async function limitarAcesso(principal, metodo) {
  if(!limitador){
    const conta=process.env.ADMIN_STORAGE_ACCOUNT;
    if(!conta)throw Error("Armazenamento de segurança não configurado.");
    limitador=criarLimitador(new TableClient(`https://${conta}.table.core.windows.net`,"AdminDocumentos",new DefaultAzureCredential()));
  }
  return limitador(principal,metodo);
}
