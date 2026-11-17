import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const uri = s => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const compile = p => ts.transpileModule(readFileSync(new URL(p,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=uri(compile("../lib/cobrancas.ts"));
const emailModel=uri(compile("../lib/emails-cobranca.ts").replaceAll('"./cobrancas"',JSON.stringify(model)));
const approvalModel=uri(compile("../lib/aprovacao-envio.ts").replaceAll('"./emails-cobranca"',JSON.stringify(emailModel)));
const avisoModel=uri(compile("../lib/avisos-cobranca.ts").replaceAll('"./cobrancas"',JSON.stringify(model)));
const {novoEmail,htmlEmail,validarDocumentosEmail}=await import(emailModel);
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
  "@azure/storage-blob":uri("export class BlobServiceClient {getContainerClient(){return {getBlockBlobClient:()=>({downloadToBuffer:async()=>Buffer.from('%PDF-test'),uploadData:async()=>{}})}}}"),
  "../_auth":uri("export const usuarioAdministrador=r=>r.headers.get('x-test-auth')==='yes'"),
  "../_remote":uri("export const encaminharAdmin=async()=>null"),
  "@/lib/emails-cobranca":emailModel,
  "@/lib/cobrancas":model,
  "@/lib/aprovacao-envio":approvalModel,
  "@/lib/avisos-cobranca":avisoModel,
}))source=source.replaceAll(JSON.stringify(name),JSON.stringify(target));
const {GET,POST}=await import(uri(source)); const {records}=await import(db);

test("resumo financeiro exige administrador e não expõe HTML, destinatários ou configuração de envio", async () => {
  const draft = { ...novoEmail("sysney", "Resumo"), para: "cliente@example.com", competencia: "2026-10", centavos: 10000, vencimento: "2026-11-03" };
  const e = (await (await POST(request({ acao: "salvar", email: draft }))).json()).email;
  const req = request(null); req.nextUrl.searchParams.set("resumo", "financeiro");
  const result = await (await GET(req)).json();
  const row = result.emails.find(r => r.id === e.id);
  assert.equal(row.centavos, 10000); assert.equal(row.para, undefined); assert.equal(row.assunto, undefined); assert.equal(row.anexos, undefined);
  assert.equal(result.remetente, undefined); assert.equal(result.auditoria, undefined);
  const anon = request(null, "sysney", { "x-test-auth": "no" }); anon.nextUrl.searchParams.set("resumo", "financeiro");
  assert.equal((await GET(anon)).status, 401);
});
process.env.ADMIN_STORAGE_ACCOUNT="test";
test("desconto é validado no servidor antes de salvar",async()=>{
 const base={...novoEmail("drsoft","Teste"),centavos:350000,descontoCentavos:25000,descontoMotivo:"Condição comercial aprovada"};
 const ok=await POST(request({acao:"salvar",email:base},"drsoft"));
 assert.equal(ok.status,200);const salvo=(await ok.json()).email;
 assert.equal(salvo.centavos,350000);assert.equal(salvo.descontoCentavos,25000);
 for(const patch of [{descontoCentavos:-1},{descontoCentavos:0.5},{descontoMotivo:""}])assert.equal((await POST(request({acao:"salvar",email:{...base,...patch}},"drsoft"))).status,400);
 records.delete(`AdminDocumentos:emails-drsoft:${salvo.id}`);
});
process.env.SENDGRID_API_KEY="test-key";
process.env.SENDGRID_FROM_EMAIL="sender@example.com";
process.env.SENDGRID_FROM_EMAIL_SYSNEY="sender@example.com";
process.env.SENDGRID_FROM_EMAIL_DRSOFT="drsoft@example.com";
function request(body,empresa="sysney",headers={}){const url=new URL(`http://localhost:3100/api/admin/emails?empresa=${empresa}`);const r=new Request(url,{method:body?"POST":"GET",headers:{origin:url.origin,"x-test-auth":"yes",...headers},body:body?JSON.stringify(body):undefined});r.nextUrl=url;return r;}

test("aviso reutiliza documentos, bloqueia quitação e repetição, envia somente com BCC de auditoria",async()=>{
 const planoId="9".repeat(64),cobrancaId=`${planoId}_2026-01`,origemId="99999999-9999-4999-8999-999999999999";
 const c={id:cobrancaId,planoId,competencia:"2026-01",vencimento:"2026-02-10",centavos:350000,clienteNome:"Cliente aviso",email:"cliente@example.com",descricao:"Suporte",nota:"99",boleto:"999",eventos:[{id:"p1",tipo:"pagamento",centavos:210000}],persistida:true};
 const origem={...novoEmail("drsoft",c.clienteNome),id:origemId,para:c.email,responderPara:"financeiro@example.com",competencia:c.competencia,centavos:c.centavos,vencimento:c.vencimento,status:"aceito",fluxo:{cobrancaId,nota:c.nota,boleto:c.boleto},tentativas:[{status:"aceito",em:new Date().toISOString()}],anexos:[{tipo:"nota",nome:"nota.pdf",blob:"test/nota",tamanho:10},{tipo:"boleto",nome:"boleto.pdf",blob:"test/boleto",tamanho:10}]};
 const ck=`AdminDocumentos:cobrancas-drsoft:${cobrancaId}`,ok=`AdminDocumentos:emails-drsoft:${origemId}`;
 records.set(ck,{json:JSON.stringify(c),etag:"1"});records.set(ok,{json:JSON.stringify(origem),etag:"1"});
 let e;const originalFetch=globalThis.fetch;let sends=0;
 const prepare=()=>POST(request({acao:"preparar-aviso",cobrancaId,origemId,tipo:"atraso"},"drsoft"));
 try{
  const prepared=await prepare();assert.equal(prepared.status,200);e=(await prepared.json()).email;
  assert.equal(e.aviso.saldoCentavos,140000);assert.equal(e.fluxo,undefined);assert.deepEqual(e.anexos,origem.anexos);
  assert.equal((await (await prepare()).json()).email.id,e.id);
  const reviewed=await POST(request({acao:"revisar",id:e.id,atualizadoEm:e.atualizadoEm,remetente:"drsoft@example.com",auditoria:"drsoft.log@gmail.com"},"drsoft"));
  assert.equal(reviewed.status,200);e=(await reviewed.json()).email;
  globalThis.fetch=async(url,options)=>{assert.equal(url,"https://api.sendgrid.com/v3/mail/send");const mail=JSON.parse(options.body);assert.deepEqual(mail.personalizations[0].bcc,[{email:"drsoft.log@gmail.com"}]);assert.equal(mail.attachments.length,3);sends++;return new Response(null,{status:202});};
  records.get(ck).json=JSON.stringify({...c,eventos:[...c.eventos,{id:"p2",tipo:"pagamento",centavos:140000}]});
  assert.equal((await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm},"drsoft"))).status,400);assert.equal(sends,0);
  records.get(ck).json=JSON.stringify(c);
  assert.equal((await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm},"drsoft"))).status,200);assert.equal(sends,1);
  assert.equal((await prepare()).status,400);assert.equal(records.get(ok).json,JSON.stringify(origem));assert.equal(records.get(ck).json,JSON.stringify(c));
 }finally{globalThis.fetch=originalFetch;records.delete(ck);records.delete(ok);if(e)records.delete(`AdminDocumentos:emails-drsoft:${e.id}`);}
});

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

test("documentos externos são registrados separadamente sem emitir, substituir ou liberar envio",async()=>{
 const planoId='c'.repeat(64),cobrancaId=planoId+'_2026-10';
 records.set(`AdminConfiguracoes:cobrancas-drsoft:${planoId}`,{json:JSON.stringify({id:planoId,inicio:"2026-10",clienteNome:"Teste manual",email:"cliente@example.com",descricao:"Serviço",centavos:10000,diaEnvio:1,mesEnvio:1,diaVencimento:8,mesVencimento:2}),etag:'1'});
 let e=(await (await POST(request({acao:"preparar-cobranca",cobrancaId},"drsoft"))).json()).email;
 const registrar=async(tipo,numero)=>POST(request({acao:"registrar-documento-manual",id:e.id,atualizadoEm:e.atualizadoEm,tipo,numero},"drsoft"));
 e=(await (await registrar("boleto","externo-123")).json()).email;
 assert.equal(e.fluxo.boleto,"externo-123");assert.equal(e.fluxo.nota,"");assert.equal(e.fluxo.documentos,undefined);assert.equal(e.tentativas.length,0);
 const key=`AdminDocumentos:cobrancas-drsoft:${cobrancaId}`;
 assert.equal(JSON.parse(records.get(key).json).eventos.length,1);
 e=(await (await registrar("boleto","externo-123")).json()).email;
 assert.equal(JSON.parse(records.get(key).json).eventos.length,1);
 assert.equal((await registrar("boleto","outro-456")).status,400);
 assert.equal((await POST(request({acao:"revisar",id:e.id,atualizadoEm:e.atualizadoEm,remetente:"drsoft@example.com"},"drsoft"))).status,400);
 e=(await (await registrar("nota","100")).json()).email;
 assert.equal(e.fluxo.nota,"100");assert.equal(JSON.parse(records.get(key).json).eventos.length,2);assert.equal(e.aprovacaoEnvio,undefined);
 assert.equal((await POST(request({acao:"conferir-documentos",id:e.id,atualizadoEm:e.atualizadoEm},"drsoft"))).status,400);
});

test("hash muda com PDF, logo, destinatários e remetente",async()=>{
  const {assinaturaEnvio}=await import(approvalModel);
  const e=novoEmail("sysney","Teste");const hash=assinaturaEnvio(e,"a@example.com","logo",["pdf"]);
  assert.notEqual(hash,assinaturaEnvio(e,"a@example.com","logo",["outro-pdf"]));
  assert.notEqual(hash,assinaturaEnvio(e,"a@example.com","outro-logo",["pdf"]));
  assert.notEqual(hash,assinaturaEnvio({...e,para:"outro@example.com"},"a@example.com","logo",["pdf"]));
  assert.notEqual(hash,assinaturaEnvio(e,"b@example.com","logo",["pdf"]));
  assert.notEqual(hash,assinaturaEnvio(e,"a@example.com","logo",["pdf"],"audit@example.com"));
});

test("auditoria é aplicada no servidor, exige revisão e fica registrada sem expor no HTML",async()=>{
 const configKey="AdminConfiguracoes:email-auditoria:padrao";
 records.set(configKey,{email:"audit@example.com",etag:"1"});
 const original=globalThis.fetch;
 try {
  assert.equal((await (await GET(request(null))).json()).auditoria,"audit@example.com");
  for (const para of ["cliente@example.com","audit@example.com"]) {
   let e=(await (await POST(request({acao:"salvar",email:{...novoEmail("sysney","Auditoria"),para,responderPara:"financeiro@example.com",competencia:"2026-10",vencimento:"2026-11-08",centavos:10000}}))).json()).email;
   e.anexos=[{tipo:"nota",nome:"nota.pdf",blob:"nota",tamanho:10},{tipo:"boleto",nome:"boleto.pdf",blob:"boleto",tamanho:10}];
   records.get(`AdminDocumentos:emails-sysney:${e.id}`).json=JSON.stringify(e);
   const review={acao:"revisar",id:e.id,atualizadoEm:e.atualizadoEm,remetente:"sender@example.com"};
   assert.equal((await POST(request(review))).status,400);
   e=(await (await POST(request({...review,auditoria:"audit@example.com"}))).json()).email;
   records.set(configKey,{email:"changed@example.com",etag:"2"});
   assert.equal((await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm}))).status,400);
   records.set(configKey,{email:"audit@example.com",etag:"3"});
   globalThis.fetch=async(_,options)=>{
    const p=JSON.parse(options.body);
    assert.deepEqual(p.personalizations[0].bcc,para === "audit@example.com" ? undefined : [{email:"audit@example.com"}]);
    assert.ok(!p.content[0].value.includes("audit@example.com"));
    return new Response(null,{status:202});
   };
   e=(await (await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm}))).json()).email;
   assert.equal(e.status,"aceito");assert.equal(e.tentativas[0].bcc,para === "audit@example.com" ? "" : "audit@example.com");
  }
 } finally {globalThis.fetch=original;records.delete(configKey);}
});

test("PIX exige nota e OS, aceita upload/remoção da OS e revoga aprovação ao alterar a chave",async()=>{
 const planoId='f'.repeat(64),cobrancaId=planoId+'_2026-10';
 const c={id:cobrancaId,planoId,competencia:"2026-10",vencimento:"2026-10-09",centavos:709755,clienteNome:"IAGA teste",email:"cliente@example.com",descricao:"Serviços prestados",nota:"52",boleto:""};
 records.set(`AdminDocumentos:cobrancas-sysney:${cobrancaId}`,{json:JSON.stringify(c),etag:'1'});
 records.set(`AdminConfiguracoes:cobrancas-sysney:${planoId}`,{json:JSON.stringify({documento:"57569436000113"}),etag:'1'});
 let e=(await (await POST(request({acao:"preparar-cobranca",cobrancaId}))).json()).email;
 e=(await (await POST(request({acao:"salvar",email:{...e,formaPagamento:"pix",pixChave:"57.767.099/0001-79",pixBeneficiario:"SYSNEY"}}))).json()).email;
 assert.equal(e.formaPagamento,"pix");
 const key=`AdminDocumentos:emails-sysney:${e.id}`;
 e.anexos=[{tipo:"nota",nome:"nota.pdf",blob:"nota",tamanho:10}];
 records.get(key).json=JSON.stringify(e);
 assert.throws(()=>validarDocumentosEmail(e),/ordem de serviço/);
 const form=new FormData();form.set("id",e.id);form.set("tipo","ordem-servico");form.set("arquivo",new File(["%PDF-test"],"OS.pdf",{type:"application/pdf"}));
 const url=new URL("http://localhost:3100/api/admin/emails?empresa=sysney");
 const upload=new Request(url,{method:"POST",headers:{origin:url.origin,"x-test-auth":"yes"},body:form});upload.nextUrl=url;
 const ur=await POST(upload);assert.equal(ur.status,200);
 e=(await ur.json()).email;assert.deepEqual(e.anexos.map(a=>a.tipo),["nota","ordem-servico"]);
 const conferir=()=>POST(request({acao:"conferir-documentos",id:e.id,atualizadoEm:e.atualizadoEm}));
 e=(await (await conferir()).json()).email;assert.ok(e.fluxo.documentos);
 e=(await (await POST(request({acao:"revisar",id:e.id,atualizadoEm:e.atualizadoEm,remetente:"sender@example.com"}))).json()).email;
 assert.equal(e.status,"revisado");assert.equal(e.tentativas.length,0);
 assert.ok(htmlEmail(e).includes("Chave PIX"));assert.ok(htmlEmail(e).includes("SYSNEY"));
 const originalFetch=globalThis.fetch;
 try {
  globalThis.fetch=async(_,options)=>{const p=JSON.parse(options.body);assert.deepEqual(p.attachments.filter(a=>a.disposition==="attachment").map(a=>a.filename),["nota.pdf","OS.pdf"]);assert.ok(p.content[0].value.includes("Chave PIX"));return new Response(null,{status:202});};
  const enviado=(await (await POST(request({acao:"enviar",id:e.id,atualizadoEm:e.atualizadoEm}))).json()).email;
  assert.equal(enviado.status,"aceito");assert.equal(enviado.tentativas.length,1);
 } finally {globalThis.fetch=originalFetch;records.get(key).json=JSON.stringify(e);}
 const oldHash=e.aprovacaoEnvio.hash;
 const {assinaturaEnvio}=await import(approvalModel);
 assert.notEqual(oldHash,assinaturaEnvio({...e,pixChave:"outra-chave"},"sender@example.com","logo",["pdf"]));
 e=(await (await POST(request({acao:"salvar",email:{...e,pixChave:"outra-chave"}}))).json()).email;
 assert.equal(e.fluxo.documentos,undefined);assert.equal(e.aprovacaoEnvio,undefined);
 e=(await (await POST(request({acao:"remover-anexo",id:e.id,atualizadoEm:e.atualizadoEm,tipo:"ordem-servico"}))).json()).email;
 assert.deepEqual(e.anexos.map(a=>a.tipo),["nota"]);
 assert.equal((await conferir()).status,400);
 assert.throws(()=>validarDocumentosEmail({...e,pixChave:""}),/chave/);
 assert.throws(()=>validarDocumentosEmail({...e,anexos:[...e.anexos,{tipo:"boleto"}]}),/boleto/);
 const {createHash}=await import("node:crypto");
 const bankKey=createHash("sha256").update("57569436000113:2026-10").digest("hex");
 records.set(`AdminDocumentos:inter-emissoes-sysney:${bankKey}`,{status:"incerto",etag:"1"});
 assert.equal((await POST(request({acao:"salvar",email:e}))).status,400);
 records.delete(`AdminDocumentos:inter-emissoes-sysney:${bankKey}`);
});

test('depósito apresenta banco e conta por empresa, sem exigir boleto nem tratar como PIX',async()=>{
 const {contaDepositoPadrao,validarPagamento,documentosCompletos}=await import(emailModel);
 for(const empresa of ['sysney','drsoft']){
  const dados={...contaDepositoPadrao(empresa),conta:empresa==='sysney'?'39764172-9':'9439596-9'};
  const e={...novoEmail(empresa,'Cliente teste'),formaPagamento:'deposito',dadosDeposito:dados,competencia:'2026-11',vencimento:'2026-12-18',centavos:3553147,anexos:[{tipo:'nota',nome:'nota.pdf',blob:'privado',tamanho:100}]};
  assert.doesNotThrow(()=>validarPagamento(e));assert.equal(documentosCompletos(e),true);
  const html=htmlEmail(e);for(const valor of ['Depósito/Transferência','077 - Inter','0001',dados.conta,dados.cnpj,dados.razaoSocial])assert.ok(html.includes(valor),valor);
  assert.doesNotMatch(html,/Chave PIX/);assert.throws(()=>validarPagamento({...e,dadosDeposito:{...dados,conta:''}}));
  assert.throws(()=>validarPagamento({...e,dadosDeposito:{...dados,cnpj:empresa==='sysney'?'09.365.785/0001-70':'57.767.099/0001-79'}}),/empresa/);
  assert.throws(()=>validarPagamento({...e,fluxo:{boleto:'existente'}}),/boleto/);
  assert.throws(()=>validarDocumentosEmail({...e,anexos:[]}),/nota fiscal/);
  const htmlEscapado=htmlEmail({...e,dadosDeposito:{...dados,razaoSocial:'<script>erro</script>'}});assert.ok(htmlEscapado.includes('&lt;script&gt;'));assert.doesNotMatch(htmlEscapado,/<script>/);
 }
});

test('alterar conta de depósito revoga conferência e aprovação; aviso preserva sua conta',async()=>{
 const {contaDepositoPadrao}=await import(emailModel),pid='d'.repeat(64),cid=pid+'_2026-11';
 const c={id:cid,planoId:pid,competencia:'2026-11',clienteNome:'Depósito teste',email:'cliente@example.com',descricao:'Serviço',centavos:10000,vencimento:'2030-12-18',nota:'6',boleto:'',eventos:[]};
 records.set(`AdminDocumentos:cobrancas-sysney:${cid}`,{json:JSON.stringify(c),etag:'1'});
 records.set(`AdminConfiguracoes:cobrancas-sysney:${pid}`,{json:JSON.stringify({documento:'11111111111111',avulsa:true}),etag:'1'});
 let e=(await (await POST(request({acao:'preparar-cobranca',cobrancaId:cid}))).json()).email;
 const saved=await POST(request({acao:'salvar',email:{...e,formaPagamento:'deposito',dadosDeposito:contaDepositoPadrao('sysney')}}));assert.equal(saved.status,200);e=(await saved.json()).email;
 const key=`AdminDocumentos:emails-sysney:${e.id}`;e.anexos=[{tipo:'nota',nome:'nota.pdf',blob:'nota',tamanho:100}];records.get(key).json=JSON.stringify(e);
 const checked=await POST(request({acao:'conferir-documentos',id:e.id,atualizadoEm:e.atualizadoEm}));assert.equal(checked.status,200);e=(await checked.json()).email;assert.ok(e.fluxo.documentos);
 e.aprovacaoEnvio={hash:'anterior'};records.get(key).json=JSON.stringify(e);
 const changed=await POST(request({acao:'salvar',email:{...e,dadosDeposito:{...e.dadosDeposito,conta:'12345678-0'}}}));assert.equal(changed.status,200);e=(await changed.json()).email;
 assert.equal(e.fluxo.documentos,undefined);assert.equal(e.aprovacaoEnvio,undefined);assert.equal(e.tentativas.length,0);
 assert.equal((await POST(request({acao:'salvar',email:{...e,dadosDeposito:{...e.dadosDeposito,cnpj:'09.365.785/0001-70'}}}))).status,400);
 const {assinaturaEnvio}=await import(approvalModel);assert.notEqual(assinaturaEnvio(e,'a@example.com','logo',['pdf']),assinaturaEnvio({...e,dadosDeposito:{...e.dadosDeposito,conta:'12345678-1'}},'a@example.com','logo',['pdf']));
 records.delete(key);records.delete(`AdminDocumentos:cobrancas-sysney:${cid}`);records.delete(`AdminConfiguracoes:cobrancas-sysney:${pid}`);
});

test('tentativa bancária de outra PO só é separada com documento, PO, valor e vencimento inequívocos',async()=>{
 const {tentativaBancariaDeOutraPO}=await import(emailModel),e={...novoEmail('sysney'),po:'076458',centavos:3553147,vencimento:'2026-12-18'};
 const p={pagador:{cpfCnpj:'43351097000190'},valorNominal:3314.97,dataVencimento:'2026-12-03',mensagem:{linha1:'Mensalidade. PO 069825.'}};
 const record=v=>({json:JSON.stringify(v)});
 assert.equal(tentativaBancariaDeOutraPO(record(p),e,'43351097000190'),true);
 for(const patch of [{valorNominal:35531.47},{dataVencimento:e.vencimento},{mensagem:{linha1:'PO 076458'}},{mensagem:{}},{pagador:{cpfCnpj:'outro'}}])assert.equal(tentativaBancariaDeOutraPO(record({...p,...patch}),e,'43351097000190'),false);
 assert.equal(tentativaBancariaDeOutraPO({json:'inválido'},e,'43351097000190'),false);
});

test('envio de depósito empacota a conta da empresa e os PDFs sem boleto ou regra PIX',async()=>{
 const {contaDepositoPadrao}=await import(emailModel),originalFetch=globalThis.fetch;
 try{
  for(const empresa of ['sysney','drsoft']){
   const draft={...novoEmail(empresa,'Cliente fictício'),para:'cliente@example.com',responderPara:'financeiro@example.com',competencia:'2026-11',vencimento:'2030-12-18',centavos:10000,formaPagamento:'deposito',dadosDeposito:contaDepositoPadrao(empresa)};
   let e=(await (await POST(request({acao:'salvar',email:draft},empresa))).json()).email;
   const key=`AdminDocumentos:emails-${empresa}:${e.id}`;e.anexos=[{tipo:'nota',nome:'nota-teste.pdf',blob:'preview/nota',tamanho:100}];records.get(key).json=JSON.stringify(e);
   const sender=empresa==='sysney'?'sender@example.com':'drsoft@example.com';
   const review=await POST(request({acao:'revisar',id:e.id,atualizadoEm:e.atualizadoEm,remetente:sender},empresa));assert.equal(review.status,200);e=(await review.json()).email;
   let sends=0;globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.sendgrid.com/v3/mail/send');const p=JSON.parse(options.body);assert.ok(p.content[0].value.includes(draft.dadosDeposito.conta));assert.ok(p.content[0].value.includes('Depósito/Transferência'));assert.ok(!p.content[0].value.includes('Chave PIX'));assert.equal(p.attachments.filter(a=>a.disposition==='attachment').length,1);sends++;return new Response(null,{status:202});};
   const send=await POST(request({acao:'enviar',id:e.id,atualizadoEm:e.atualizadoEm},empresa));assert.equal(send.status,200);e=(await send.json()).email;assert.equal(sends,1);assert.equal(e.status,'aceito');assert.equal(e.tentativas[0].documentoConciliacaoPix,undefined);records.delete(key);
  }
 }finally{globalThis.fetch=originalFetch;}
});
