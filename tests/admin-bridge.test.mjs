import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {criarHandlerPainel} from "../admin-api/src/services/painel-handler.js";
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
let source=ts.transpileModule(readFileSync(new URL("../app/api/admin/_remote.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
source=source.replaceAll('"next/server"',JSON.stringify(uri('export const NextResponse=Response'))).replaceAll('"./_auth"',JSON.stringify(uri('export const usuarioAdministrador=r=>r.headers.get("x-test-admin")==="yes"')));
const {encaminharAdmin}=await import(uri(source));
const principal=Buffer.from(JSON.stringify({userRoles:["administrador"],userDetails:"teste"})).toString("base64");
function request(method="GET",headers={},body){
 const r=new Request("https://www.sysney.com/api/admin/emails?empresa=sysney",{method,headers:{"x-test-admin":"yes","x-ms-client-principal":principal,origin:"https://www.sysney.com",...headers},body});
 r.nextUrl=new URL(r.url);return r;
}
test("ponte bloqueia anônimo, origem cruzada e configuração incompleta; transmite bytes sem cookies",async()=>{
 process.env.NODE_ENV="production";delete process.env.ADMIN_BACKEND_EXECUTION;delete process.env.ADMIN_BACKEND_KEY;
 assert.equal((await encaminharAdmin(request("GET",{"x-test-admin":"no"}))).status,401);
 assert.equal((await encaminharAdmin(request())).status,503);
 process.env.ADMIN_BACKEND_KEY="test-private-key";
 assert.equal((await encaminharAdmin(request("POST",{origin:"https://evil.test"},"{}"))).status,403);
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,opts)=>{calls++;assert.equal(url,"https://sysney-admin-api-2602.azurewebsites.net/api/financeiro/painel/emails?empresa=sysney");assert.equal(opts.headers.get("x-functions-key"),"test-private-key");assert.equal(opts.headers.get("cookie"),null);assert.equal(opts.redirect,"error");assert.equal(Buffer.from(opts.body).toString(),"%PDF-test");return new Response("%PDF-output",{headers:{"content-type":"application/pdf","x-functions-key":"must-not-leak","set-cookie":"private"}});};
 try {const result=await encaminharAdmin(request("POST",{cookie:"do-not-forward","content-type":"application/pdf"},"%PDF-test"));assert.equal(await result.text(),"%PDF-output");assert.equal(result.headers.get("set-cookie"),null);assert.equal(result.headers.get("x-functions-key"),null);assert.equal(calls,1);}finally{globalThis.fetch=old;}
});
test("ponte reconhece host público do proxy sem liberar origem externa ou sessão anônima",async()=>{
 process.env.NODE_ENV="production";delete process.env.ADMIN_BACKEND_EXECUTION;process.env.ADMIN_BACKEND_KEY="test-private-key";
 const proxied=(method,headers={})=>{const r=request(method,headers,method==="POST"?"{}":undefined);r.nextUrl=new URL("http://localhost:8080/api/admin/emails?empresa=sysney");return r;};
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,opts)=>{calls++;assert.equal(opts.headers.get("x-admin-site-origin"),"https://www.sysney.com");if(opts.method==="POST")assert.equal(opts.headers.get("origin"),"https://www.sysney.com");return Response.json({emails:[]});};
 try {
  assert.equal((await encaminharAdmin(proxied("GET",{"x-forwarded-host":"www.sysney.com"}))).status,200);
  assert.equal((await encaminharAdmin(proxied("POST",{host:"www.sysney.com"}))).status,200);
  assert.equal((await encaminharAdmin(proxied("GET"))).status,403);
  for(const host of ["evil.test","www.sysney.com.evil.test","www.sysney.com, evil.test","www.sysney.com/path","www.sysney.com@evil.test"]){
   assert.equal((await encaminharAdmin(proxied("GET",{"x-forwarded-host":host}))).status,403);
  }
  assert.equal((await encaminharAdmin(proxied("POST",{"x-forwarded-host":"www.sysney.com",origin:"https://evil.test"}))).status,403);
  assert.equal((await encaminharAdmin(proxied("POST",{"x-forwarded-host":"www.sysney.com",origin:""}))).status,403);
  assert.equal((await encaminharAdmin(proxied("GET",{"x-forwarded-host":"www.sysney.com","x-test-admin":"no"}))).status,401);
  assert.equal(calls,2);
 }finally{globalThis.fetch=old;}
});

test("API isolada exige canal de servidor, perfil administrador e origem; mantém query e resposta PDF",async()=>{
 process.env.ADMIN_BACKEND_EXECUTION="true";
 let calls=0;
 const handler=criarHandlerPainel({emails:{GET:async req=>{calls++;assert.equal(req.nextUrl.origin,"https://www.sysney.com");assert.equal(req.nextUrl.searchParams.get("empresa"),"sysney");return new Response("%PDF-test",{headers:{"content-type":"application/pdf"}});}}});
 const req={url:"https://backend.test/api/financeiro/painel/emails?empresa=sysney",method:"GET",params:{recurso:"emails"},headers:new Headers({"x-admin-site-origin":"https://www.sysney.com"})};
 assert.equal((await handler(req)).status,401);
 req.headers.set("x-ms-client-principal",Buffer.from(JSON.stringify({userRoles:["anonymous"]})).toString("base64"));assert.equal((await handler(req)).status,401);
 req.headers.set("x-ms-client-principal",principal);req.headers.set("x-admin-site-origin","https://evil.test");assert.equal((await handler(req)).status,403);
 req.headers.set("x-admin-site-origin","https://www.sysney.com");req.params.recurso="__proto__";assert.equal((await handler(req)).status,405);
 req.params.recurso="emails";const res=await handler(req);assert.equal(res.status,200);assert.equal(res.body.toString(),"%PDF-test");assert.equal(calls,1);
 assert.match(readFileSync(new URL("../admin-api/src/functions/painel.js",import.meta.url),"utf8"),/authLevel:"function"/);
});
