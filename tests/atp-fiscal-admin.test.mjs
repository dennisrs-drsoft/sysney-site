import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFiscalAdminBoundary} from '../admin-api/src/services/atp-fiscal-admin.mjs';
import {digest} from '../admin-api/src/services/atp-fiscal-v1.mjs';
const input=JSON.parse(await readFile(new URL('../postman/fixtures/atp-fiscal-v1.synthetic.json',import.meta.url),'utf8'));
const requestId='b'.repeat(64),workId='a'.repeat(64);
function setup(){
 let record={id:requestId,source:'ATP',input,hash:digest(JSON.stringify(input)),status:'pending_review',reviewStatus:'none',etag:'1'},p,claim;
 const xml=Buffer.from('<NFSeSimulada>SEM VALIDADE FISCAL</NFSeSimulada>'),e={workId,source:'ATP',requestId,status:'issued',test:false,issuerDocument:'57767099000179',recipientDocument:input.recipient.document,amountCentsBRL:19900,competence:input.competence,description:input.description,servicePeriod:input.servicePeriod,authorizedAtUtc:'2099-01-01T00:00:00Z',provider:'national',number:'1',authorityKey:'SINTETICA',authorizedXmlVerified:true,xml,authorizedXmlHash:digest(xml)};
 const repository={getRequest:async()=>structuredClone(record),getProvenance:async()=>p,reserveProvenance:async v=>{p={...v,etag:'P1'};},getInvoiceClaim:async()=>claim,saveOfficialDocument:async(id,f,b,h)=>({blob:`integracoes/atp/${id}/${h}.${f}`,sha256:h,size:b.length}),commitLink:async c=>{assert.equal(c.requestEtag,record.etag);record={...c.request,etag:'2'};claim=c.claim;}};
 const authenticate=async req=>req.headers.get('x-synthetic-admin')==='yes'?{role:'administrador',id:'ADMIN-TESTE'}:null;
 const handler=createFiscalAdminBoundary({authenticate,repository,readAuthorizedEvidence:async()=>e,enabled:true});
 const call=async(body,{auth=true,origin='https://admin.invalid'}={})=>{const req=new Request('https://admin.invalid/api/admin/atp-fiscal-link',{method:'POST',headers:{origin,...(auth?{'x-synthetic-admin':'yes'}:{authorization:'Bearer ATP-NAO-E-ADMIN'})},body:JSON.stringify({requestId,workId,...body})});return handler(req);};
 return {call,e,current:()=>record};
}
test('fronteira recusa Bearer ATP, origem errada, ator e paths no corpo',async()=>{const s=setup();assert.equal((await s.call({action:'reserve'},{auth:false})).status,401);assert.equal((await s.call({action:'reserve'},{origin:'https://evil.invalid'})).status,403);assert.equal((await s.call({action:'reserve',actor:{role:'administrador'}})).status,400);assert.equal((await s.call({action:'reserve',blob:'/livre'})).status,400);});
test('aprova somente snapshot+bytes conferidos e nao transmite',async()=>{
 const s=setup();assert.equal((await s.call({action:'reserve'})).status,200);
 const p=(await s.call({action:'preview'})).jsonBody;
 assert.equal((await s.call({action:'approve',confirmed:true,snapshotHash:p.preview.snapshotHash,previewHash:'0'.repeat(64)})).status,409);
 const linked=await s.call({action:'approve',confirmed:true,snapshotHash:p.preview.snapshotHash,previewHash:p.previewHash});assert.equal(linked.status,200);assert.equal(linked.jsonBody.status,'issued');assert.equal(linked.jsonBody.emissaoReal,false);assert.equal(s.current().documents.pdf,undefined);
});
test('XML mudado entre preview e approve exige nova conferencia',async()=>{const s=setup();await s.call({action:'reserve'});const p=(await s.call({action:'preview'})).jsonBody;s.e.xml=Buffer.from('<NFSeSimulada>ALTERADA SEM VALIDADE</NFSeSimulada>');assert.equal((await s.call({action:'approve',confirmed:true,snapshotHash:p.preview.snapshotHash,previewHash:p.previewHash})).status,409);assert.equal(s.current().status,'pending_review');});
