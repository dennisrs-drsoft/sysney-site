import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {test} from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const compile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const impostos=uri(compile("../lib/retencoes-fiscais.ts"));
const {calcularRetencoes,taxasPlanilha}=await import(impostos);
const model=uri(compile("../lib/nfse-sp.ts").replaceAll('"./retencoes-fiscais"',JSON.stringify(impostos)));
const {montarXmlSP,montarConsultaSP,cadeiaAssinaturaSP,hashNotaSP,normalizarFiscalSP}=await import(model);
// Dados exclusivamente sintéticos: nenhum certificado ou serviço externo é usado.
const fiscal={regime:"presumido",serie:"SB001",numeroInicial:"1",dataEmissao:"2026-10-03",codigoServico:"02684",aliquota:"2.9",issRetido:false,nbs:"111111111",indicadorOperacao:"100101",classificacaoTributaria:"000001",consumidorFinal:false,municipioPrestacao:"3550308",deducoes:0,pis:0,cofins:0,inss:0,ir:0,csll:0,ipi:0,endereco:{tipo:"R",logradouro:"Rua Teste",numero:"1",bairro:"Centro",municipio:"3550308",uf:"SP",cep:"01000000"}};
const dados={empresa:"drsoft",cnpj:"12345678000199",inscricao:"12345678",clienteDocumento:"98765432000199",clienteNome:"Cliente fictício",competencia:"2026-09",centavos:123456,descricao:"Teste & validação",po:"123",numero:"1",fiscal};
test("assinador verifica RPS com a chave pública do certificado",()=>{
 const script=readFileSync(new URL("../admin-api/scripts/executar-nfse-sp.ps1",import.meta.url),"utf8");
 assert.match(script,/GetRSAPublicKey\(\$cert\)/);
 assert.match(script,/\$publica\.VerifyData/);
 assert.doesNotMatch(script,/\$rsa\.VerifyData/);
 assert.match(script,/finally\{\$publica\.Dispose\(\)\}/);
});
test("RPS v2 assina inscrição com 12 dígitos e valor final; hash cobre fiscal/PO",()=>{
 const cadeia=cadeiaAssinaturaSP(dados);assert.equal(cadeia.length,90);assert.equal(cadeia.slice(0,12),"000012345678");assert.equal(cadeia.slice(12,17),"SB001");assert.equal(cadeia.slice(-14),dados.clienteDocumento);
 assert.notEqual(hashNotaSP(dados),hashNotaSP({...dados,po:"456"}));assert.notEqual(hashNotaSP(dados),hashNotaSP({...dados,fiscal:{...fiscal,nbs:"222222222"}}));
 const xml=montarXmlSP(dados,false);assert.match(xml,/Teste &amp; validação/);assert.match(xml,/<ValorFinalCobrado>1234.56<\/ValorFinalCobrado>/);assert.match(xml,/<AliquotaServicos>0.029000<\/AliquotaServicos>/);assert.ok(!xml.includes("ValorServicos"));assert.match(xml,/PO 123/);
 assert.match(montarConsultaSP(dados),/PedidoConsultaNFe/);
 assert.throws(()=>normalizarFiscalSP({...fiscal,nbs:"03158"}));assert.throws(()=>normalizarFiscalSP({...fiscal,pis:undefined}));assert.throws(()=>normalizarFiscalSP({...fiscal,dataEmissao:"2026-02-30"}));assert.throws(()=>normalizarFiscalSP({...fiscal,aliquota:"99"}));
 assert.throws(()=>hashNotaSP({...dados,fiscal:{...fiscal,municipioPrestacao:"9999999"}}));
});
test("XML gerado satisfaz XSD oficiais v1 e v2 offline, sem certificado e sem emissão",{skip:process.platform!=="win32"},()=>{
 for(const perfil of [{regime:"simples"},{regime:"presumido"},{regime:"presumido",calcularRetencoes:true,taxasRetencao:taxasPlanilha,retencaoPisCofins:"3"}])for(const acao of ["testar","emitir","consultar"]){
  const nota={...dados,fiscal:normalizarFiscalSP({...fiscal,...perfil},dados.centavos)};
  // ValidarSomente não permite executar comunicação nem consultar a chave privada.
  const r=spawnSync("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File","admin-api/scripts/executar-nfse-sp.ps1","-ValidarSomente"],{input:JSON.stringify({acao,cnpj:nota.cnpj,cadeia:cadeiaAssinaturaSP(nota),xml:acao==="consultar"?montarConsultaSP(nota):montarXmlSP(nota,acao==="testar")}),encoding:"utf8",env:{...process.env,NFSE_SP_PRODUCAO_HABILITADA:"true"},timeout:15000,windowsHide:true});
  assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{schemaValido:true,transmitido:false});
 }
});
test("regime não depende da empresa; Simples sem complementos; impostos recalculados sem reduzir total",()=>{
 for(const empresa of ["sysney","drsoft"]){
  const f=normalizarFiscalSP({...fiscal,regime:"simples",nbs:undefined,pis:undefined,aliquota:undefined});
  const n={...dados,empresa,fiscal:f};
  assert.equal(cadeiaAssinaturaSP(n).length,86);
  assert.match(montarXmlSP(n,false),/<ValorServicos>1234.56<\/ValorServicos>/);
  assert.doesNotMatch(montarXmlSP(n,false),/IBSCBS|ValorFinalCobrado|NBS/);
 }
 const calculo=calcularRetencoes(324258,taxasPlanilha);
 assert.deepEqual(calculo,{ir:4864,csll:3243,cofins:9728,pis:2108});
 assert.deepEqual(calcularRetencoes(360000,taxasPlanilha),{ir:5400,csll:3600,cofins:10800,pis:2340});
 const f=normalizarFiscalSP({...fiscal,calcularRetencoes:true,taxasRetencao:taxasPlanilha,retencaoPisCofins:"3"},324258);
 assert.match(montarXmlSP({...dados,empresa:"sysney",centavos:324258,fiscal:f},false),/<ValorFinalCobrado>3242.58<\/ValorFinalCobrado>/);
 assert.throws(()=>hashNotaSP({...dados,centavos:360000,fiscal:f}),/Recalcule/);
 assert.throws(()=>calcularRetencoes(10000,{...taxasPlanilha,ir:"-1"}));
 assert.equal(calcularRetencoes(100,taxasPlanilha).ir,2);
});
const db=uri(`export const records=new Map();export class TableClient{constructor(u,n){this.name=n}key(p,r){return this.name+':'+p+':'+r}async getEntity(p,r){const e=records.get(this.key(p,r));if(!e)throw Object.assign(Error(),{statusCode:404});return structuredClone(e)}async createEntity(e){const k=this.key(e.partitionKey,e.rowKey);if(records.has(k))throw Object.assign(Error(),{statusCode:409});records.set(k,{...e,etag:'1'})}async updateEntity(e,m,o){const k=this.key(e.partitionKey,e.rowKey),old=records.get(k);if(!old||old.etag!==o.etag)throw Object.assign(Error(),{statusCode:412});records.set(k,{...e,etag:String(Number(old.etag)+1)})}}`);
const exec=uri(`export const state={real:0,testes:0,fail:false};export const executorMunicipalDisponivel=()=>true;export async function executarNotaSP(acao,d){if(acao==='emitir'){state.real++;if(state.fail)throw Error('timeout')}if(acao==='testar')state.testes++;return {sucesso:true,erros:[],alertas:[],xml:'<retorno/>',teste:acao==='testar',...(acao==='consultar'?{numero:'10',inscricao:d.inscricao,verificacao:'TEST1234',tomador:d.clienteDocumento,valorFinal:(d.centavos/100).toFixed(2),descricao:d.descricao+(d.po?'\\nPO '+d.po:'')}:{})}}`);
const cobrancas=uri(`export const hojeBrasil=()=> '2026-10-03';export const prevista=(p,competencia)=>({id:p.id+'_'+competencia,competencia,centavos:p.centavos,vencimento:p.vencimento,eventos:[]})`);
let source=compile("../app/api/admin/nfse/route.ts");
for(const [name,target] of Object.entries({"next/server":uri("export const NextResponse={json:(d,o)=>Response.json(d,o)}"),"@azure/data-tables":db,"@azure/identity":uri("export class DefaultAzureCredential {}"),"../_auth":uri("export const usuarioAdministrador=r=>r.headers.get('x-test')==='yes'"),"../_remote":uri("export const encaminharAdmin=async()=>null"),"@/lib/cobrancas":cobrancas,"@/lib/nfse-sp":model,"@/lib/nfse-sp-executor":exec}))source=source.replaceAll(JSON.stringify(name),JSON.stringify(target));
const {GET,POST}=await import(uri(source));const {records}=await import(db);const {state}=await import(exec);
const id="11111111-1111-4111-8111-111111111111",planId="a".repeat(64);
const email={id,empresa:"drsoft",cliente:dados.clienteNome,competencia:dados.competencia,centavos:dados.centavos,descricao:dados.descricao,po:dados.po,vencimento:"2026-10-10",status:"rascunho",atualizadoEm:"v1",anexos:[],fluxo:{cobrancaId:planId+"_"+dados.competencia}};
function setup(){records.clear();records.set("AdminConfiguracoes:nfse-regimes:drsoft",{json:JSON.stringify({historico:[{regime:"presumido",vigencia:"2026-01-01"}]}),etag:"1"});state.real=state.testes=0;state.fail=false;process.env.NFSE_DRSOFT_CNPJ=dados.cnpj;process.env.NFSE_DRSOFT_CCM=dados.inscricao;delete process.env.NFSE_SP_PRODUCAO_HABILITADA;records.set(`AdminDocumentos:emails-drsoft:${id}`,{json:JSON.stringify(email),etag:"1"});records.set(`AdminConfiguracoes:cobrancas-drsoft:${planId}`,{json:JSON.stringify({id:planId,documento:dados.clienteDocumento,inicio:"2026-09",centavos:dados.centavos,vencimento:"2026-10-10"}),etag:"1"});}
function req(body,headers={}){const u=new URL("http://localhost:3100/api/admin/nfse?empresa=drsoft&id="+id);const r=new Request(u,{method:body?"POST":"GET",headers:{origin:u.origin,"x-test":"yes",...headers},body:body?JSON.stringify(body):undefined});r.nextUrl=u;return r;}
const preparar={acao:"preparar",id,atualizadoEm:"v1",fiscal,confirmarSerie:true};
test("fiscal exige autenticação, confirmação de série, teste recente e aprovação separada",async()=>{
 setup();assert.equal((await GET(req(null,{"x-test":"no"}))).status,401);assert.equal((await POST(req(preparar,{origin:"https://outro"}))).status,403);
 assert.equal((await POST(req({...preparar,confirmarSerie:false}))).status,400);
 let r=await POST(req(preparar));assert.equal(r.status,200);let job=(await r.json()).trabalho;assert.equal(job.dados.numero,"1");assert.equal(state.real,0);
 const command={id,hash:job.hash,atualizadoEm:"v1"};assert.equal((await POST(req({...command,acao:"emitir",aprovado:true}))).status,400);
 r=await POST(req({...command,acao:"testar"}));job=(await r.json()).trabalho;assert.equal(job.status,"testada");assert.equal(state.real,0);
 process.env.NFSE_SP_PRODUCAO_HABILITADA="true";assert.equal((await POST(req({...command,acao:"emitir",aprovado:false}))).status,400);
 state.fail=true;const results=await Promise.all([POST(req({...command,acao:"emitir",aprovado:true})),POST(req({...command,acao:"emitir",aprovado:true}))]);assert.equal(state.real,1);assert.ok(results.some(x=>x.status===409||x.status===400));
 assert.equal((await POST(req(preparar))).status,400);assert.equal(state.real,1);
 r=await POST(req({id,acao:"consultar"}));assert.equal(r.status,200);const d=await r.json();assert.equal(d.trabalho.status,"emitida");assert.equal(d.email.fluxo.nota,"10");assert.equal(d.email.status,"rascunho");assert.equal(d.email.anexos.length,0);assert.equal(state.real,1);
});
test("alterar valor/PO invalida teste; segunda reserva não reutiliza número",async()=>{
 setup();let job=(await (await POST(req(preparar))).json()).trabalho;const command={id,hash:job.hash,atualizadoEm:"v1"};
 const row=records.get(`AdminDocumentos:emails-drsoft:${id}`);row.json=JSON.stringify({...email,po:"999"});assert.equal((await POST(req({...command,acao:"testar"}))).status,400);assert.equal(state.testes,0);
 job=(await (await POST(req(preparar))).json()).trabalho;assert.equal(job.dados.numero,"1");assert.notEqual(job.hash,command.hash);
 const id2="22222222-2222-4222-8222-222222222222";records.set(`AdminDocumentos:emails-drsoft:${id2}`,{json:JSON.stringify({...email,id:id2,competencia:"2026-10",fluxo:{cobrancaId:planId+"_2026-10"}}),etag:"1"});
 job=(await (await POST(req({...preparar,id:id2}))).json()).trabalho;assert.equal(job.dados.numero,"2");assert.equal(state.real,0);
});
test("regime tem vigência, segregação e histórico; mudança invalida a prévia",async()=>{
 setup();const job=(await(await POST(req(preparar))).json()).trabalho;
 const config={acao:"configurarRegime",id,regime:"simples",vigencia:"2026-10-03",confirmado:true};
 assert.equal((await POST(req({...config,confirmado:false}))).status,400);
 assert.equal((await POST(req(config))).status,200);
 const d=await(await GET(req())).json();assert.equal(d.regime.regime,"simples");assert.equal(d.historicoRegime.length,2);assert.equal(d.trabalho.dados.fiscal.regime,"presumido");
 assert.equal((await POST(req({acao:"testar",id,hash:job.hash,atualizadoEm:"v1"}))).status,400);assert.equal(state.testes,0);
 assert.equal((await POST(req(config))).status,400);
 assert.equal((await POST(req({...config,regime:"presumido",vigencia:"2027-01-01"}))).status,200);
 assert.equal((await(await GET(req())).json()).regime.regime,"simples");
 assert.equal(records.has("AdminConfiguracoes:nfse-regimes:sysney"),false);
});
