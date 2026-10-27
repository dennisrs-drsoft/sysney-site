import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startSyntheticFiscalServer} from './helpers/atp-fiscal-http.mjs';
import {createNationalRestrictedClient} from '../admin-api/src/services/national-restricted-client.mjs';
import {createNationalRestrictedWorkflow} from '../admin-api/src/services/national-restricted-workflow.mjs';
const base=process.env.NATIONAL_SIM_BASE;
test('ATP HTTP → proveniencia → DPS → assinatura injetada → SEFIN HTTP sim → XML/PDF privados',{skip:!base},async()=>{
 assert.equal(new URL(base).hostname,'127.0.0.1');
 const token='s'.repeat(48),server=await startSyntheticFiscalServer({token});
 try{
  const input=JSON.parse(await readFile(new URL('../postman/fixtures/atp-fiscal-v1.synthetic.json',import.meta.url)));
  const url=server.baseUrl+'/api/integracoes/atp/v1/solicitacoes-fiscais',headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
  const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(input)});assert.equal(response.status,202);
  const {request}=await response.json(),provenance=new Map(),jobs=new Map(),reservations=new Map();
  const repository={getRequest:server.store.get,getProvenance:async id=>provenance.get(id),reserveProvenance:async p=>{if([...provenance.values()].some(v=>v.requestId===p.requestId))throw Error('Conflicting provenance');provenance.set(p.workId,p);}};
  const works={get:async id=>jobs.get(id),create:async w=>{if(jobs.has(w.workId))throw Error('Conflict');jobs.set(w.workId,w);},saveResult:async(id,r)=>{jobs.get(id).result=r;}};
  const ledger={get:async id=>reservations.get(id),reserve:async r=>{if(reservations.has(r.idDps))throw Error('Conflict');reservations.set(r.idDps,r);}};
  const transport=async r=>{assert.equal(r.environment,'homologacao');const v=await fetch(base+r.path,{method:r.method,...(r.body?{headers:{'content-type':'application/json'},body:JSON.stringify(r.body)}:{})});return {status:v.status,contentType:v.headers.get('content-type'),body:Buffer.from(await v.arrayBuffer())};};
  const client=createNationalRestrictedClient({transport,ledger});
  // Signature injection here is synthetic; native Windows/XSD is a separate test.
  const workflow=createNationalRestrictedWorkflow({repository,works,client,environment:'homologacao',sign:async xml=>xml});
  const actor={role:'administrador',id:'qa-local'},profile={issuer:{opSimpNac:'3',regApTribSN:'1',regEspTrib:'0'},service:{cTribNac:'000000',tribISSQN:'1',tpRetISSQN:'1',totTrib:{kind:'indTotTrib',value:'0'}},dps:{serie:'99'}};
  const work=await workflow.prepare({requestId:request.id,profile,number:'1',emissionAt:'2026-10-27T12:00:00-03:00',actor,synthetic:true});
  assert.equal(provenance.size,1);assert.match(work.signedXml.toString(),/NAO TRANSMITIR/);
  await assert.rejects(workflow.run({workId:work.workId,actor,approvedHash:work.signedHash}),/RESTRICTED_APPROVAL_REQUIRED/);
  await fetch(base+'/qa/mode?name=normal');
  const before=await (await fetch(base+'/qa/stats')).json();
  const run=()=>workflow.run({workId:work.workId,actor,approvedHash:work.signedHash,explicitRestrictedApproval:true});
  const result=await run();assert.deepEqual(result.documents,{xml:true,pdf:true});assert.equal(result.productionIssued,false);
  await run();const after=await (await fetch(base+'/qa/stats')).json();assert.equal(after.posts,before.posts+1);
  assert.ok(Buffer.isBuffer(jobs.get(work.workId).result.xml));assert.ok(Buffer.isBuffer(jobs.get(work.workId).result.pdf));
  assert.equal((await (await fetch(url+'/'+request.id,{headers})).json()).request.status,'pending_review');
  assert.equal((await fetch(url+'/'+request.id+'/documentos/pdf',{headers})).status,409);
  await fetch(url+'/'+request.id+'/revisao-estorno',{method:'POST',headers,body:JSON.stringify({refundId:'QA:refund',reason:'Revisao sintetica'})});
  await assert.rejects(run(),/REQUEST_NOT_ELIGIBLE/);
 }finally{await server.close();}
});
