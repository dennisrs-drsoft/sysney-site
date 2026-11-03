import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomInt} from 'node:crypto';
import ts from 'typescript';
import {createNationalAdminClient} from '../admin-api/src/services/national-admin-client.mjs';
import {createNationalAdminSequence,createNationalAdminQueue} from '../admin-api/src/services/national-admin-store.mjs';
import {memoryTable} from './helpers/atp-municipal-fixture.mjs';
import {runNationalAdminJob} from '../admin-api/src/services/national-admin-worker.mjs';
const js=ts.transpileModule(readFileSync(new URL('../lib/nfse-nacional.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {montarDpsNacional}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const hash=b=>createHash('sha256').update(b).digest('hex'),base=process.env.NATIONAL_SIM_BASE;
const p={codigoNacional:'010701',codigoMunicipal:'',nbs:'',serie:'777',regimeEspecial:'0',apuracaoSimples:'1',retencaoIss:'1',aliquotaIss:'',transparencia:{tipo:'naoInformar',percentual:''}};
const d={empresa:'sysney',cnpj:'12345678000199',regime:'simples',documento:'98765432000199',cliente:'CLIENTE QA',descricao:'SIMULACAO LOCAL NAO TRANSMITIR',centavos:324258,referencia:'2026-10',competenciaFiscal:'2026-11-01',emissao:'2026-11-02',endereco:{tipo:'R',logradouro:'Teste',numero:'1',bairro:'Centro',municipio:'3550308',uf:'SP',cep:'01000000'},perfil:p};
test('contador nacional transacional: concorrência, perda de resposta e isolamento dos emitentes/ambientes',async()=>{
 const table=memoryTable(),args={workId:'a'.repeat(64),hash:'b'.repeat(64),serie:'777',emissao:'2026-11-02T12:00:00-03:00'};
 for(const cnpj of ['12345678000199','11111111000191'])for(const ambiente of ['homologacao','producao']){
  const s=createNationalAdminSequence(table,{cnpj,ambiente});table.timeoutOnce();const values=await Promise.all(Array.from({length:4},()=>s.reserve(args)));
  assert.ok(values.every(v=>v.numero==='1'));assert.equal((await s.reserve({...args,workId:'c'.repeat(64)})).numero,'2');await assert.rejects(s.reserve({...args,hash:'d'.repeat(64)}));
 }
});
test('worker nacional HTTP: política vencida/alteração de cobrança bloqueiam POST; aprovação válida recupera PDF vinculado',{skip:!base},async()=>{
 let counter=randomInt(1000,1000000000);
 for(const scenario of ['disabled','expired','changed','valid']){
  const table=memoryTable(),documents=memoryTable(),q=createNationalAdminQueue(table),id='f'.repeat(64),built=montarDpsNacional(d,String(++counter),'2026-11-02T12:00:00-03:00','homologacao'),stamp=new Date().toISOString();let posts=0;
  const work={empresa:'sysney',cnpj:d.cnpj,ambiente:'homologacao',hash:'a'.repeat(64),perfilHash:'b'.repeat(64),xml:built.xml,xmlHash:built.hash,idDps:built.idDps,status:'transmitindo',signedXml:Buffer.from(built.xml).toString('base64'),emailId:'qa-email',emailDescricao:d.descricao,emailBloqueadoEm:stamp,dados:d,aprovacao:{hash:'a'.repeat(64),em:scenario==='expired'?'2020-01-01T00:00:00Z':stamp}};
  await documents.createEntity({partitionKey:'nfse-nacional-trabalhos-sysney',rowKey:id,json:JSON.stringify(work)});
  await documents.createEntity({partitionKey:'emails-sysney',rowKey:'qa-email',json:JSON.stringify({status:'emitindo_documento',atualizadoEm:stamp,centavos:scenario==='changed'?1:d.centavos,descricao:d.descricao,fluxo:{nota:''},anexos:[]})});
  const job=await q.enqueue({empresa:'sysney',ambiente:'homologacao',workId:id,hash:work.hash,acao:'emitir'});
  const native=async r=>{
   if(r.acao==='verify')return {status:200,body:Buffer.from(JSON.stringify({xmlHash:hash(Buffer.from(r.xmlBase64,'base64')),schemaValid:true,signatureValid:true,chainValid:true}))};
   assert.equal(r.acao,'request');if(r.method==='POST')posts++;
   const response=await fetch(base+r.path,{method:r.method,...(r.body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(r.body)}:{})});return {status:response.status,contentType:response.headers.get('content-type'),body:Buffer.from(await response.arrayBuffer())};
  };
  await fetch(base+'/qa/mode?name=normal');
  await runNationalAdminJob({queueTable:table,documents,config:{paused:false,allowQueries:true,allowSend:scenario!=='disabled',emitentes:[{empresa:'sysney',ambiente:'homologacao',enabled:true,perfilHash:work.perfilHash}]},native,row:await q.get(job)});
  const result=(await q.result(job)).result;
  if(scenario==='valid'){assert.equal(posts,1);assert.equal(result.status,'confirmada');assert.ok(result.pdf);assert.equal(hash(Buffer.from(result.pdf,'base64')),result.pdfHash);}
  else{assert.equal(posts,0);assert.equal(result.status,'incerta');}
 }
});
test('fila nacional conserva hash/chunks e não aceita resposta parcial nem execução duplicada',async()=>{
 const table=memoryTable(),q=createNationalAdminQueue(table),id=await q.enqueue({acao:'consultar',workId:'a'.repeat(64)}),r=await q.get(id);
 await q.claim(r);await assert.rejects(q.claim(r));assert.equal((await q.result(id)).estado,'executando');
 await q.complete(id,{status:'confirmada',grande:'A'.repeat(70000)});assert.equal((await q.result(id)).result.grande.length,70000);
 const chunk=[...table.rows.values()].find(r=>r.partitionKey===`nacional-admin-resultado-${id}`);chunk.bytes=Buffer.from('adulterado').toString('base64');table.rows.set(chunk.partitionKey+'|'+chunk.rowKey,chunk);await assert.rejects(q.result(id));
});
test('cliente nacional HTTP/Postman: dois emitentes/ambientes, autorização, timeout e recuperação sem novo POST',{skip:!base},async()=>{
 assert.equal(new URL(base).hostname,'127.0.0.1');
 for(const [cnpj,ambiente] of [['12345678000199','homologacao'],['11111111000191','producao']]){
  const records=new Map();let allowed=true,posts=0;
  const xml=Buffer.from(montarDpsNacional({...d,cnpj},String(randomInt(1000,1000000000)),'2026-11-02T12:00:00-03:00',ambiente).xml);
  const client=createNationalAdminClient({cnpj,ambiente,ledger:{get:async id=>records.get(id),reserve:async r=>{if(records.has(r.idDps))throw Error('conflict');records.set(r.idDps,r);}},authorize:async()=>{if(!allowed)throw Error('APPROVAL_DENIED');},verifyOfficialXml:async({xml})=>({xmlHash:hash(xml),schemaValid:true,signatureValid:true,chainValid:true}),transport:async r=>{if(r.method==='POST')posts++;const response=await fetch(base+r.path,{method:r.method,...(r.body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(r.body)}:{}),signal:AbortSignal.timeout(150)});return {status:response.status,contentType:response.headers.get('content-type'),body:Buffer.from(await response.arrayBuffer())};}});
  await fetch(base+'/qa/mode?name=normal');allowed=false;await assert.rejects(client.submit({signedXml:xml,expectedXml:xml}),/APPROVAL_DENIED/);assert.equal(posts,0);
  allowed=true;await fetch(base+'/qa/mode?name=timeout-after-commit');const first=await client.submit({signedXml:xml,expectedXml:xml});assert.equal(first.status,'incerta');assert.equal(posts,1);
  const recovered=await client.submit({signedXml:xml,expectedXml:xml});assert.equal(recovered.status,'confirmada');assert.equal(recovered.fields.issuerDocument,cnpj);assert.equal(posts,1);assert.ok((await client.downloadPdf(recovered.fields.authorityKey)).length>100);
  await assert.rejects(client.submit({signedXml:Buffer.from(xml.toString().replace('3242.58','3242.59')),expectedXml:xml}),/EXPECTED_XML/);assert.equal(posts,1);
 }
 await fetch(base+'/qa/mode?name=normal');
});
