import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {build} from "esbuild";
import {mkdir} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {excelOS} from "./fixtures/os-excel.mjs";
await mkdir("output",{recursive:true});
await build({entryPoints:["lib/ordens-servico-store.ts"],outfile:"output/os-store-teste.mjs",bundle:true,platform:"node",format:"esm",target:"node22",packages:"external"});
const {OrdensServicoStore}=await import(pathToFileURL(process.cwd()+"/output/os-store-teste.mjs").href);
const erro=statusCode=>Object.assign(Error("erro simulado"),{statusCode});
class Tabela {
 rows=new Map();seq=0;falharCriacao=false;
 key(p,k){return `${p}|${k}`;}
 async getEntity(p,k){const r=this.rows.get(this.key(p,k));if(!r)throw erro(404);return structuredClone(r);}
 async createEntity(e){if(this.falharCriacao){this.falharCriacao=false;throw erro(503);}const k=this.key(e.partitionKey,e.rowKey);if(this.rows.has(k))throw erro(409);this.rows.set(k,{...structuredClone(e),etag:String(++this.seq)});}
 async updateEntity(e,mode,opts={}){const k=this.key(e.partitionKey,e.rowKey),r=this.rows.get(k);if(!r)throw erro(404);if(opts.etag&&opts.etag!==r.etag)throw erro(412);this.rows.set(k,{...structuredClone(e),etag:String(++this.seq)});}
 async *listEntities({queryOptions}){const p=queryOptions.filter.split("'")[1];for(const r of this.rows.values())if(r.partitionKey===p)yield structuredClone(r);}
 async submitTransaction(actions){assert.ok(actions.length<=100,'limite de ações do Azure');const snapshot=structuredClone(this.rows),seq=this.seq;try{for(const [op,e,mode,opts]of actions){if(op==="create")await this.createEntity(e);else if(op==="update")await this.updateEntity(e,mode,opts);else{if(!this.rows.delete(this.key(e.partitionKey,e.rowKey)))throw erro(404);}}}catch(e){this.rows=snapshot;this.seq=seq;throw e;}}
}
function setup(){const tables=new Map(),blobs=new Map();const store=new OrdensServicoStore("sysney","teste");store.tabela=(n="AdminDocumentos")=>{if(!tables.has(n))tables.set(n,new Tabela());return tables.get(n);};store.container=()=>({getBlockBlobClient:k=>({uploadData:async bytes=>{if(blobs.has(k))throw erro(412);blobs.set(k,bytes);},getProperties:async()=>({contentLength:blobs.get(k).length})})});return {store,tables,blobs};}
const regras={horaCentavos:6200,diariaCentavos:null,minimoMinutos:0,arredondamentoMinutos:1,adicionalBps:600};
const entrada={data:"2026-08-01",diaFim:"2026-08-01",inicio:"08:00",fim:"09:00",intervaloMinutos:0,tipo:"hora",quantidadeCentesimos:100,valorFixoCentavos:0,descricao:"Serviço de demonstração"};
async function preparar(){const ctx=setup(),{store}=ctx;await store.tabela("AdminClientes").createEntity({partitionKey:"sysney",rowKey:"c1",nome:"Cliente teste",documento:"11111111111111",email:"teste@example.com"});await store.salvarRegras("c1",regras,"",randomUUID(),"Teste");const os=await store.salvar({id:randomUUID(),clienteId:"c1",entrada},randomUUID(),"Teste");return {...ctx,os};}
const corpo=os=>({acao:"cobrar",itens:[{id:os.id,versao:os.versao}],competencia:"2026-08",vencimento:"2026-09-10",email:"teste@example.com",formaPagamento:"pix",pixChave:"11111111111111",pixBeneficiario:"Empresa teste",confirmado:true});
test("congela regras, bloqueia duplicidade e edição com versão antiga",async()=>{const {store,os}=await preparar();await store.salvarRegras("c1",{...regras,horaCentavos:10000},(await store.listar()).regras[0].versao,randomUUID(),"Teste");const nova=await store.salvar({id:os.id,clienteId:"c1",entrada:{...entrada,fim:"10:00"},versao:os.versao},randomUUID(),"Teste");assert.equal(nova.regras.horaCentavos,6200);await assert.rejects(store.salvar({id:os.id,clienteId:"c1",entrada,versao:os.versao},randomUUID(),"Teste"));await assert.rejects(store.salvar({id:randomUUID(),clienteId:"c1",entrada:{...entrada,fim:"10:00"}},randomUUID(),"Teste"));});
test("gera apenas rascunho, relatório real e cobrança; repetir operação não duplica",async()=>{const {store,os,blobs}=await preparar(),op=randomUUID(),body=corpo(os);const lote=await store.executar({...body,operacaoId:op},"Teste");assert.equal(lote.estado,"concluido");assert.equal(blobs.size,1);assert.match(Buffer.from([...blobs.values()][0]).subarray(0,8).toString(),/%PDF-/);assert.equal((await store.listar()).ordens[0].estado,"cobrada");const email=JSON.parse((await store.tabela().getEntity("emails-sysney",op)).json);assert.equal(email.status,"rascunho");assert.equal(email.tentativas.length,0);assert.equal(email.anexos[0].tipo,"ordem-servico");assert.equal((await store.executar({...body,operacaoId:op},"Teste")).estado,"concluido");await assert.rejects(store.executar({...body,operacaoId:randomUUID()},"Teste"));});
test("falha parcial mantém reserva e permite retomar sem segunda cobrança",async()=>{const {store,os}=await preparar(),op=randomUUID();store.tabela("AdminConfiguracoes").falharCriacao=true;await assert.rejects(store.executar({...corpo(os),operacaoId:op},"Teste"));assert.equal((await store.listar()).ordens[0].estado,"reservada");await assert.rejects(store.executar({...corpo(os),operacaoId:randomUUID()},"Teste"));await store.executar({acao:"retomar",id:op,operacaoId:randomUUID(),confirmado:true},"Teste");assert.equal((await store.listar()).lotes[0].estado,"concluido");assert.equal((await store.listar()).ordens[0].estado,"cobrada");});
test("histórico importado é idempotente, mantém nota e não cria cobrança",async()=>{const {store,os}=await preparar();const historico={...os,id:randomUUID(),data:"2026-07-01",diaFim:"2026-07-01",estado:"historico",nota:"49"};assert.equal((await store.importarHistorico([historico],"49","sha-original","Teste")).importada,true);assert.equal((await store.importarHistorico([historico],"49","sha-original","Teste")).importada,false);await assert.rejects(store.executar({...corpo(historico),operacaoId:randomUUID()},"Teste"));assert.equal((await store.listar()).lotes.length,0);await assert.rejects(store.cancelar(historico.id,historico.versao,randomUUID(),"Teste"));});

test("preferências são versionadas por cliente e empresa; atualizar valores preserva contatos",async()=>{
 const {store,os}=await preparar();let r=(await store.listar()).regras[0];
 const preferencias={email:"financeiro@example.com",cc:"copia@example.com",pixChave:"11111111111111",pixBeneficiario:"Empresa teste"};
 const op=randomUUID(),body={acao:"regras",clienteId:"c1",regras,versao:r.versao,preferencias,operacaoId:op};
 await store.executar(body,"Teste");await store.executar(body,"Teste");
 assert.deepEqual((await store.listar()).regras[0].preferencias,preferencias);
 await assert.rejects(store.executar({...body,preferencias:{...preferencias,cc:"outro@example.com"}},"Teste"));
 await assert.rejects(store.executar({...body,operacaoId:randomUUID()},"Teste"));
 r=(await store.listar()).regras[0];
 await assert.rejects(store.executar({...body,versao:r.versao,operacaoId:randomUUID(),preferencias:{...preferencias,cc:"invalido"}},"Teste"));
 await assert.rejects(store.executar({...body,versao:r.versao,operacaoId:randomUUID(),preferencias:{...preferencias,email:"ok@example.com\r\nBcc: outro@example.com"}},"Teste"));
 await store.salvarRegras("c1",{...regras,horaCentavos:7000},r.versao,randomUUID(),"Teste");
 assert.deepEqual((await store.listar()).regras[0].preferencias,preferencias);
 assert.equal((await store.listar()).ordens[0].regras.horaCentavos,6200);
 const b=corpo(os),billingId=randomUUID();await store.executar({...b,email:"alterado@example.com",cc:preferencias.cc,operacaoId:billingId},"Teste");
 const email=JSON.parse((await store.tabela().getEntity("emails-sysney",billingId)).json);
 assert.equal(email.para,"alterado@example.com");assert.equal(email.cc,"copia@example.com");assert.equal(email.status,"rascunho");
});

test("Excel: prévia não grava; importação é atômica e repetida não duplica nem gera cobrança",async()=>{
 const {store}=await preparar(),b=excelOS([{data:'01/09/2026',inicio:'08:00',fim:'09:00',descricao:'Novo serviço'},{data:'01/09/2026',inicio:'08:00',fim:'09:00',descricao:'Novo serviço'}]);
 const antes=(await store.listar()).ordens.length,p=await store.preverExcel('c1',b);assert.equal(p.novas,1);assert.equal(p.ignoradas,1);assert.equal((await store.listar()).ordens.length,antes);
 await assert.rejects(store.importarExcel('c1',b,p.versao,randomUUID(),'Teste',false));
 await assert.rejects(store.importarExcel('c1',b,'versao-antiga',randomUUID(),'Teste',true));
 store.tabela().falharCriacao=true;await assert.rejects(store.importarExcel('c1',b,p.versao,randomUUID(),'Teste',true));assert.equal((await store.listar()).ordens.length,antes);
 const result=await store.importarExcel('c1',b,p.versao,randomUUID(),'Teste',true);assert.equal(result.importadas,1);
 assert.equal((await store.importarExcel('c1',b,p.versao,randomUUID(),'Teste',true)).repetida,true);
 const key='excel-'+createHash('sha256').update('c1:'+p.hash).digest('hex'),legacy=await store.ler(key),saved=JSON.parse(legacy.json);
 delete saved.estado;delete saved.regras;delete saved.versaoRegras;
 await store.tabela().updateEntity(store.entidade(key,saved),'Replace',{etag:legacy.etag});
 assert.equal((await store.importarExcel('c1',b,p.versao,randomUUID(),'Teste',true)).repetida,true);
 assert.equal((await store.listar()).ordens.length,antes+1);assert.equal((await store.listar()).lotes.length,0);
 const d=await store.preverExcel('c1',excelOS([{data:'01/09/2026',inicio:'08:00',fim:'09:00',descricao:'Descrição alterada'}]));assert.equal(d.novas,0);assert.equal(d.ignoradas,1);
 const bad=excelOS([{data:'02/09/2026',inicio:'08:00',fim:'09:00',descricao:'Correto'},{data:'31/02/2026',inicio:'08:00',fim:'09:00',descricao:'Inválido'}]);await assert.rejects(store.importarExcel('c1',bad,p.versao,randomUUID(),'Teste',true));assert.equal((await store.listar()).ordens.length,antes+1);
});
test('histórico grande importa somente novos em lotes retomáveis, sem duplicar e com regras congeladas',async()=>{
 const {store}=await preparar(),rows=Array.from({length:85},(_,i)=>({data:new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10),inicio:'08:00',fim:'09:00',descricao:`Novo ${i+1}`})),b=excelOS(rows);
 const p=await store.preverExcel('c1',b);assert.equal(p.novas,85);assert.equal(p.resumo.total,558620);
 const op=randomUUID(),r=await store.importarExcel('c1',b,p.versao,op,'Teste',true);assert.equal(r.importadas,40);assert.equal(r.pendentes,45);
 let atual=(await store.listar()).regras[0];await store.salvarRegras('c1',{...regras,horaCentavos:7000},atual.versao,randomUUID(),'Teste');
 const retomada=await store.preverExcel('c1',b);assert.equal(retomada.retomada,true);assert.equal(retomada.jaImportadas,40);assert.equal(retomada.regras.horaCentavos,6200);assert.equal(retomada.novas,45);
 const segundo=await store.importarExcel('c1',b,retomada.versao,op,'Teste',true);assert.equal(segundo.importadas,80);assert.equal(segundo.pendentes,5);
 store.tabela().falharCriacao=true;await assert.rejects(store.importarExcel('c1',b,retomada.versao,op,'Teste',true));assert.equal((await store.listar()).ordens.length,81);
 const fim=await store.importarExcel('c1',b,retomada.versao,randomUUID(),'Teste',true);assert.equal(fim.importadas,85);assert.equal(fim.pendentes,0);assert.equal(fim.ignoradas,0);
 const d=await store.listar();assert.equal(d.ordens.length,86);assert.equal(d.ordens.filter(o=>o.regras.horaCentavos!==6200).length,0);assert.equal(d.lotes.length,0);
 assert.equal((await store.importarExcel('c1',b,retomada.versao,randomUUID(),'Teste',true)).repetida,true);
 const ampliada=await store.preverExcel('c1',excelOS([...rows,{data:'01/03/2027',inicio:'08:00',fim:'09:00',descricao:'Adicionado depois'}]));assert.equal(ampliada.novas,1);assert.equal(ampliada.ignoradas,85);
});
