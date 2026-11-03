import {spawn} from 'node:child_process';
export function createNationalAdminNativeProcess(scriptPath){
 if(process.platform!=='win32'||typeof scriptPath!=='string'||!scriptPath.toLowerCase().startsWith('c:\\programdata\\sysney\\nfsenacional\\releases\\')||!scriptPath.endsWith('nacional-admin-native.ps1'))throw Error('NATIONAL_NATIVE_PATH');
 return async input=>new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',scriptPath],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let done=false,size=0;const chunks=[];
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(result);};
  const timer=setTimeout(()=>{child.kill();finish(Error('NATIONAL_NATIVE_TIMEOUT_CONSULT_DPS'));},60000);
  child.stdout.on('data',b=>{size+=b.length;if(size>12000000){child.kill();finish(Error('NATIONAL_NATIVE_RESPONSE_LIMIT'));}else chunks.push(b);});child.stderr.resume();
  child.on('error',()=>finish(Error('NATIONAL_NATIVE_UNAVAILABLE')));child.stdin.on('error',()=>finish(Error('NATIONAL_NATIVE_INPUT')));
  child.on('close',code=>{if(code!==0)return finish(Error('NATIONAL_NATIVE_FAILED_CONSULT_DPS'));try{const r=JSON.parse(Buffer.concat(chunks).toString());if(!Number.isInteger(r.status)||r.encoding!=='base64'||typeof r.body!=='string')throw Error();finish(null,{status:r.status,contentType:r.contentType||'',body:Buffer.from(r.body,'base64')});}catch{finish(Error('NATIONAL_NATIVE_INVALID_RESPONSE'));}});
  const payload=JSON.stringify(input);if(Buffer.byteLength(payload)>1500000){child.kill();finish(Error('NATIONAL_NATIVE_REQUEST_LIMIT'));return;}child.stdin.end(payload);
 });
}
