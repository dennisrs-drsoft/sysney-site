import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
function createWindowsProcess(scriptName){
 return async input=>{
  if(process.platform!=='win32'||input.environment!=='homologacao')throw Error('WINDOWS_RESTRICTED_TRANSPORT_REQUIRED');
  const script=fileURLToPath(new URL('../../scripts/'+scriptName,import.meta.url));
  return new Promise((resolve,reject)=>{
   const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{windowsHide:true,stdio:['pipe','pipe','pipe']});
   let size=0,settled=false;const chunks=[];
   const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve(value);};
   const timer=setTimeout(()=>{child.kill();finish(Error('RESTRICTED_TRANSPORT_TIMEOUT_CONSULT_DPS'));},45000);
   child.stdout.on('data',chunk=>{size+=chunk.length;if(size>7_000_000){child.kill();finish(Error('RESTRICTED_RESPONSE_LIMIT'));}else chunks.push(chunk);});
   // Nunca registrar stderr/XML/chaves. A falha não autoriza repetir transmissão.
   child.stderr.resume();child.on('error',()=>finish(Error('RESTRICTED_TRANSPORT_UNAVAILABLE')));
   child.on('close',code=>{if(code!==0)return finish(Error('RESTRICTED_TRANSPORT_FAILED_CONSULT_DPS'));try{const r=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(r.encoding!=='base64'||!Number.isInteger(r.status))throw Error();finish(null,{status:r.status,body:Buffer.from(r.body,'base64'),contentType:r.contentType||''});}catch{finish(Error('RESTRICTED_TRANSPORT_INVALID_RESPONSE'));}});
   child.stdin.on('error',()=>finish(Error('RESTRICTED_TRANSPORT_INPUT_FAILED')));child.stdin.end(JSON.stringify(input));
  });
 };
}
export const createWindowsRestrictedTransport=()=>createWindowsProcess('transportar-nacional-restrita.ps1');
export function createWindowsRestrictedSigner(){
 const run=createWindowsProcess('assinar-dps-stdin.ps1');
 return async xml=>{
  if(!Buffer.isBuffer(xml)||xml.length>1_000_000)throw Error('INVALID_DPS_BYTES');
  const r=await run({environment:'homologacao',xmlBase64:xml.toString('base64')});
  if(r.status!==200||r.body.length>1_000_000)throw Error('NATIVE_SIGNING_FAILED');return r.body;
 };
}
