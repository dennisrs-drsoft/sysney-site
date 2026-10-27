import {createServer} from 'node:http';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {TableClient,TableServiceClient} from '@azure/data-tables';
import {BlobServiceClient} from '@azure/storage-blob';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createAtpFiscalRepository} from '../../admin-api/src/services/atp-fiscal-store.mjs';
import {createAtpFiscalHandler,digest} from '../../admin-api/src/services/atp-fiscal-v1.mjs';
import {createAtpMunicipalStore} from '../../admin-api/src/services/atp-municipal-store.mjs';
import {createAtpAutomationStore} from '../../admin-api/src/services/atp-municipal-automation-store.mjs';
import {createAtpMunicipalAutomation} from '../../admin-api/src/services/atp-municipal-automation.mjs';
import {saoPauloFiscalDate} from '../../admin-api/src/services/atp-municipal-workflow.mjs';
import {createAtpMunicipalQueueExecutor,runNextAtpMunicipalQueueJob} from '../../admin-api/src/services/atp-municipal-queue.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const same=(a,b)=>timingSafeEqual(Buffer.from(digest(a)),Buffer.from(digest(b)));
export async function startAtpAutomationHarness({token,port=0,azuritePackage=process.env.ATP_AZURITE_PACKAGE,blobPort=11010,tablePort=11012,now=()=>new Date().toISOString()}={}){
 if(typeof token!=='string'||token.length<43||!azuritePackage)throw Error('QA_CONFIG_REQUIRED');
 const constants=await import(pathToFileURL(azuritePackage+'/dist/src/common/utils/constants.js'));
 const name=constants.EMULATOR_ACCOUNT_NAME,key=Buffer.from(constants.EMULATOR_ACCOUNT_KEY).toString('base64');
 if(name!=='devstoreaccount1'||![blobPort,tablePort].every(p=>Number.isInteger(Number(p))&&p>=1024&&p<=65535))throw Error('QA_LOOPBACK_ONLY');
 const connection=`DefaultEndpointsProtocol=http;AccountName=${name};AccountKey=${key};TableEndpoint=http://127.0.0.1:${tablePort}/${name};BlobEndpoint=http://127.0.0.1:${blobPort}/${name};`;
 const id=randomUUID().replaceAll('-',''),docsName='AtpAutoDocsQa'+id,queueName='AtpAutoQueueQa'+id,containerName='atpautoqa'+id;
 const service=TableServiceClient.fromConnectionString(connection,{allowInsecureConnection:true}),table=n=>TableClient.fromConnectionString(connection,n,{allowInsecureConnection:true});
 const docs=table(docsName),queue=table(queueName),container=BlobServiceClient.fromConnectionString(connection).getContainerClient(containerName);
 await service.createTable(docsName);await service.createTable(queueName);await container.create();
 const repository=createAtpFiscalRepository({table:docs,blobs:{getContainerClient:n=>{if(n!=='admin-anexos')throw Error('QA_CONTAINER_SCOPE');return container;}}});
 const works=createAtpMunicipalStore(docs),jobs=createAtpAutomationStore(docs,{now:()=>Date.parse(now())}),records=new Map(),modes=new Map();
 const stats={tests:0,emissions:0,queries:0,pdfDownloads:0},govToken=randomBytes(48).toString('hex');let baseUrl,automation,defaultMode='normal';
 const mode=id=>modes.get(id)||defaultMode;
 const handler=createAtpFiscalHandler({storeFactory:()=>repository,config:()=>({enabled:'true',token}),now});
 const body=async req=>{const parts=[];let n=0;for await(const b of req){n+=b.length;if(n>64000)throw Error('QA_BODY_LIMIT');parts.push(b);}return JSON.parse(Buffer.concat(parts).toString()||'{}');};
 const reply=(res,status,value,type='application/json')=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(Buffer.isBuffer(value)?value:JSON.stringify(value));};
 const makeReturn=record=>{
  const r=record.rps,k=r.ChaveRPS,kind=r.CPFCNPJTomador.CPF?'CPF':'CNPJ',doc=r.CPFCNPJTomador[kind],cancelled=mode(record.requestId)==='cancelled',stamp=now();
  const number=mode(record.requestId)==='substituted'?String(BigInt(record.number)+10000n):record.number;
  return `<p:RetornoConsulta xmlns:p="http://www.prefeitura.sp.gov.br/nfe"><Cabecalho Versao="1"><Sucesso>true</Sucesso></Cabecalho><NFe><ChaveNFe><InscricaoPrestador>${k.InscricaoPrestador}</InscricaoPrestador><NumeroNFe>${number}</NumeroNFe><CodigoVerificacao>${record.verification}</CodigoVerificacao></ChaveNFe><DataEmissaoNFe>${record.authorized}</DataEmissaoNFe><DataFatoGeradorNFe>${r.DataEmissao}T12:00:00-03:00</DataFatoGeradorNFe><ChaveRPS><InscricaoPrestador>${k.InscricaoPrestador}</InscricaoPrestador><SerieRPS>${k.SerieRPS}</SerieRPS><NumeroRPS>${k.NumeroRPS}</NumeroRPS></ChaveRPS><DataEmissaoRPS>${r.DataEmissao}</DataEmissaoRPS><CPFCNPJPrestador><CNPJ>57767099000179</CNPJ></CPFCNPJPrestador><StatusNFe>${cancelled?'C':'N'}</StatusNFe>${cancelled?`<DataCancelamento>${stamp}</DataCancelamento>`:''}<TributacaoNFe>T</TributacaoNFe><OpcaoSimples>4</OpcaoSimples><ValorServicos>${r.ValorServicos}</ValorServicos><CodigoServico>03158</CodigoServico><ISSRetido>false</ISSRetido><CPFCNPJTomador><${kind}>${doc}</${kind}></CPFCNPJTomador><Discriminacao>${escape(r.Discriminacao)}</Discriminacao></NFe></p:RetornoConsulta>`;
 };
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname.startsWith('/qa/gov/')){
    if(!same(req.headers['x-qa-government-token']||'',govToken))return reply(res,401,{error:'QA_UNAUTHORIZED'});
    if(url.pathname==='/qa/gov/fiscal'){
     const p=await body(req);if(XMLValidator.validate(p.xml)!==true||/<!/.test(p.xml))throw Error('QA_XML_INVALID');
     const parsed=new XMLParser({ignoreAttributes:false,parseTagValue:false}).parse(p.xml),root=parsed[Object.keys(parsed).find(k=>!k.startsWith('?'))],r=root.RPS,keyRps=r?.ChaveRPS||root.Detalhe?.ChaveRPS;
     if(!keyRps)throw Error('QA_RPS_REQUIRED');const key=JSON.stringify(keyRps),work=await works.get(p.workId);
     if(p.action==='testar'){stats.tests++;return reply(res,200,{success:true,xml:'<RetornoEnvioLoteRPS><Cabecalho><Sucesso>true</Sucesso></Cabecalho></RetornoEnvioLoteRPS>'});}
     if(p.action==='emitir'){
      stats.emissions++;if(records.has(key))return reply(res,409,{error:'QA_DUPLICATE_EMIT'});
      const record={requestId:work.requestId,rps:r,number:String(9000000+records.size+1),verification:('QA'+String(records.size+1).padStart(6,'0')),authorized:now()};records.set(key,record);
      if(mode(work.requestId)==='timeout'){res.destroy();return;}return reply(res,200,{success:true,xml:'<Acknowledgement/>'});
     }
     if(p.action==='consultar'){stats.queries++;const record=records.get(key);if(!record)return reply(res,404,{error:'QA_RPS_NOT_FOUND'});return reply(res,200,{success:true,xml:(mode(record.requestId)==='query-format-changed'?'\n':'')+makeReturn(record)});}
     throw Error('QA_ACTION_INVALID');
    }
    const record=[...records.values()].find(r=>String(r.number)===url.searchParams.get('number'));
    if(!record)return reply(res,404,{error:'QA_DOCUMENT_MISSING'});stats.pdfDownloads++;
    if(mode(record.requestId)==='pdf-unavailable')return reply(res,503,{error:'QA_PDF_UNAVAILABLE'});
    const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),doc=record.rps.CPFCNPJTomador.CPF||record.rps.CPFCNPJTomador.CNPJ,amount=Number(record.rps.ValorServicos).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    pdf.addPage().drawText(`DOCUMENTO SINTETICO SEM VALIDADE FISCAL\nNumero da NFS-e: ${record.number}\n${record.verification} 57767099000179 ${mode(record.requestId)==='pdf-wrong'?'00000000000':doc}\nR$ ${amount}`,{x:20,y:700,size:10,font});
    return reply(res,200,Buffer.from(await pdf.save({useObjectStreams:false})),'application/pdf');
   }
   if(url.pathname.startsWith('/qa/')){
    if(!same(req.headers.authorization||'','Bearer '+token))return reply(res,401,{error:'QA_UNAUTHORIZED'});
    if(url.pathname==='/qa/stats')return reply(res,200,{...stats,invoices:records.size,mode:defaultMode,clockUtc:now(),notBeforeUtc:policy.notBeforeUtc,storage:'azurite-loopback',production:false});
    if(url.pathname==='/qa/job')return reply(res,200,await jobs.get(url.searchParams.get('requestId'))||{state:'missing'});
    if(url.pathname==='/qa/mode'&&req.method==='POST'){const b=await body(req);if(!['normal','timeout','pdf-unavailable','pdf-wrong','cancelled','substituted','query-format-changed'].includes(b.name))return reply(res,400,{error:'QA_MODE_INVALID'});if(b.requestId)modes.set(b.requestId,b.name);else defaultMode=b.name;return reply(res,200,{mode:b.name,requestId:b.requestId||null});}
    if(url.pathname==='/qa/tick'&&req.method==='POST'){const b=await body(req),steps=Math.max(1,Math.min(12,b.steps||1)),concurrency=Math.max(1,Math.min(4,b.concurrency||1)),results=[];for(let i=0;i<steps;i++)results.push(...await Promise.all(Array.from({length:concurrency},()=>automation.tick({limit:20}))));return reply(res,200,{results});}
    return reply(res,404,{error:'QA_NOT_FOUND'});
   }
   const prefix='/api/integracoes/atp/v1/solicitacoes-fiscais',suffix=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):null,params={};
   if(suffix===null)return reply(res,404,{error:'NOT_FOUND'});
   if(suffix){const m=suffix.match(/^\/([a-f0-9]{64})(?:\/(revisao-estorno)|\/documentos\/(xml|pdf))?$/);if(!m)return reply(res,404,{error:'NOT_FOUND'});params.id=m[1];if(m[2])params.action=m[2];if(m[3])params.format=m[3];}
   const request=new Request(new URL(req.url,baseUrl),{method:req.method,headers:req.headers,...(req.method==='POST'?{body:req,duplex:'half'}:{})});request.params=params;
   const r=await handler(request);res.writeHead(r.status,r.headers);res.end(r.body??JSON.stringify(r.jsonBody));
  }catch{if(!res.destroyed)reply(res,500,{error:'QA_OPERATION_FAILED'});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});baseUrl=`http://127.0.0.1:${server.address().port}`;
 const transport={kind:'loopback_standin',async execute(p){const r=await fetch(baseUrl+'/qa/gov/fiscal',{method:'POST',headers:{'x-qa-government-token':govToken,'content-type':'application/json'},body:JSON.stringify(p)});if(!r.ok)throw Error('QA_GOV_UNCONFIRMED');const v=await r.json();return {...v,xml:Buffer.from(v.xml)};},async downloadPdf(e){const r=await fetch(baseUrl+'/qa/gov/pdf?number='+encodeURIComponent(e.number),{headers:{'x-qa-government-token':govToken}});if(!r.ok)throw Error('QA_PDF_UNAVAILABLE');return Buffer.from(await r.arrayBuffer());}};
 const queued=createAtpMunicipalQueueExecutor({table:queue,enabled:true,downloadPdf:e=>transport.downloadPdf(e),wait:async()=>{await runNextAtpMunicipalQueueJob({table:queue,executor:transport,enabled:true,authorizeAutomation:async p=>{const r=await repository.get(p.automation.requestId),j=await jobs.get(r.id);if(r.reviewStatus!=='none'||r.hash!==p.automation.requestHash||j.claimId!==p.automation.leaseClaimId||j.fence!==p.automation.leaseFence)throw Error('QA_REFUND_OR_FENCE_CHANGED');}});}});queued.kind='loopback_standin';
 const day=saoPauloFiscalDate(now()),policy={mode:'simulation',automationEnabled:true,issuanceEnabled:false,nationalEnabled:false,approved:true,exclusiveSeriesConfirmed:true,series:'ATPQA',initialNumber:'1',notBeforeUtc:day+'T00:00:00Z',recheckMs:0,pdfRetryMs:0,profile:{version:'QA-AUTOMATION-SEM-VALIDADE',issuer:{cnpj:'57767099000179',inscricao:'15539300'},regime:'simples',codigoServico:'03158',municipioPrestacao:'3550308',aliquota:'0',issRetido:false}};
 automation=createAtpMunicipalAutomation({repository,works,jobs,executor:queued,config:policy,simulationScope:{endpoint:baseUrl,storage:'azurite-loopback'},now});
 return {baseUrl,repository,works,jobs,stats,policy,automation,async close(){await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await container.delete();await service.deleteTable(docsName);await service.deleteTable(queueName);}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const token=await readFile(process.env.ATP_AUTOMATION_QA_TOKEN_FILE,'utf8');
 const clock=process.env.ATP_AUTOMATION_QA_CLOCK;
 if(clock&&!Number.isFinite(Date.parse(clock)))throw Error('QA_CLOCK_INVALID');
 const h=await startAtpAutomationHarness({token,port:4327,...(clock?{now:()=>clock}: {})});console.log(JSON.stringify({url:h.baseUrl,mode:'simulation',clockUtc:clock||'system',storage:'azurite-loopback',production:false}));
 let closing=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;await h.close();process.exit(0);});
}
