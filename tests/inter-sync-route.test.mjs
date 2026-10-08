import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const sdk=uri(`export class DefaultAzureCredential{};export class BlobServiceClient{};export class TableClient{};export class NextRequest{};export class NextResponse extends Response{static json(b,o){return new NextResponse(JSON.stringify(b),{...o,headers:{...o?.headers,"content-type":"application/json"}});}}`);
const sync=uri(`export let calls=0;export function tabelaSync(){return {};};export async function lerSync(){return null;};export function statusSync(){return {ativa:true};};export async function solicitarSync(){calls++;return {ativa:true,estado:"solicitada"};}`);
const auth=uri(`export function usuarioAdministrador(r){return r.headers.get("test-admin")==="true";};export async function encaminharAdmin(){return null;}`);
let source=ts.transpileModule(readFileSync(new URL("../app/api/admin/historico-inter/route.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
source=source.replace(/from "(?:@azure\/identity|@azure\/data-tables|@azure\/storage-blob|next\/server)"/g,`from "${sdk}"`).replace(/from "\.\.\/(?:_auth|_remote)"/g,`from "${auth}"`).replace(/from "@\/admin-api\/src\/services\/inter-sync.js"/g,`from "${sync}"`);
const route=await import(uri(source)),state=await import(sync);
function req({empresa="sysney",admin=true,origin="https://www.sysney.com",body='{"acao":"sincronizar"}'}={}){
 const r=new Request(`https://www.sysney.com/api/admin/historico-inter?empresa=${empresa}`,{method:"POST",headers:{origin,"test-admin":String(admin)},body});r.nextUrl=new URL(r.url);return r;
}
test("pedido manual exige administrador, mesma origem, SYSNEY e ação válida",async()=>{
 assert.equal((await route.POST(req({admin:false}))).status,401);
 assert.equal((await route.POST(req({origin:"https://externo.com"}))).status,403);
 assert.equal((await route.POST(req({empresa:"drsoft"}))).status,400);
 assert.equal((await route.POST(req({body:'{"acao":"emitir"}'}))).status,400);
 assert.equal(state.calls,0);
 const r=await route.POST(req());assert.equal(r.status,202);assert.equal((await r.json()).sincronizacao.estado,"solicitada");assert.equal(state.calls,1);
});
