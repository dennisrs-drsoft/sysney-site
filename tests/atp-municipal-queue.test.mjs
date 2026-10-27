import {test} from 'node:test';
import assert from 'node:assert/strict';
import {memoryTable,args} from './helpers/atp-municipal-fixture.mjs';
import {buildAtpMunicipal} from '../admin-api/src/services/atp-municipal-model.mjs';
import {createAtpMunicipalStore} from '../admin-api/src/services/atp-municipal-store.mjs';
import {createAtpMunicipalQueueExecutor,runAtpMunicipalQueueJob} from '../admin-api/src/services/atp-municipal-queue.mjs';
import {digest} from '../admin-api/src/services/atp-fiscal-v1.mjs';
test('fila ATP segregada: on-demand CAS executa uma vez, preserva retorno e rejeita replay/expiração',async()=>{
 const table=memoryTable(),d=buildAtpMunicipal(args),workId=digest('queue'),calls=[];
 let clock=Date.parse('2026-10-27T15:00:00Z');
 const executor={async execute(p){calls.push(p.action);return {success:true,xml:Buffer.from('<Retorno>síntese CPF</Retorno>')};}};
 const queue=createAtpMunicipalQueueExecutor({table,enabled:true,now:()=>clock,timeoutMs:1000,wait:async()=>{
  const row=[...table.rows.values()].find(r=>r.partitionKey==='atp-municipal-executor-v1'&&r.rowKey.startsWith('work-')&&r.state==='queued');
  if(row){const jobId=row.rowKey.slice(5),results=await Promise.allSettled([runAtpMunicipalQueueJob({table,jobId,executor,enabled:true,now:()=>clock}),runAtpMunicipalQueueJob({table,jobId,executor,enabled:true,now:()=>clock})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);await assert.rejects(runAtpMunicipalQueueJob({table,jobId,executor,enabled:true,now:()=>clock}),/NOT_ELIGIBLE/);}clock+=100;
 }});
 const result=await queue.execute({workId,action:'emitir',xml:d.xml,chain:d.chain,approvedHash:d.hash,confirmed:true});assert.equal(result.xml.toString(),'<Retorno>síntese CPF</Retorno>');assert.deepEqual(calls,['emitir']);
 const store=createAtpMunicipalStore(table,{partitionKey:'atp-municipal-executor-v1'}),id=digest('expired');await store.create({workId:id,source:'ATP',state:'queued',deadline:clock-1,payload:{xml:d.xml,xmlHash:d.hash}});await assert.rejects(runAtpMunicipalQueueJob({table,jobId:id,executor,enabled:true,now:()=>clock}),/NOT_ELIGIBLE/);assert.equal(calls.length,1);
 await assert.rejects(runAtpMunicipalQueueJob({table,jobId:id,executor}),/DISABLED/);
});
