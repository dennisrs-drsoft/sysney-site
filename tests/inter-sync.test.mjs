import { test } from "node:test";
import assert from "node:assert/strict";
import { executarSync, solicitarSync, statusSync, normalizarSnapshot } from "../admin-api/src/services/inter-sync.js";
import { integrarPagamentosInter } from "../lib/cobrancas.ts";
import { readFileSync } from "node:fs";
process.env.INTER_SYNC_SYSNEY_ENABLED="true";
function storage(){
 const rows=new Map();let etag=0;
 return {rows,async getEntity(p,r){const row=rows.get(`${p}/${r}`);if(!row)throw Object.assign(Error(),{statusCode:404});return {...row};},
 async createEntity(e){const k=`${e.partitionKey}/${e.rowKey}`;if(rows.has(k))throw Object.assign(Error(),{statusCode:409});rows.set(k,{...e,etag:String(++etag)});},
 async updateEntity(e,mode,o){const k=`${e.partitionKey}/${e.rowKey}`,old=rows.get(k);if(old.etag!==o.etag)throw Object.assign(Error(),{statusCode:412});rows.set(k,{...(mode==="Merge"?old:{}),...e,etag:String(++etag)});},
 async upsertEntity(e){const k=`${e.partitionKey}/${e.rowKey}`;rows.set(k,{...rows.get(k),...e,etag:String(++etag)});},
 async *listEntities(){for(const e of rows.values())if(e.partitionKey==="inter-historico-sysney")yield {...e};}};
}
const item={cobranca:{codigoSolicitacao:"abc-123",pagador:{cpfCnpj:"123"},valorNominal:100,situacao:"RECEBIDO",dataVencimento:"2026-10-09",dataSituacao:"2026-10-08"},boleto:{nossoNumero:"0012"}};
test("sincronização mantém PDF, é idempotente, possui intervalo e trava concorrente",async()=>{
 const table=storage(),r=normalizarSnapshot(item);await table.upsertEntity({...r,pdfBlob:"privado.pdf"});
 let count=0;const listar=async()=>{count++;return [item];};
 await executarSync({table,listar});assert.equal(count,1);assert.equal(table.rows.get(`${r.partitionKey}/${r.rowKey}`).pdfBlob,"privado.pdf");
 assert.equal((await executarSync({table,listar})).aguardando,true);
 await solicitarSync(table,"teste");await Promise.all([executarSync({table,listar}),executarSync({table,listar})]);assert.equal(count,2);
 assert.equal(table.rows.size,2);
});
test("falha preserva último sucesso e dados; pedido manual não executa banco",async()=>{
 const table=storage();await executarSync({table,listar:async()=>[item]});
 const anterior=statusSync(await table.getEntity("inter-sync-sysney","controle")).ultimoSucesso;
 await solicitarSync(table,"teste");assert.equal(statusSync(await table.getEntity("inter-sync-sysney","controle")).estado,"solicitada");
 await executarSync({table,listar:async()=>{throw Error("segredo não deve aparecer");}});
 const s=statusSync(await table.getEntity("inter-sync-sysney","controle"));assert.equal(s.estado,"falha");assert.equal(s.ultimoSucesso,anterior);assert.doesNotMatch(s.erro,/segredo/);
 assert.throws(()=>normalizarSnapshot({cobranca:{}}));
});
test("pagamento automático exige número, documento, valor, vencimento e confirmação; preserva manual",()=>{
 const c={id:"c",planoId:"p",centavos:10000,boleto:"12",vencimento:"2026-10-09",eventos:[]};
 const p=[{id:"p",documento:"123"}],b=[{...item,consultadoEm:new Date().toISOString()}];
 assert.equal(integrarPagamentosInter([c],p,b,[])[0].eventos[0].fonte,"banco");
 for(const change of [{situacao:"CANCELADO"},{situacao:"A_RECEBER"},{valorNominal:99},{pagador:{cpfCnpj:"456"}},{dataSituacao:""}])assert.equal(integrarPagamentosInter([c],p,[{...b[0],cobranca:{...item.cobranca,...change}}],[])[0].eventos.length,0);
 const manual={...c,eventos:[{id:"m",tipo:"pagamento",centavos:10000}]};assert.equal(integrarPagamentosInter([manual],p,b,[])[0],manual);
 assert.equal(integrarPagamentosInter([c,{...c,id:"d"}],p,b,[])[0].eventos.length,0);
 assert.equal(c.eventos.length,0);
});
test("rotina automática apenas consulta Inter e escreve snapshots; não emite/cancela/envia",()=>{
 const s=readFileSync(new URL("../admin-api/src/services/inter-sync.js",import.meta.url),"utf8");
 assert.doesNotMatch(s,/emitirCobranca|cancelarCobranca|sendgrid|mail.send/);
 const f=readFileSync(new URL("../admin-api/src/functions/inter-sync.js",import.meta.url),"utf8");assert.match(f,/useMonitor: true/);assert.match(f,/runOnStartup: false/);
});
