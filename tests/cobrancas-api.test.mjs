import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const modules = [];
function compile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
function uri(source) { const value = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`; modules.push(value); return value; }
const model = uri(compile("../lib/cobrancas.ts"));
const storage = uri(`
export const records = new Map();
export class TableClient {
  constructor(url, table) { this.table = table; }
  key(p,r) { return this.table + ':' + p + ':' + r; }
  async getEntity(p,r) { const e=records.get(this.key(p,r)); if(!e) throw Object.assign(new Error('missing'),{statusCode:404}); return structuredClone(e); }
  async createEntity(e) { const k=this.key(e.partitionKey,e.rowKey); if(records.has(k)) throw Object.assign(new Error('duplicate'),{statusCode:409}); records.set(k,{...e,etag:'1'}); }
  async updateEntity(e,mode,options) { const k=this.key(e.partitionKey,e.rowKey); const old=records.get(k); if(old.etag!==options.etag) throw Object.assign(new Error('conflict'),{statusCode:412}); records.set(k,{...e,etag:String(Number(old.etag)+1)}); }
  async *listEntities(options) { const part=options.queryOptions.filter.split("'")[1]; for(const [k,e] of records) if(k.startsWith(this.table+':') && e.partitionKey===part) yield structuredClone(e); }
  async submitTransaction(actions) { const snapshot=new Map(records);try{for(const [action,e,mode,options] of actions)await this[action+'Entity'](e,mode,options);}catch(e){records.clear();for(const [k,v]of snapshot)records.set(k,v);throw e;} }
}`);
let route = compile("../app/api/admin/cobrancas/route.ts");
for (const [specifier, target] of Object.entries({
  "next/server": uri("export const NextResponse = { json: (body, options) => Response.json(body,options) };"),
  "@azure/identity": uri("export class DefaultAzureCredential {}"),
  "@azure/data-tables": storage,
  "../_auth": uri("export const usuarioAdministrador = r => r.headers.get('x-test-admin') === 'yes';"),
  "../_remote": uri("export const encaminharAdmin=async()=>null;"),
  "@/lib/cobrancas": model,
  "@/lib/regularizacao-fiscal": uri(compile("../lib/regularizacao-fiscal.ts")),
})) route = route.replaceAll(`"${specifier}"`, JSON.stringify(target));
const { GET, POST } = await import(uri(route));
const { records } = await import(storage);
const { hojeBrasil } = await import(model);
process.env.ADMIN_STORAGE_ACCOUNT = "testaccount";
const hoje = hojeBrasil();
const mes = hoje.slice(0,7);
const client = "a".repeat(64);
records.set(`AdminClientes:sysney:${client}`, { partitionKey:"sysney", rowKey:client, nome:"Cliente teste", documento:"00000000000000" });
function request(body, emp="sysney", options={}) {
  const url = new URL(`http://localhost:3100/api/admin/cobrancas?empresa=${emp}&mes=${mes}`);
  const r = new Request(url, { method:body ? "POST":"GET", headers:{"x-test-admin":"yes",origin:url.origin,...options}, body:body ? JSON.stringify(body):undefined });
  r.nextUrl=url; return r;
}
const plan = {acao:"plano", clienteId:client, email:"teste@example.com", descricao:"Teste",centavos:10000,inicio:mes,fim:"",diaEnvio:1,mesEnvio:0,diaVencimento:28,mesVencimento:0};
test("API: autenticação, isolamento, recorrência, eventos e idempotência", async () => {
  assert.equal((await GET(request(null,"sysney",{"x-test-admin":"no"}))).status,401);
  assert.equal((await POST(request(plan,"sysney",{origin:"https://outro.example"}))).status,403);
  assert.equal((await POST(request({...plan,centavos:-1}))).status,400);
  assert.equal((await POST(request(plan))).status,201);
  assert.equal((await POST(request(plan))).status,409);
  const carteira = await (await GET(request())).json();
  assert.equal(carteira.cobrancas.length,1);
  assert.equal((await (await GET(request(null,"drsoft"))).json()).cobrancas.length,0);
  const id=carteira.cobrancas[0].id;
  const event = (acao, extra={}) => ({id,acao,data:hoje,operacaoId:randomUUID(),...extra});
  assert.equal((await POST(request(event("envio",{detalhe:"E-mail"})))).status,400);
  assert.equal((await POST(request(event("documentos",{nota:"TESTE",boleto:"TESTE",demonstrativo:true})))).status,200);
  const payment=event("pagamento",{centavos:4000,detalhe:"Comprovante de teste"});
  assert.equal((await POST(request(payment))).status,200);
  assert.equal((await POST(request(payment))).status,200);
  assert.equal((await POST(request(event("pagamento",{centavos:7000,detalhe:"Excesso"})))).status,400);
  assert.equal((await POST(request(event("envio",{detalhe:"E-mail manual"})))).status,200);
  assert.equal((await POST(request(event("recebimento",{detalhe:"Cliente confirmou"})))).status,200);
  const estorno=event("estorno",{referencia:payment.operacaoId,detalhe:"Corrigir valor"});
  assert.equal((await POST(request(estorno))).status,200);
  assert.equal((await POST(request({...estorno,operacaoId:randomUUID()}))).status,400);
  const final=await (await GET(request())).json();
  assert.equal(final.cobrancas.length,1);
  assert.equal(final.cobrancas[0].eventos.filter(e=>e.tipo==="pagamento").length,1);
  assert.equal(final.cobrancas[0].persistida,true);
});

test("regularização: segregação, planejamento sem emissão e vínculo fiscal único",async()=>{
 const id="d".repeat(64),id2="e".repeat(64),part="regularizacao-sysney";
 const reg={id,empresa:"sysney",documento:"00000000000000",cliente:"Teste",centavos:10000,recebimento:"2025-02-11",competencia:"",nota:"",notasCandidatas:[],atualizadoEm:"v1"};
 for(const r of [reg,{...reg,id:id2}])records.set(`AdminDocumentos:${part}:${r.id}`,{partitionKey:part,rowKey:r.id,json:JSON.stringify(r),etag:"1"});
 const req=request();req.nextUrl.searchParams.set("regularizacao","1");
 assert.equal((await (await GET(req)).json()).registros.length,2);
 const other=request(null,"drsoft");other.nextUrl.searchParams.set("regularizacao","1");assert.equal((await (await GET(other)).json()).registros.length,0);
 const body={acao:"planejar-regularizacao",id,atualizadoEm:"v1",competencia:"2025-01",evidenciaCompetencia:"Documento de teste",emissaoPlanejada:"",nota:"123"};
 assert.equal((await POST(request(body,"drsoft"))).status,503);
 records.set("AdminDocumentos:nfse-historico-sysney:123",{json:JSON.stringify({documento:reg.documento,centavos:10000,situacao:"C"})});
 assert.equal((await POST(request(body))).status,400);
 records.set("AdminDocumentos:nfse-historico-sysney:123",{json:JSON.stringify({documento:reg.documento,centavos:10000,situacao:"N"})});
 assert.equal((await POST(request(body))).status,200);
 assert.equal((await POST(request({...body,id:id2}))).status,400);
 assert.equal((await POST(request(body))).status,400);
 const loaded=await (await GET(req)).json();assert.equal(loaded.registros.length,2);assert.equal(loaded.registros.find(r=>r.id===id).nota,"123");assert.equal(loaded.registros.find(r=>r.id===id).revisoes.length,1);
 assert.ok(![...records.keys()].some(k=>k.includes("emails-sysney")));
});
test("lote de regularização preserva PIX pago, impede sobreposição e não emite nem envia",async()=>{
 const id="f".repeat(64),part="regularizacao-sysney";
 const reg={id,empresa:"sysney",documento:"00000000000000",cliente:"Teste",descricao:"Suporte ERP",centavos:151156,recebimento:"2025-07-13",vencimentoReferencia:"2025-07-12",competencia:"2025-06",evidenciaCompetencia:"Memória do cliente",emissaoPlanejada:"",nota:"",notasCandidatas:[],atualizadoEm:"lote-v1"};
 records.set(`AdminDocumentos:${part}:${id}`,{partitionKey:part,rowKey:id,json:JSON.stringify(reg),etag:"1"});
 const body={acao:"preparar-lote-regularizacao",recebimentos:[{id,atualizadoEm:reg.atualizadoEm}],percentual:"7,5",origemCenario:"Hipótese, não apuração"};
 assert.equal((await POST(request(body,"sysney",{"x-test-admin":"no"}))).status,401);
 assert.equal((await POST(request(body,"sysney",{origin:"https://externo.example"}))).status,403);
 assert.equal((await POST(request(body,"drsoft"))).status,503);
 assert.equal((await POST(request({...body,percentual:"-1"}))).status,400);
 assert.equal((await POST(request({...body,recebimentos:[{id,atualizadoEm:"antigo"}]}))).status,400);
 const response=await POST(request(body));assert.equal(response.status,201);
 const d=await response.json();assert.equal(d.emissaoExecutada,false);assert.equal(d.emailEnviado,false);
 assert.equal(d.lote.total,151156);assert.equal(d.lote.impostoEstimado,11337);
 assert.equal(d.lote.estado,"aguardando-validacao-fiscal");assert.equal(d.lote.recebimentos[0].status,"pago");
 assert.equal(d.lote.recebimentos[0].competencia,"2025-06");assert.equal(d.lote.recebimentos[0].recebimento,"2025-07-13");
 assert.equal((await POST(request(body))).status,409);
 const id2="1".repeat(64);
 records.set(`AdminDocumentos:${part}:${id2}`,{partitionKey:part,rowKey:id2,json:JSON.stringify({...reg,id:id2}),etag:"1"});
 assert.equal((await POST(request({...body,recebimentos:[{id,atualizadoEm:reg.atualizadoEm},{id:id2,atualizadoEm:reg.atualizadoEm}]}))).status,409);
 assert.ok(!records.has(`AdminDocumentos:${part}:reserva-${id2}`));
 assert.equal((await POST(request({...body,recebimentos:[{id,atualizadoEm:reg.atualizadoEm},{id,atualizadoEm:reg.atualizadoEm}]}))).status,400);
 const req=request();req.nextUrl.searchParams.set("regularizacao","1");
 const loaded=await (await GET(req)).json();assert.equal(loaded.lotes.length,1);
 assert.ok(loaded.registros.every(r=>/^[a-f0-9]{64}$/.test(r.id)));
 assert.equal(JSON.parse(records.get(`AdminDocumentos:${part}:${id}`).json).nota,"");
 assert.ok(![...records.keys()].some(k=>k.includes("emails-sysney")));
});
