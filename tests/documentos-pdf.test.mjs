import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createHash} from 'node:crypto';
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
let source=ts.transpileModule(readFileSync(new URL('../lib/documentos-pdf.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
for(const [name,code] of Object.entries({'@azure/identity':'export class DefaultAzureCredential {}','@azure/data-tables':`export class TableClient {constructor(u,n){this.name=n}async getEntity(p,r){const v=globalThis.pdfDB.records.get(this.name+':'+p+':'+r);if(!v)throw Error('missing');return structuredClone(v)}async updateEntity(e,m,o){const k=this.name+':'+e.partitionKey+':'+e.rowKey,v=globalThis.pdfDB.records.get(k);if(v.etag!==o.etag)throw Object.assign(Error('conflict'),{statusCode:412});globalThis.pdfDB.records.set(k,{...e,etag:String(Number(v.etag)+1)});globalThis.pdfDB.writes++;}}`,'@azure/storage-blob':`export class BlobServiceClient {getContainerClient(){return {getBlockBlobClient:()=>({uploadData:async()=>{globalThis.pdfDB.uploads++;if(globalThis.pdfDB.race)globalThis.pdfDB.race();}})}}}`,'./cobrancas':'export const hojeBrasil=()=>"2026-10-03";'}))source=source.replaceAll(JSON.stringify(name),JSON.stringify(uri(code)));
const {validarPdfOficial,urlPdfNotaSP,baixarPdfNotaSP,conferirNotaParaPdf,recuperarPdfNotaSP}=await import(uri(source));
const pdf=Buffer.from('%PDF-1.7\n'+ 'x'.repeat(150)+'\n%%EOF');
test('PDF oficial rejeita HTML, arquivo incompleto e tamanho excessivo',()=>{
 assert.deepEqual(validarPdfOficial(pdf),pdf);
 for(const bytes of [Buffer.from('<html>login</html>'),Buffer.from('%PDF-1.7'+ 'x'.repeat(150)),Buffer.alloc(5000001)])assert.throws(()=>validarPdfOficial(bytes),/PDF oficial/);
});
test('endereço de download restrito à Prefeitura, sem emissão ou e-mail',()=>{
 const u=urlPdfNotaSP('12345678','1','ABCD1234');
 assert.equal(u.origin,'https://nfe.prefeitura.sp.gov.br');
 assert.equal(u.pathname,'/contribuinte/notaprintpdf.aspx');
 assert.equal(u.searchParams.get('email'),null);
 for(const valores of [['https://host','1','ABCD1234'],['12345678','1&email=1','ABCD1234'],['12345678','1','ABCD1234&x=1']])assert.throws(()=>urlPdfNotaSP(...valores));
});
test('download não aceita página de erro nem redirecionamento e faz somente GET',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async(u,op)=>{assert.equal(op.redirect,'error');assert.equal(op.method,undefined);return new Response(pdf,{headers:{'Content-Type':'application/pdf'}});};
  assert.deepEqual(await baixarPdfNotaSP('12345678','1','ABCD1234'),pdf);
  globalThis.fetch=async()=>new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}});
  await assert.rejects(baixarPdfNotaSP('12345678','1','ABCD1234'),/não disponibilizou/);
  globalThis.fetch=async()=>new Response(pdf,{headers:{'Content-Type':'application/pdf','Content-Length':'5000001'}});
  await assert.rejects(baixarPdfNotaSP('12345678','1','ABCD1234'),/não disponibilizou/);
 }finally{globalThis.fetch=original;}
});
test('anexação exige resultado fiscal real correspondente à cobrança',()=>{
 const email={id:'e',empresa:'sysney',competencia:'2026-10',centavos:10000,descricao:'Serviço',po:'123',fluxo:{nota:'1'}};
 const job={emailId:'e',status:'emitida',dados:{empresa:'sysney',centavos:10000,competencia:'2026-10',descricao:'Serviço',po:'123',inscricao:'12345678',clienteDocumento:'12345678000199'},resultado:{sucesso:true,teste:false,numero:'1',verificacao:'ABCD1234',inscricao:'12345678',tomador:'12345678000199',valorFinal:'100.00',descricao:'Serviço\nPO 123'}};
 assert.equal(conferirNotaParaPdf(email,job).numero,'1');
 for(const alteracao of [{teste:true},{tomador:'99999999000199'},{numero:'2'},{valorFinal:'99'},{descricao:'Outro serviço'}])assert.throws(()=>conferirNotaParaPdf(email,{...job,resultado:{...job.resultado,...alteracao}}),/não correspondem/);
 assert.throws(()=>conferirNotaParaPdf({...email,po:'456'},job),/não correspondem/);
 assert.throws(()=>conferirNotaParaPdf(email,{...job,status:'incerta'}),/não correspondem/);
});
test('recuperação anexa uma única vez, revoga aprovação e preserva emissão/envio',async()=>{
 const original=globalThis.fetch;
 const email={id:'e',empresa:'sysney',competencia:'2026-10',centavos:10000,descricao:'Serviço',po:'123',fluxo:{nota:'1',cobrancaId:'c',documentos:{por:'teste'}},anexos:[],status:'revisado',atualizadoEm:'v1',aprovacaoEnvio:{por:'teste'},tentativas:[]};
 const job={id:'job',emailId:'e',status:'emitida',dados:{empresa:'sysney',centavos:10000,competencia:'2026-10',descricao:'Serviço',po:'123',inscricao:'12345678',clienteDocumento:'12345678000199'},resultado:{sucesso:true,teste:false,numero:'1',verificacao:'ABCD1234',inscricao:'12345678',tomador:'12345678000199',valorFinal:'100.00',descricao:'Serviço\nPO 123'}};
 const chave=createHash('sha256').update('12345678000199:2026-10').digest('hex');
 const setup=()=>{globalThis.pdfDB={records:new Map(),writes:0,uploads:0};for(const [k,v] of Object.entries({'AdminDocumentos:emails-sysney:e':email,'AdminDocumentos:cobrancas-sysney:c':{id:'c',planoId:'p',nota:'1',centavos:10000,competencia:'2026-10',eventos:[]},'AdminConfiguracoes:cobrancas-sysney:p':{documento:'12345678000199'},['AdminDocumentos:nfse-sp-sysney:'+chave]:job}))globalThis.pdfDB.records.set(k,{json:JSON.stringify(v),etag:'1'});};
 try {
  setup();globalThis.fetch=async()=>new Response('<html>erro</html>',{headers:{'Content-Type':'text/html'}});
  await assert.rejects(recuperarPdfNotaSP('sysney','e','v1'));assert.equal(globalThis.pdfDB.writes,0);
  globalThis.fetch=async()=>new Response(pdf,{headers:{'Content-Type':'application/pdf'}});
  const primeiro=await recuperarPdfNotaSP('sysney','e','v1');assert.equal(primeiro.email.anexos.length,1);assert.equal(primeiro.email.status,'rascunho');assert.equal(primeiro.email.aprovacaoEnvio,undefined);assert.equal(primeiro.email.fluxo.documentos,undefined);assert.equal(primeiro.email.tentativas.length,0);
  const writes=globalThis.pdfDB.writes;await recuperarPdfNotaSP('sysney','e');assert.equal(globalThis.pdfDB.writes,writes);assert.equal(globalThis.pdfDB.uploads,1);
  await assert.rejects(recuperarPdfNotaSP('sysney','e','v1'),/mudou/);
  setup();globalThis.pdfDB.race=()=>{const row=globalThis.pdfDB.records.get('AdminDocumentos:emails-sysney:e');row.etag='2';row.json=JSON.stringify({...email,status:'enviando'});};
  await assert.rejects(recuperarPdfNotaSP('sysney','e','v1'),/conflict/);assert.equal(JSON.parse(globalThis.pdfDB.records.get('AdminDocumentos:emails-sysney:e').json).status,'enviando');
 }finally{globalThis.fetch=original;delete globalThis.pdfDB;}
});
