import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createNationalRestrictedClient,unpackNationalXml} from '../admin-api/src/services/national-restricted-client.mjs';
const base=process.env.NATIONAL_SIM_BASE;
test('cliente nacional real em HTTP/Postman: envio, timeout apos commit, recuperacao e falhas',{skip:!base},async()=>{
 const url=new URL(base);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.protocol,'http:');
 const records=new Map(),ledger={get:async id=>records.get(id),reserve:async r=>{if(records.has(r.idDps))throw Error('Duplicado');records.set(r.idDps,r);}};
 const transport=async r=>{assert.equal(r.environment,'homologacao');const response=await fetch(base+r.path,{method:r.method,headers:{'Content-Type':'application/json'},...(r.body?{body:JSON.stringify(r.body)}:{}),signal:AbortSignal.timeout(150)});return {status:response.status,body:Buffer.from(await response.arrayBuffer()),contentType:response.headers.get('content-type')};};
 const client=createNationalRestrictedClient({transport,ledger}),xml=Buffer.from(await readFile(new URL('../postman/fixtures/dps-restrita.synthetic.xml',import.meta.url),'utf8')),idDps=xml.toString().match(/Id="(DPS\d+)"/)[1];
 const mode=async name=>{const r=await fetch(base+'/qa/mode?name='+name);assert.equal(r.status,200);return r.json();};
 const before=(await mode('normal')).posts;
 const first=await client.submit({idDps,signedXml:xml,explicitRestrictedApproval:true});assert.equal(first.status,'confirmed_restricted');
 assert.equal((await client.submit({idDps,signedXml:xml,explicitRestrictedApproval:true})).status,'confirmed_restricted');
 assert.equal((await mode('normal')).posts,before+1);
 await assert.rejects(client.submit({idDps,signedXml:Buffer.from(xml.toString()+' '),explicitRestrictedApproval:true}),{code:'DPS_CONTENT_CONFLICT'});
 const secondId=idDps.slice(0,-1)+'2',secondXml=Buffer.from(xml.toString().replaceAll(idDps,secondId));
 await mode('timeout-after-commit');const uncertain=await client.submit({idDps:secondId,signedXml:secondXml,explicitRestrictedApproval:true});assert.equal(uncertain.status,'uncertain');
 assert.equal((await client.submit({idDps:secondId,signedXml:secondXml,explicitRestrictedApproval:true})).status,'confirmed_restricted');
 assert.equal((await mode('normal')).posts,before+2);
 assert.equal((await client.downloadPdf(first.chaveAcesso)).subarray(0,5).toString(),'%PDF-');
 await mode('pdf-corrupt');await assert.rejects(client.downloadPdf(first.chaveAcesso),{code:'INVALID_PDF'});await mode('normal');assert.equal((await mode('normal')).posts,before+2);
 assert.equal(await client.consultEvent(first.chaveAcesso,'101101',1),null); // ausência específica não comprova situação global
 await mode('wrong-environment');await assert.rejects(client.consultInvoice(first.chaveAcesso),{code:'WRONG_ENVIRONMENT'});
 await mode('html');await assert.rejects(client.consultInvoice(first.chaveAcesso),{code:'NATIONAL_HTTP_ERROR'});
 await mode('hang');await assert.rejects(client.consultInvoice(first.chaveAcesso));
 await mode('normal');assert.throws(()=>unpackNationalXml('nao-base64'),{code:'INVALID_XML_ENCODING'});
});
