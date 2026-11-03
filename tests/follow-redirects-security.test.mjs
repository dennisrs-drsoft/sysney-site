import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),follow=require('follow-redirects');
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
const close=s=>new Promise(resolve=>s.close(resolve));
test('redirecionamento entre origens remove credencial sintética mesmo com sensitiveHeaders de outro contexto JS',async()=>{
 let received;
 const target=createServer((req,res)=>{received=req.headers;res.writeHead(200,{'Content-Type':'text/plain'});res.end('QA');});
 await listen(target);
 const start=createServer((req,res)=>{res.writeHead(302,{Location:`http://127.0.0.1:${target.address().port}/destino`});res.end();});
 await listen(start);
 try{
  const names=vm.runInNewContext("['X-QA-Credential']");assert.equal(Array.isArray(names),true);assert.equal(names instanceof Array,false);
  await new Promise((resolve,reject)=>{
   const request=follow.http.get(`http://127.0.0.1:${start.address().port}/inicio`,{maxRedirects:3,sensitiveHeaders:names,headers:{'X-QA-Credential':'SINTETICO-SEM-VALOR','X-Harmless':'preservado',Authorization:'Bearer QA',Cookie:'qa=1'}},res=>{res.resume();res.on('end',resolve);});
   request.setTimeout(3000,()=>request.destroy(Error('Timeout local QA')));request.on('error',reject);
  });
  assert.equal(received['x-qa-credential'],undefined);assert.equal(received.authorization,undefined);assert.equal(received.cookie,undefined);assert.equal(received['x-harmless'],'preservado');
 }finally{await Promise.all([close(start),close(target)]);}
});
