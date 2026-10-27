import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {createAtpFiscalHandler} from '../../admin-api/src/services/atp-fiscal-v1.mjs';

// Harness sintético: não importa SDK Azure, certificado, emissão ou envio de e-mail.
export async function startSyntheticFiscalServer({token,port=0}={}){
 if(typeof token!=='string'||token.length<43)throw Error('Configure token sintético >=43 caracteres.');
 const rows=new Map(),refs=new Map();
 const store={
  get:async id=>structuredClone(rows.get(id)),
  byReference:async ref=>structuredClone(rows.get(refs.get(ref))),
  create:async r=>{if(rows.has(r.id)||refs.has(r.input.externalReference))throw Object.assign(Error('Conflito'),{statusCode:409});rows.set(r.id,{...structuredClone(r),etag:'1'});refs.set(r.input.externalReference,r.id);},
  replace:async(r,etag)=>{if(rows.get(r.id)?.etag!==etag)throw Object.assign(Error('Concorrencia'),{statusCode:412});rows.set(r.id,{...structuredClone(r),etag:String(Number(etag)+1)});},
  download:async()=>{throw Error('Harness não possui documentos fiscais oficiais.');},
 };
 const handler=createAtpFiscalHandler({config:()=>({enabled:'true',token}),storeFactory:()=>store});
 const base='/api/integracoes/atp/v1/solicitacoes-fiscais';
 const server=createServer(async(incoming,outgoing)=>{
  try{
   const url=new URL(incoming.url,'http://127.0.0.1'),suffix=url.pathname.startsWith(base)?url.pathname.slice(base.length):null;
   const params={};let valid=suffix==='';
   if(suffix){const match=suffix.match(/^\/([a-f0-9]{64})(?:\/(revisao-estorno)|\/documentos\/(xml|pdf))?$/);if(match){valid=true;params.id=match[1];if(match[2])params.action=match[2];if(match[3])params.format=match[3];}}
   if(!valid){outgoing.writeHead(404);outgoing.end();return;}
   const method=incoming.method,body=['GET','HEAD'].includes(method)?undefined:incoming;
   const request=new Request(url,{method,headers:incoming.headers,...(body?{body,duplex:'half'}:{})});request.params=params;
   const result=await handler(request);outgoing.writeHead(result.status,result.headers);
   outgoing.end(result.body??JSON.stringify(result.jsonBody));
  }catch{outgoing.writeHead(500);outgoing.end('Erro no harness sintético.');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {store,baseUrl:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const token=process.env.ATP_FISCAL_SYNTHETIC_TOKEN;
 // Consumidor e harness recebem o mesmo token descartável pelo ambiente.
 if(!token)throw Error('Defina ATP_FISCAL_SYNTHETIC_TOKEN somente para teste local.');
 const s=await startSyntheticFiscalServer({token,port:Number(process.env.PORT||4319)});
 console.log(`Harness ATP sintético em ${s.baseUrl}; memória volátil; sem Azure/emissão/documentos oficiais.`);
}
