import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const uri = s => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const compile = p => ts.transpileModule(readFileSync(new URL(p,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=uri(compile("../lib/cobrancas.ts"));
const emailModel=uri(compile("../lib/emails-cobranca.ts").replaceAll('"./cobrancas"',JSON.stringify(model)));
const approvalModel=uri(compile("../lib/aprovacao-envio.ts").replaceAll('"./emails-cobranca"',JSON.stringify(emailModel)));
const {novoEmail,htmlEmail}=await import(emailModel);
const db=uri(`export const records=new Map(); export class TableClient {
constructor(url,name){this.name=name} key(p,r){return this.name+':'+p+':'+r}
async getEntity(p,r){const e=records.get(this.key(p,r));if(!e)throw Object.assign(new Error('Missing'),{statusCode:404});return structuredClone(e)}
async createEntity(e){const k=this.key(e.partitionKey,e.rowKey);if(records.has(k))throw Object.assign(new Error('Conflict'),{statusCode:409});records.set(k,{...e,etag:'1'})}
async updateEntity(e,mode,o){const k=this.key(e.partitionKey,e.rowKey);if(records.get(k).etag!==o.etag)throw Object.assign(new Error('Conflict'),{statusCode:412});records.set(k,{...e,etag:String(Number(o.etag)+1)})}
async *listEntities(o){const part=o.queryOptions.filter.split("'")[1];for(const e of records.values())if(e.partitionKey===part)yield structuredClone(e)} }`);
let source=compile("../app/api/admin/emails/route.ts");
for(const [name,target] of Object.entries({
  "next/server":uri("export const NextResponse={json:(data,options)=>Response.json(data,options)}"),
  "@azure/data-tables":db,
  "@azure/identity":uri("export class DefaultAzureCredential {}"),
  "@azure/keyvault-secrets":uri("export class SecretClient {async getSecret(){return {value:'test'}}}"),
  "@azure/storage-blob":uri("export class BlobServiceClient {getContainerClient(){return {getBlockBlobClient:()=>({downloadToBuffer:async()=>Buffer.from('%PDF-test')})}}}"),
  "../_auth":uri("export const usuarioAdministrador=r=>r.headers.get('x-test-auth')==='yes'"),
  "../_remote":uri("export const encaminharAdmin=async()=>null"),
  "@/lib/emails-cobranca":emailModel,
  "@/lib/cobrancas":model,
  "@/lib/aprovacao-envio":approvalModel,
}))source=source.replaceAll(JSON.stringify(name),JSON.stringify(target));
const {GET,POST}=await import(uri(source)); const {records}=await import(db);
process.env.ADMIN_STORAGE_ACCOUNT="test";
process.env.SENDGRID_API_KEY="test-key";
process.env.SENDGRID_FROM_EMAIL="sender@example.com";
process.env.SENDGRID_FROM_EMAIL_SYSNEY="sender@example.com";
process.env.SENDGRID_FROM_EMAIL_DRSOFT="drsoft@example.com";
function request(body,empresa="sysney",headers={}){const url=new URL(`http://localhost:3100/api/admin/emails?empresa=${empresa}`);const r=new Request(url,{method:body?"POST":"GET",headers:{origin:url.origin,"x-test-auth":"yes",...headers},body:body?JSON.stringify(body):undefined});r.nextUrl=url;return r;}

test("remetente financeiro é segregado por empresa",async()=>{
  assert.equal((await (await GET(request(null,"sysney"))).json()).remetente,"sender@example.com");
  assert.equal((await (await GET(request(null,"drsoft"))).json()).remetente,"drsoft@example.com");
});
test("modelo escapa HTML e preserva campos pendentes e logo incorporado",()=>{
  const e=novoEmail("sysney","<script>alert(1)</script>");
  const html=htmlEmail(e,"cid:logo-sysney");
  assert.ok(html.includes("&lt;script&gt;")); assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("cid:logo-sysney")); assert.ok(html.includes("A confirmar"));
});
test("API exige revisão e anexos; envio aceito não permite repetição",async()=>{
  assert.equal((await GET(request(null,"sysney",{"x-test-auth":"no"}))).status,401);
  const draft={...novoEmail("sysney","Teste"),para:"cliente@example.com",responderPara:"financeiro@example.com",competencia:"2026-10",centavos:10000,vencimento:"2026-10-15"};
  let e=(await (await POST(request({acao:"salvar",email:draft}))).json()).email;
  assert.equal((await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm}))).status,400);
  assert.equal((await POST(request({acao:"revisar",id:e.id,atualizadoEm:e.atualizadoEm}))).status,400);
  assert.equal((await (await GET(request(null,"drsoft"))).json()).emails.length,0);
  const key=`AdminDocumentos:emails-sysney:${e.id}`;const row=records.get(key);
  e.anexos=[{tipo:"nota",nome:"nota.pdf",blob:"test/nota",tamanho:10},{tipo:"boleto",nome:"boleto.pdf",blob:"test/boleto",tamanho:10}];row.json=JSON.stringify(e);
  e=(await (await POST(request({acao:"revisar",id:e.id,atualizadoEm:e.atualizadoEm,remetente:"sender@example.com"}))).json()).email;
  assert.equal(e.status,"revisado");
  let sends=0;const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{assert.equal(url,"https://api.sendgrid.com/v3/mail/send");const body=JSON.parse(options.body);assert.equal(body.attachments.length,3);assert.equal(body.reply_to.email,"financeiro@example.com");sends++;return new Response(null,{status:202,headers:{"x-message-id":"test-id"}})};
  try{e=(await (await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm}))).json()).email;
    assert.equal(e.status,"aceito");assert.equal(e.tentativas[0].messageId,"test-id");
    assert.equal((await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm}))).status,400);assert.equal(sends,1);
  }finally{globalThis.fetch=original;}
});

test("aprovação vincula dados e remetente; salvar e duplicar revogam; legado não envia",async()=>{
  const draft={...novoEmail("sysney","Revisão"),para:"cliente@example.com",responderPara:"financeiro@example.com",competencia:"2026-11",centavos:10000,vencimento:"2026-12-08"};
  let e=(await (await POST(request({acao:"salvar",email:draft}))).json()).email;
  const key=`AdminDocumentos:emails-sysney:${e.id}`;
  e.anexos=[{tipo:"nota",nome:"nota.pdf",blob:"test/nota",tamanho:10},{tipo:"boleto",nome:"boleto.pdf",blob:"test/boleto",tamanho:10}];
  records.get(key).json=JSON.stringify({...e,status:"revisado"});
  assert.equal((await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm}))).status,400);
  const review=async()=> (await (await POST(request({acao:"revisar",id:e.id,atualizadoEm:e.atualizadoEm,remetente:"sender@example.com"}))).json()).email;
  e=await review();assert.equal(e.aprovacaoEnvio.por,"Administrador local");
  process.env.SENDGRID_FROM_EMAIL_SYSNEY="changed@example.com";
  assert.equal((await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm}))).status,400);
  process.env.SENDGRID_FROM_EMAIL_SYSNEY="sender@example.com";
  const copy=(await (await POST(request({acao:"duplicar",id:e.id,atualizadoEm:e.atualizadoEm}))).json()).email;
  assert.equal(copy.aprovacaoEnvio,undefined);
  e=(await (await POST(request({acao:"salvar",email:{...e,centavos:12000}}))).json()).email;
  assert.equal(e.status,"rascunho");assert.equal(e.aprovacaoEnvio,undefined);
  assert.equal((await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm}))).status,400);
});

test("remoção de anexo revoga aprovação, preserva cópias e bloqueia versão antiga ou enviada",async()=>{
 let e=(await (await POST(request({acao:"salvar",email:novoEmail("sysney","Remoção")}))).json()).email;
 const key=`AdminDocumentos:emails-sysney:${e.id}`;
 e={...e,status:"revisado",aprovacaoEnvio:{hash:"old"},anexos:[{tipo:"nota",nome:"nota.pdf",blob:"shared/nota",tamanho:10},{tipo:"boleto",nome:"errado.pdf",blob:"shared/boleto",tamanho:10}]};
 records.get(key).json=JSON.stringify(e);
 const copy=(await (await POST(request({acao:"duplicar",id:e.id,atualizadoEm:e.atualizadoEm}))).json()).email;
 const action={acao:"remover-anexo",id:e.id,atualizadoEm:e.atualizadoEm,tipo:"boleto"};
 assert.equal((await POST(request({...action,atualizadoEm:"stale"}))).status,400);
 assert.equal((await POST(request({...action,tipo:"outro"}))).status,400);
 assert.equal((await POST(request(action,"drsoft"))).status,503);
 e=(await (await POST(request(action))).json()).email;
 assert.equal(e.status,"rascunho");assert.equal(e.aprovacaoEnvio,undefined);
 assert.deepEqual(e.anexos.map(a=>a.tipo),["nota"]);
 assert.equal(JSON.parse(records.get(`AdminDocumentos:emails-sysney:${copy.id}`).json).anexos.length,2);
 assert.equal((await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm}))).status,400);
 records.get(key).json=JSON.stringify({...e,status:"aceito"});
 assert.equal((await POST(request({...action,atualizadoEm:e.atualizadoEm,tipo:"nota"}))).status,400);
});

test("fila reutiliza rascunho, revoga aprovação antiga e exige conferência separada sem emitir ou enviar",async()=>{
 const cobrancaId='a'.repeat(64)+'_2026-09';
 const c={id:cobrancaId,competencia:"2026-09",vencimento:"2026-11-08",centavos:10000,clienteNome:"Teste fila",email:"cliente@example.com",nota:"50",boleto:"123"};
 records.set(`AdminDocumentos:cobrancas-sysney:${cobrancaId}`,{json:JSON.stringify(c),etag:'1'});
 let e=(await (await POST(request({acao:"salvar",email:{...novoEmail("sysney",c.clienteNome),competencia:c.competencia,vencimento:c.vencimento,centavos:c.centavos,para:c.email,responderPara:"financeiro@example.com"}}))).json()).email;
 const key=`AdminDocumentos:emails-sysney:${e.id}`;
 records.get(key).json=JSON.stringify({...e,status:"revisado",aprovacaoEnvio:{hash:"anterior"},anexos:[{tipo:"nota",nome:"nota.pdf",blob:"nota",tamanho:10},{tipo:"boleto",nome:"boleto.pdf",blob:"boleto",tamanho:10}]});
 const preparar={acao:"preparar-cobranca",cobrancaId,emailId:e.id};
 e=(await (await POST(request(preparar))).json()).email;
 assert.equal(e.status,"rascunho");assert.equal(e.aprovacaoEnvio,undefined);assert.equal(e.fluxo.documentos,undefined);
 assert.equal((await (await POST(request(preparar))).json()).email.id,e.id);
 assert.equal((await POST(request(preparar,"drsoft"))).status,503);
 assert.equal((await POST(request({acao:"revisar",id:e.id,atualizadoEm:e.atualizadoEm,remetente:"sender@example.com"}))).status,400);
 assert.equal((await POST(request({acao:"salvar",email:{...e,centavos:5}}))).status,400);
 e=(await (await POST(request({acao:"conferir-documentos",id:e.id,atualizadoEm:e.atualizadoEm}))).json()).email;
 assert.equal(e.fluxo.documentos.por,"Administrador local");assert.equal(e.status,"rascunho");assert.equal(e.tentativas.length,0);
 e=(await (await POST(request({acao:"revisar",id:e.id,atualizadoEm:e.atualizadoEm,remetente:"sender@example.com"}))).json()).email;
 assert.equal(e.status,"revisado");assert.equal(e.tentativas.length,0);
 e=(await (await POST(request({acao:"remover-anexo",id:e.id,atualizadoEm:e.atualizadoEm,tipo:"boleto"}))).json()).email;
 assert.equal(e.fluxo.documentos,undefined);assert.equal(e.aprovacaoEnvio,undefined);
});

test("fila prepara previsão sem documentos e não aceita conferência fictícia",async()=>{
 const planoId='b'.repeat(64),cobrancaId=planoId+'_2026-10';
 const p={id:planoId,inicio:"2026-10",clienteNome:"Recorrente",email:"cliente@example.com",descricao:"Serviço",centavos:10000,diaEnvio:1,mesEnvio:1,diaVencimento:8,mesVencimento:2};
 records.set(`AdminConfiguracoes:cobrancas-sysney:${planoId}`,{json:JSON.stringify(p),etag:'1'});
 const r=await POST(request({acao:"preparar-cobranca",cobrancaId}));assert.equal(r.status,200);
 const e=(await r.json()).email;assert.equal(e.vencimento,"2026-12-08");assert.equal(e.anexos.length,0);assert.equal(e.fluxo.documentos,undefined);
 assert.equal((await (await POST(request({acao:"preparar-cobranca",cobrancaId}))).json()).email.id,e.id);
 assert.notEqual((await POST(request({acao:"conferir-documentos",id:e.id,atualizadoEm:e.atualizadoEm}))).status,200);
 const saved=(await (await POST(request({acao:"salvar",email:{...e,fluxo:{documentos:{hash:"fake"}},assunto:"Editado"}}))).json()).email;
 assert.equal(saved.fluxo.cobrancaId,cobrancaId);assert.equal(saved.fluxo.documentos,undefined);
});

test("hash muda com PDF, logo, destinatários e remetente",async()=>{
  const {assinaturaEnvio}=await import(approvalModel);
  const e=novoEmail("sysney","Teste");const hash=assinaturaEnvio(e,"a@example.com","logo",["pdf"]);
  assert.notEqual(hash,assinaturaEnvio(e,"a@example.com","logo",["outro-pdf"]));
  assert.notEqual(hash,assinaturaEnvio(e,"a@example.com","outro-logo",["pdf"]));
  assert.notEqual(hash,assinaturaEnvio({...e,para:"outro@example.com"},"a@example.com","logo",["pdf"]));
  assert.notEqual(hash,assinaturaEnvio(e,"b@example.com","logo",["pdf"]));
});
