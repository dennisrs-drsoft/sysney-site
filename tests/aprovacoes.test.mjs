import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const compile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=uri(compile('../lib/aprovacoes-emissao.ts'));
const storage=uri(`export const records=new Map();export class TableClient {
 async createEntity(e){const k=e.partitionKey+e.rowKey;if(records.has(k))throw Object.assign(Error(),{statusCode:409});records.set(k,{...e,etag:'1'})}
 async getEntity(p,r){const e=records.get(p+r);if(!e)throw Object.assign(Error(),{statusCode:404});return structuredClone(e)}
 async updateEntity(e,m,o){const k=e.partitionKey+e.rowKey;const old=records.get(k);if(old.etag!==o.etag)throw Object.assign(Error(),{statusCode:412});records.set(k,{...e,etag:String(Number(old.etag)+1)})}
 async *listEntities(o){const p=o.queryOptions.filter.split("'")[1];for(const e of records.values())if(e.partitionKey===p)yield structuredClone(e)}
}`);
let source=compile('../app/api/admin/aprovacoes/route.ts');
source=source.replaceAll('"../_remote"',JSON.stringify(uri('export const encaminharAdmin=async()=>null')));
for(const [key,value] of Object.entries({'next/server':uri('export const NextResponse={json:(d,o)=>Response.json(d,o)}'),'@azure/data-tables':storage,'@azure/identity':uri('export class DefaultAzureCredential {}'),'../_auth':uri("export const usuarioAdministrador=r=>r.headers.get('x-test')==='yes'"),'@/lib/aprovacoes-emissao':model}))source=source.replaceAll(JSON.stringify(key),JSON.stringify(value));
const {GET,POST}=await import(uri(source));
process.env.ADMIN_STORAGE_ACCOUNT='test';
function req(body,empresa='sysney',headers={}){const url=new URL(`http://localhost:3100/api/admin/aprovacoes?empresa=${empresa}`);const r=new Request(url,{method:body?'POST':'GET',headers:{origin:url.origin,'x-test':'yes',...headers},body:body?JSON.stringify(body):undefined});r.nextUrl=url;return r;}
const dados={clienteNome:'Teste',clienteDocumento:'00000000000000',descricao:'Teste',competencia:'2026-10',vencimento:'2026-12-08',centavos:123456,codigoServico:'03158',aliquota:'0',retencao:'sem-retencao',gerarCobranca:true};
test('aprovação segregada por empresa, concorrência e alteração revogam sem emissão',async()=>{
 assert.equal((await GET(req(null,'sysney',{'x-test':'no'}))).status,401);
 assert.equal((await POST(req({acao:'criar',dados},'sysney',{origin:'https://outro.test'}))).status,403);
 let r=(await (await POST(req({acao:'criar',dados}))).json()).registro;
 assert.equal(r.status,'pendente');
 assert.equal((await POST(req({acao:'criar',dados}))).status,409);
 assert.equal((await (await GET(req(null,'drsoft'))).json()).aprovacoes.length,0);
 const approve={acao:'aprovar',id:r.id,versao:r.versao,atualizadoEm:r.atualizadoEm};
 const results=await Promise.all([POST(req(approve)),POST(req(approve))]);
 assert.equal(results.filter(x=>x.status===200).length,1);
 r=(await (await GET(req())).json()).aprovacoes[0];assert.equal(r.status,'aprovada');assert.ok(r.aprovacao.hash);
 const saved=(await (await POST(req({acao:'alterar',id:r.id,versao:r.versao,atualizadoEm:r.atualizadoEm,dados:{...dados,centavos:800000}}))).json()).registro;
 assert.equal(saved.versao,2);assert.equal(saved.status,'pendente');assert.equal(saved.aprovacao,undefined);
 assert.equal((await POST(req(approve))).status,409);
 assert.equal((await POST(req({acao:'emitir',id:saved.id,versao:saved.versao,atualizadoEm:saved.atualizadoEm}))).status,400);
 assert.equal((await (await GET(req())).json()).emissaoDisponivel,false);
});
