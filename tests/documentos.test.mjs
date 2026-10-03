import {readFileSync} from "node:fs";
import {test} from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const compile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=uri(compile("../lib/cobrancas.ts"));
const emailModel=uri(compile("../lib/emails-cobranca.ts").replaceAll('"./cobrancas"',JSON.stringify(model)));
const boletoModel=uri(compile("../lib/boleto-painel.ts").replaceAll('"./cobrancas"',JSON.stringify(model)));
const {novoEmail,htmlEmail,resolverTextoEmail,validarModeloEmail,valorDigitado,valorFormatado}=await import(emailModel);
const {montarPayloadBoleto}=await import(boletoModel);
const db=uri(`export const records=new Map();export class TableClient {
 constructor(url,name){this.name=name} key(p,r){return this.name+':'+p+':'+r}
 async getEntity(p,r){const e=records.get(this.key(p,r));if(!e)throw Object.assign(new Error('Missing'),{statusCode:404});return structuredClone(e)}
 async createEntity(e){const k=this.key(e.partitionKey,e.rowKey);if(records.has(k))throw Object.assign(new Error('Conflict'),{statusCode:409});records.set(k,{...e,etag:'1'})}
 async updateEntity(e,mode,o){const k=this.key(e.partitionKey,e.rowKey),old=records.get(k);if(!old||old.etag!==o.etag)throw Object.assign(new Error('Conflict'),{statusCode:412});records.set(k,{...(mode==='Merge'?old:{}),...e,etag:String(Number(o.etag)+1)})}
}`);
const bank=uri(`import {records} from ${JSON.stringify(db)};import {createHash} from 'node:crypto';
 export const state={posts:0,fail:'',duplicate:false,payload:null,pdf:true};
 const pagador={cpfCnpj:'12345678000199',tipoPessoa:'JURIDICA',nome:'Cliente teste',endereco:'Rua Teste',cidade:'São Paulo',uf:'SP',cep:'01000000'};
 export async function listarCobrancasInter(){return [{cobranca:{pagador,codigoSolicitacao:'anterior',dataEmissao:'2026-09-01',dataVencimento:state.duplicate?'2030-11-03':'2026-09-03',situacao:'A_RECEBER'}}]}
 export async function consultarCobrancaInter(emp,codigo,pdf){if(pdf)return {pdf:state.pdf?Buffer.from('%PDF-teste').toString('base64'):''};return codigo==='anterior'?{cobranca:{pagador,multa:{codigo:'PERCENTUAL',taxa:2},mora:{codigo:'TAXAMENSAL',taxa:1},descontos:[]}}:{cobranca:{...state.payload,situacao:'A_RECEBER'},boleto:{nossoNumero:'123456'}}}
 export async function emitirCobrancaInter({empresa,competencia,payload,autorizacaoPainel}){if(!autorizacaoPainel)throw Error('not authorized');if(state.fail==='before')throw Error('auth');state.posts++;state.payload=payload;const key=createHash('sha256').update(payload.pagador.cpfCnpj+':'+competencia).digest('hex');records.set('AdminDocumentos:inter-emissoes-'+empresa+':'+key,{json:JSON.stringify(payload),status:'solicitada',...(state.fail==='after'?{}:{codigoSolicitacao:'nova'}),etag:'1'});if(state.fail==='after')throw Error('timeout');return {codigoSolicitacao:'nova'}}`);
let source=compile("../app/api/admin/documentos/route.ts");
for(const [name,target] of Object.entries({
 "next/server":uri("export const NextResponse={json:(d,o)=>Response.json(d,o)}"),
 "@azure/data-tables":db,"@azure/identity":uri("export class DefaultAzureCredential {}"),
 "@azure/storage-blob":uri("export class BlobServiceClient {getContainerClient(){return {getBlockBlobClient:()=>({uploadData:async()=>{}})}}}"),
 "../_auth":uri("export const usuarioAdministrador=r=>r.headers.get('x-test')==='yes'"),"../_remote":uri("export const encaminharAdmin=async()=>null"),
 "@/lib/cobrancas":model,"@/lib/boleto-painel":boletoModel,"@/admin-api/src/services/inter.js":bank,
}))source=source.replaceAll(JSON.stringify(name),JSON.stringify(target));
const {GET,POST}=await import(uri(source)),{records}=await import(db),{state}=await import(bank);
process.env.ADMIN_STORAGE_ACCOUNT="test";
const id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",planoId="b".repeat(64),cobrancaId=planoId+"_2026-10";
function setup(){records.clear();Object.assign(state,{posts:0,fail:"",duplicate:false,pdf:true});
 const e={...novoEmail("sysney","Teste"),id,centavos:331497,competencia:"2026-10",vencimento:"2030-11-03",descricao:"Serviço",po:"069825",atualizadoEm:"v1",fluxo:{cobrancaId,nota:"",boleto:""}};
 records.set(`AdminDocumentos:emails-sysney:${id}`,{json:JSON.stringify(e),etag:"1"});
 records.set(`AdminConfiguracoes:cobrancas-sysney:${planoId}`,{json:JSON.stringify({id:planoId,documento:"12345678000199"}),etag:"1"});
 records.set(`AdminDocumentos:cobrancas-sysney:${cobrancaId}`,{json:JSON.stringify({id:cobrancaId,competencia:e.competencia,centavos:e.centavos,vencimento:e.vencimento,eventos:[],boleto:""}),etag:"1"});
 records.set("AdminConfiguracoes:emissao-boleto:sysney",{ativo:true,etag:"1"});return e;
}
function req(body,emp="sysney",headers={}){const url=new URL(`http://localhost:3100/api/admin/documentos?empresa=${emp}`);const r=new Request(url,{method:body?"POST":"GET",headers:{origin:url.origin,"x-test":"yes",...headers},body:body?JSON.stringify(body):undefined});r.nextUrl=url;return r;}
async function preparar(e){const r=await POST(req({acao:"preparar-boleto",id,atualizadoEm:e.atualizadoEm}));assert.equal(r.status,200);return (await r.json()).previa;}
const emitir=(e,p)=>({acao:"emitir-boleto",id,atualizadoEm:e.atualizadoEm,previaId:p.id,aprovado:true});
test("campos monetários, PO e variáveis preservam valores, escapes e textos antigos",()=>{
 const e={...novoEmail("sysney"),competencia:"2026-10",contato:"Marcelo",po:"069825"};
 assert.match(resolverTextoEmail(e.assunto,e),/Outubro\/2026/);
 assert.match(resolverTextoEmail(e.assunto,{...e,competencia:"2026-11"}),/Novembro\/2026/);
 assert.match(resolverTextoEmail(e.saudacao,{...e,contato:"Maria"}),/Maria/);
 assert.equal(resolverTextoEmail("Olá, Dennis",e),"Olá, Dennis");
 assert.match(htmlEmail({...e,po:'<script>x</script>'}),/Pedido de compra \(PO\)/);
 assert.ok(!htmlEmail({...e,po:'<script>x</script>',contato:'<img>'}).includes('<script>'));
 assert.throws(()=>validarModeloEmail({...e,assunto:"{{inexistente}}"}));
 assert.equal(valorFormatado(331497),"3.314,97");assert.equal(valorDigitado("3.314,97"),331497);
 assert.equal(valorDigitado("R$ 0,01"),1);assert.equal(valorDigitado(""),0);assert.equal(valorDigitado("-12"),null);assert.equal(valorDigitado("1e9"),null);
});
test("boleto revisado exige autorização, trava concorrência e recupera PDF sem reemitir",async()=>{
 const e=setup();assert.equal((await GET(req(null,"sysney",{"x-test":"no"}))).status,401);
 assert.equal((await POST(req({acao:"preparar-boleto",id},"sysney",{origin:"https://outro"}))).status,403);
 assert.equal((await (await GET(req(null))).json()).nfseDisponivel,false);
 assert.equal((await POST(req({acao:"preparar-boleto",id},"drsoft"))).status,400);
 const p=await preparar(e);assert.equal(state.posts,0);assert.ok(Object.values(p.payload.mensagem).join('').includes('PO 069825'));
 assert.equal((await POST(req({...emitir(e,p),aprovado:false}))).status,400);
 const resultados=await Promise.all([POST(req(emitir(e,p))),POST(req(emitir(e,p)))]);
 assert.equal(state.posts,1);assert.ok(resultados.some(r=>r.status===409||r.status===400));
 state.pdf=false;assert.equal((await POST(req({acao:"consultar-boleto",id}))).status,400);assert.equal(state.posts,1);
 state.pdf=true;const r=await POST(req({acao:"consultar-boleto",id}));assert.equal(r.status,200);
 const pronto=(await r.json()).email;assert.equal(pronto.fluxo.boleto,"123456");assert.equal(pronto.anexos.length,1);assert.equal(pronto.status,"rascunho");assert.equal(pronto.tentativas.length,0);assert.equal(pronto.aprovacaoEnvio,undefined);
 assert.equal((await POST(req({acao:"preparar-boleto",id,atualizadoEm:pronto.atualizadoEm}))).status,400);assert.equal(state.posts,1);
});
test("falhas pré-transmissão permitem revisão; resultado incerto nunca repete POST",async()=>{
 let e=setup(),p=await preparar(e);state.fail="before";
 let r=await POST(req(emitir(e,p)));e=(await r.json()).email;assert.equal(e.status,"rascunho");assert.equal(state.posts,0);
 p=await preparar(e);state.fail="after";r=await POST(req(emitir(e,p)));e=(await r.json()).email;assert.equal(e.status,"emitindo_documento");assert.equal(state.posts,1);
 assert.equal((await POST(req({acao:"consultar-boleto",id}))).status,400);
 assert.equal((await POST(req(emitir(e,p)))).status,400);assert.equal(state.posts,1);
});
test("prévia alterada, duplicidade e condições desconhecidas bloqueiam emissão",async()=>{
 const e=setup(),p=await preparar(e);const row=records.get(`AdminDocumentos:emails-sysney:${id}`);row.json=JSON.stringify({...e,po:"999"});
 assert.equal((await POST(req(emitir(e,p)))).status,400);assert.equal(state.posts,0);
 setup();state.duplicate=true;assert.equal((await POST(req({acao:"preparar-boleto",id,atualizadoEm:"v1"}))).status,400);
 const c={id:cobrancaId,centavos:e.centavos,competencia:e.competencia,vencimento:e.vencimento};
 assert.throws(()=>montarPayloadBoleto(e,c,"12345678000199",{},{}));
});
