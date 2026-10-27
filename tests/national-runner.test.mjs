import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runRestrictedCli} from '../admin-api/scripts/nacional-restrita.mjs';
const request=JSON.parse(await readFile(new URL('../postman/fixtures/atp-fiscal-v1.synthetic.json',import.meta.url)));
test('runner dry-run lista nomes exatos sem storage, assinatura ou POST quando incompleto',async()=>{
 const result=await runRestrictedCli(['dry-run','--profile','private.json','--request-id','a'.repeat(64)],{env:{},readProfile:async()=>({}),repositoryFactory:()=>{throw Error('Storage must not be touched');},runtimeFactory:()=>{throw Error('No runtime');}});
 assert.equal(result.writes,false);assert.equal(result.transmitted,false);assert.ok(result.missing.includes('service.cTribNac'));assert.ok(result.missing.includes('ADMIN_STORAGE_ACCOUNT'));
});
test('runner dry-run completo apenas le e valida; producao e run sem aprovacao recusados',async()=>{
 const profile={issuer:{opSimpNac:'3',regApTribSN:'1',regEspTrib:'0'},service:{cTribNac:'010101',tribISSQN:'1',tpRetISSQN:'1',totTrib:{kind:'indTotTrib',value:'0'}},dps:{serie:'99'}}; // arbitrary test profile; no network
 const dependencies={env:{ADMIN_STORAGE_ACCOUNT:'fakeqa',SYSNEY_NATIONAL_RESTRICTED_ENVIRONMENT:'homologacao'},readProfile:async()=>profile,repositoryFactory:()=>({getRequest:async()=>({source:'ATP',status:'pending_review',reviewStatus:'none',input:request})}),runtimeFactory:()=>{throw Error('Dry run must not create runtime');}};
 const args=['dry-run','--profile','private.json','--request-id','a'.repeat(64)];
 assert.equal((await runRestrictedCli(args,dependencies)).ready,true);
 const wrong=await runRestrictedCli(args,{...dependencies,env:{...dependencies.env,SYSNEY_NATIONAL_RESTRICTED_ENVIRONMENT:'producao'}});assert.equal(wrong.ready,false);
 await assert.rejects(runRestrictedCli(['run','--work-id','a'.repeat(64)],{...dependencies,env:{...dependencies.env,SYSNEY_NATIONAL_RESTRICTED_RUNNER:'true'}}),/EXPLICIT_RESTRICTED_APPROVAL_REQUIRED/);
});
