import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readAtpMunicipalReadiness} from '../admin-api/src/services/atp-municipal-readiness.mjs';
test('worker isolado exige pausa e dois gates privados antes de permitir emissão',async()=>{
 const source=await readFile(new URL('../admin-api/scripts/iniciar-atp-municipal-worker.ps1',import.meta.url),'utf8');
 assert.match(source,/SYSNEY-ATP-Municipal-Isolado/);assert.match(source,/config\.paused -eq \$true -or \$config\.allowFiscalCalls -ne \$true/);assert.match(source,/config\.automationEnabled -eq \$true -and \$config\.issuanceEnabled -eq \$true/);assert.match(source,/finally\{foreach/);
 assert.doesNotMatch(source,/ATP_MUNICIPAL_ISSUANCE_ENABLED','true'|Register-ScheduledTask|Start-Service|Set-Acl|New-NetFirewallRule|Invoke-WebRequest|Invoke-RestMethod/);
 assert.match(source,/Get-AuthenticodeSignature/);assert.match(source,/runnerSha256/);
});
test('readiness só enumera as partições ATP e retorna contagens sem dados de cliente',async()=>{
 const seen=[],table=n=>({async *listEntities({queryOptions}){seen.push(queryOptions.filter);for(let i=0;i<n;i++)yield {json:'PRIVATE CLIENT DATA'};}});
 const r=await readAtpMunicipalReadiness({queue:table(0),documents:table(0)});assert.equal(r.queueJobs,0);assert.equal(r.preparations,0);assert.equal(r.storageWrites,false);assert.equal(r.transmitted,false);assert.equal(seen.length,2);assert.ok(seen.every(x=>x.includes('atp')));assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
});
