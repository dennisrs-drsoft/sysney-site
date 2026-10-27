import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from '../admin-api/src/compat/next-server.mjs';
// Executar após node deploy/build-admin-api.mjs. Testa handlers compilados reais,
// sem host Functions/SWA ou storage; todas as rotas mutáveis falham fechadas.
import {GET,POST} from '../admin-api/generated/atp-fiscal.mjs';
process.env.ADMIN_BACKEND_EXECUTION='true';
process.env.NODE_ENV='production';
process.env.ATP_FISCAL_LINK_ENABLED='true'; // Flag sozinha NÃO autoriza evidência real.
const principal=Buffer.from(JSON.stringify({userId:'ADMIN-SINTETICO',userRoles:['administrador']})).toString('base64');
function req(method,{admin=true,origin='https://admin.invalid',empresa='sysney',query=''}={}){return new NextRequest(`https://admin.invalid/api/admin/atp-fiscal?empresa=${empresa}${query}`,{method,headers:{origin,...(admin?{'x-ms-client-principal':principal}:{authorization:'Bearer TOKEN-ATP-NAO-ADMIN'})},...(method==='POST'?{body:JSON.stringify({action:'approve',confirmed:true})}:{})});}
test('rota administrativa compilada: sessão, CSRF e gate fiscal independente da flag',async()=>{
 assert.equal((await GET(req('GET',{admin:false}))).status,401);
 assert.equal((await POST(req('POST',{admin:false}))).status,401);
 assert.equal((await POST(req('POST',{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await POST(req('POST',{empresa:'drsoft'}))).status,400);
 const denied=await POST(req('POST'));assert.equal(denied.status,503);assert.match((await denied.json()).erro,/bloqueado/);
 const capability=await GET(req('GET',{query:'&acao=vinculo-capacidades'}));assert.equal(capability.status,200);const body=await capability.json();assert.equal(body.disponivel,false);assert.equal(body.emissaoReal,false);assert.ok(body.motivos.length>=3);
});
