#!/usr/bin/env node
import {readFile,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {userInfo} from 'node:os';
import {DefaultAzureCredential} from '@azure/identity';
import {TableClient} from '@azure/data-tables';
import {BlobServiceClient} from '@azure/storage-blob';
import {createAtpFiscalStore} from '../src/services/atp-fiscal-store.mjs';
import {createWindowsNationalRestrictedRuntime} from '../src/services/national-restricted-runtime.mjs';
import {buildRestrictedDps,missingNationalConfiguration} from '../src/services/national-restricted-profile.mjs';

// Operator on-demand CLI. Import has no side effects. No service/task installation.
export async function runRestrictedCli(args,{env=process.env,readProfile=loadProfile,repositoryFactory=createAtpFiscalStore,runtimeFactory=createWindowsNationalRestrictedRuntime,actorId=()=>userInfo().username}={}){
 const [mode,...rest]=args;
 if(!['dry-run','prepare','run'].includes(mode)||rest.length%2)throw Error('INVALID_RUNNER_ARGUMENTS');
 const allowed=mode==='run'?['--work-id','--approved-hash','--confirm-restricted']:['--profile','--request-id','--emission-at'];
 const options={};for(let i=0;i<rest.length;i+=2){if(!allowed.includes(rest[i])||options[rest[i]]!==undefined)throw Error('INVALID_RUNNER_ARGUMENTS');options[rest[i]]=rest[i+1];}
 const account=env.ADMIN_STORAGE_ACCOUNT,environment=env.SYSNEY_NATIONAL_RESTRICTED_ENVIRONMENT;
 const missing=[];
 if(!/^[a-z0-9]{3,24}$/.test(account||''))missing.push('ADMIN_STORAGE_ACCOUNT');
 if(environment!=='homologacao')missing.push('SYSNEY_NATIONAL_RESTRICTED_ENVIRONMENT=homologacao');
 let profile;
 if(mode!=='run'){
  if(!options['--profile'])missing.push('--profile',...missingNationalConfiguration().map(f=>f.key));
  else{profile=await readProfile(options['--profile']);missing.push(...missingNationalConfiguration(profile).map(f=>f.key));}
  if(!/^[a-f0-9]{64}$/.test(options['--request-id']||''))missing.push('--request-id');
 }
 if(missing.length){if(mode==='dry-run')return {mode,ready:false,missing,transmitted:false,writes:false};throw Object.assign(Error('RUNNER_CONFIGURATION_MISSING'),{fields:missing});}
 if(mode!=='dry-run'&&env.SYSNEY_NATIONAL_RESTRICTED_RUNNER!=='true')throw Error('RESTRICTED_RUNNER_DISABLED');
 const repository=repositoryFactory(account);
 const emissionAt=options['--emission-at']||new Date(Date.now()-3*3600000).toISOString().slice(0,19)+'-03:00';
 if(mode==='dry-run'){
  const r=await repository.getRequest(options['--request-id']);
  if(!r||r.source!=='ATP'||r.status!=='pending_review'||r.reviewStatus!=='none')throw Error('REQUEST_NOT_ELIGIBLE');
  buildRestrictedDps({profile,request:r.input,number:'1',emissionAt});
  return {mode,ready:true,missing:[],transmitted:false,writes:false,nationalAdapterReady:false,next:'prepare'};
 }
 if(mode==='run'&&(!/^[a-f0-9]{64}$/.test(options['--work-id']||'')||!/^[a-f0-9]{64}$/.test(options['--approved-hash']||'')||options['--confirm-restricted']!=='SIM'||env.SYSNEY_ALLOW_NATIONAL_RESTRICTED_SEND!=='true'))throw Error('EXPLICIT_RESTRICTED_APPROVAL_REQUIRED');
 const credential=new DefaultAzureCredential();
 const runtime=runtimeFactory({repository,table:new TableClient(`https://${account}.table.core.windows.net`,'FiscalFila',credential),blobs:new BlobServiceClient(`https://${account}.blob.core.windows.net`,credential),environment});
 const actor={role:'administrador',id:actorId()};
 if(mode==='prepare'){
  const w=await runtime.prepare({requestId:options['--request-id'],profile,emissionAt,actor});
  return {mode,workId:w.workId,approvedHash:w.signedHash,idDps:w.idDps,transmitted:false,nationalAdapterReady:false};
 }
 return runtime.run({workId:options['--work-id'],actor,approvedHash:options['--approved-hash'],explicitRestrictedApproval:true});
}
async function loadProfile(path){
 const info=await stat(path);if(!info.isFile()||info.size>65536)throw Error('PROFILE_FILE_INVALID');
 const profile=JSON.parse(await readFile(path,'utf8'));
 if(!profile||typeof profile!=='object'||Array.isArray(profile))throw Error('PROFILE_FILE_INVALID');return profile;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await runRestrictedCli(process.argv.slice(2))));}
 catch(error){console.error(JSON.stringify({error: /^[A-Z_]+$/.test(error.message)?error.message:'RESTRICTED_RUNNER_FAILED_CONSULT_BEFORE_REPEAT',...(Array.isArray(error.fields)?{missing:error.fields}:{}),productionIssued:false}));process.exitCode=1;}
}
