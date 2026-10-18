import {test} from "node:test";
import assert from "node:assert/strict";
import {lerCorpoLimitado,headersNavegador} from "../admin-api/src/services/seguranca-http.mjs";
import {criarLimitador} from "../admin-api/src/services/limite-acesso.js";
import {criarHandlerPainel} from "../admin-api/src/services/painel-handler.js";

test("corpo é limitado durante leitura, inclusive sem tamanho e com tamanho falso",async()=>{
  let cancelado=false;
  const req=(headers={})=>({headers:new Headers(headers),body:new ReadableStream({start(c){c.enqueue(new Uint8Array(6));c.enqueue(new Uint8Array(6));},cancel(){cancelado=true;}})});
  for(const headers of [{},{"content-length":"1"}])await assert.rejects(lerCorpoLimitado(req(headers),10),e=>e.status===413);
  assert.equal(cancelado,true);
  await assert.rejects(lerCorpoLimitado(req({"content-length":"11"}),10),e=>e.status===413);
  await assert.rejects(lerCorpoLimitado(req({"content-length":"abc"}),10),e=>e.status===400);
  assert.equal((await lerCorpoLimitado(new Request("https://test",{method:"POST",body:"ok"}),10)).toString(),"ok");
});

test("stream lento expira e é cancelado sem bloquear a execução",async()=>{
  let cancelado=false;
  await assert.rejects(lerCorpoLimitado({headers:new Headers(),body:new ReadableStream({cancel(){cancelado=true;}})},10,15),e=>e.status===408);
  assert.equal(cancelado,true);
});

function tabelaMemoria(){
 const rows=new Map();let versao=0;
 return {rows,async getEntity(p,k){const r=rows.get(p+k);if(!r)throw {statusCode:404};return {...r};},async createEntity(e){if(rows.has(e.partitionKey+e.rowKey))throw {statusCode:409};rows.set(e.partitionKey+e.rowKey,{...e,etag:String(++versao)});},async updateEntity(e,modo,{etag}){assert.equal(modo,"Replace");if(rows.get(e.partitionKey+e.rowKey)?.etag!==etag)throw {statusCode:412};rows.set(e.partitionKey+e.rowKey,{...e,etag:String(++versao)});}};
}
const p={identityProvider:"github",userId:"fake-test-id",userDetails:"nao-gravar@test.invalid"};
test("limite é distribuído, usa ETag, separa leitura/escrita e não armazena identidade pessoal",async()=>{
 const table=tabelaMemoria();let now=0;
 const a=criarLimitador(table,{agora:()=>now,leitura:2,escrita:1}),b=criarLimitador(table,{agora:()=>now,leitura:2,escrita:1});
 assert.ok((await a(p,"GET")).permitido);assert.ok((await b(p,"GET")).permitido);assert.equal((await a(p,"GET")).permitido,false);
 assert.ok((await b(p,"POST")).permitido);assert.equal((await a(p,"POST")).permitido,false);
 assert.doesNotMatch(JSON.stringify([...table.rows]),/fake-test-id|nao-gravar/);
 now=60_000;assert.ok((await a(p,"GET")).permitido);assert.equal(table.rows.size,2);
 const conc=tabelaMemoria(),x=criarLimitador(conc,{agora:()=>0,leitura:1}),y=criarLimitador(conc,{agora:()=>0,leitura:1});
 assert.equal((await Promise.all([x(p,"GET"),y(p,"GET")])).filter(r=>r.permitido).length,1);
});

test("429/503 bloqueiam antes do handler; origem inválida nem consulta contador",async()=>{
 process.env.ADMIN_BACKEND_EXECUTION="true";let calls=0,limits=0;
 const principal=Buffer.from(JSON.stringify({...p,userRoles:["administrador"]})).toString("base64");
 const req={url:"https://backend/api/financeiro/painel/emails",params:{recurso:"emails"},method:"POST",body:null,headers:new Headers({"x-admin-site-origin":"https://www.sysney.com",origin:"https://www.sysney.com","x-ms-client-principal":principal})};
 const rotas={emails:{POST:async()=>{calls++;return Response.json({ok:true});}}};
 const h=criarHandlerPainel(rotas,{limitar:async()=>{limits++;return {permitido:false,retryAfter:15,actor:"hash"};}});
 const r=await h(req);assert.equal(r.status,429);assert.equal(r.headers["Retry-After"],"15");assert.equal(calls,0);
 const fail=criarHandlerPainel(rotas,{limitar:async()=>{throw Error("segredo nunca deve sair");}});
 const f=await fail(req);assert.equal(f.status,503);assert.doesNotMatch(JSON.stringify(f),/segredo nunca/);assert.equal(calls,0);
 req.headers.set("origin","https://evil.invalid");assert.equal((await h(req)).status,403);assert.equal(limits,1);
});

test("headers preservam prévia, Turnstile e desenvolvimento, sem CSP permissiva por wildcard",()=>{
 const prod=Object.fromEntries(headersNavegador().map(h=>[h.key,h.value]));
 assert.equal(prod["X-Frame-Options"],"SAMEORIGIN");assert.match(prod["Content-Security-Policy"],/frame-ancestors 'self'/);
 assert.match(prod["Content-Security-Policy"],/https:\/\/challenges.cloudflare.com/);
 assert.doesNotMatch(prod["Content-Security-Policy"],/unsafe-eval|\*/);
 assert.doesNotMatch(prod["Strict-Transport-Security"],/includeSubDomains|preload/);
 const dev=Object.fromEntries(headersNavegador(false).map(h=>[h.key,h.value]));assert.equal(dev["Strict-Transport-Security"],undefined);
 assert.match(dev["Content-Security-Policy"],/unsafe-eval/);
});
