import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile,mkdir} from 'node:fs/promises';
import {NextRequest} from 'next/server.js';
const bundle=await build({entryPoints:['app/api/admin/regularizacao-fiscal/route.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'sem-acesso-externo',setup(b){
 b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}));
 b.onResolve({filter:/^\.\.\/_remote$/},()=>({path:'remote',namespace:'qa'}));
 b.onResolve({filter:/regularizacao-emissao$/},()=>({path:'service',namespace:'qa'}));
 b.onLoad({filter:/.*/,namespace:'qa'},({path})=>({contents:path==='remote'?'export const encaminharAdmin=async()=>null;':`export function criarRegularizacaoEmissao(){const call=(name,...args)=>{globalThis.fiscalRouteQa.push({name,args});return {empresa:args[0],id:'emissao-'+ 'a'.repeat(64),itens:[]}};return {organizarHistorico:async(...a)=>call('organizarHistorico',...a),criar:async(...a)=>call('criar',...a),aprovar:async(...a)=>call('aprovar',...a),avancar:async(...a)=>call('avancar',...a),lote:async(...a)=>({l:call('lote',...a)}),listar:async()=>[],configuracao:async()=>({emissor:'nacional'})}}`,loader:'js'}));
}}]});
await mkdir('output/regularizacao-test',{recursive:true});const file=new URL('../output/regularizacao-test/api-'+process.pid+'.mjs',import.meta.url);await writeFile(file,bundle.outputFiles[0].text);const {GET,POST}=await import(file.href);
process.env.ADMIN_DEV_BYPASS='false';
const principal=Buffer.from(JSON.stringify({userDetails:'qa@example.invalid',userRoles:['administrador']})).toString('base64');
function request(method,body,headers={}){return new NextRequest('https://qa.local/api/admin/regularizacao-fiscal?empresa=sysney',{method,headers:{'x-ms-client-principal':principal,origin:'https://qa.local',...headers},...(body?{body:JSON.stringify(body)}:{})});}
test('API de lotes exige administrador e origem correta antes de qualquer operação',async()=>{
 globalThis.fiscalRouteQa=[];
 assert.equal((await GET(request('GET',null,{'x-ms-client-principal':''}))).status,401);
 assert.equal((await POST(request('POST',{acao:'preparar'},{'x-ms-client-principal':''}))).status,401);
 assert.equal((await POST(request('POST',{acao:'aprovar'},{origin:'https://outro.invalid'}))).status,403);
 assert.equal(globalThis.fiscalRouteQa.length,0);
 for(const acao of ['preparar','aprovar','avancar','organizar-historico']){const res=await POST(request('POST',{acao,loteId:'emissao-'+ 'a'.repeat(64)}));assert.equal(res.status,200);const data=await res.json();assert.equal(data.emailEnviado,false);assert.equal(data.novaDividaCriada,false);}
 assert.deepEqual(globalThis.fiscalRouteQa.map(c=>c.name),['criar','aprovar','avancar','organizarHistorico']);
 assert.equal((await POST(request('POST',{acao:'enviar-email'}))).status,400);
 assert.equal((await POST(request('POST',{acao:'preparar',excesso:'a'.repeat(21000)}))).status,400);
});
