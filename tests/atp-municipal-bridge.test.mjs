import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {input,profile,args,memoryTable,officialFixture} from './helpers/atp-municipal-fixture.mjs';
import {digest,validatePreparation} from '../admin-api/src/services/atp-fiscal-v1.mjs';
import {buildAtpMunicipal} from '../admin-api/src/services/atp-municipal-model.mjs';
import {createAtpMunicipalStore} from '../admin-api/src/services/atp-municipal-store.mjs';
import {createAtpMunicipalWorkflow,saoPauloFiscalDate} from '../admin-api/src/services/atp-municipal-workflow.mjs';
import {createAtpMunicipalExecutor} from '../admin-api/src/services/atp-municipal-executor.mjs';
import {reconcileAtpMunicipal,validateAtpMunicipalPdf} from '../admin-api/src/services/atp-municipal-evidence.mjs';
const actor={role:'administrador',id:'QA-ADMIN'},now=()=> '2026-10-27T15:02:00Z';
test('data fiscal usa São Paulo na fronteira UTC e na virada de novembro',()=>{
 assert.equal(saoPauloFiscalDate('2026-10-28T00:00:00Z'),'2026-10-27');assert.equal(saoPauloFiscalDate('2026-11-01T02:59:59Z'),'2026-10-31');assert.equal(saoPauloFiscalDate('2026-11-01T03:00:00Z'),'2026-11-01');
});
async function pdfFor(document=input.recipient.document){const d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.Helvetica);d.addPage().drawText(`Numero da NFS-e: 53 ABCD1234 57.767.099/0001-79 ${document} R$ 199,00`,{x:20,y:700,size:10,font});return Buffer.from(await d.save({useObjectStreams:false}));}
function setup({cpf=false,issuanceEnabled=true,timeout=false}={}){
 const i=validatePreparation({...input,...(cpf?{recipient:{...input.recipient,documentType:'CPF',document:'52998224725',legalName:'PESSOA SINTETICA'}}:{})});
 let request={id:digest(i.paymentId),source:'ATP',hash:digest(JSON.stringify(i)),input:i,status:'pending_review',reviewStatus:'none',etag:'1'};
 const proofs=new Map(),claims=new Map(),files=new Map(),audits=[],calls=[];
 const repository={getRequest:async()=>structuredClone(request),getProvenance:async id=>proofs.get(id),reserveProvenance:async p=>{if([...proofs.values()].some(x=>x.requestId===p.requestId))throw Error('Duplicate');proofs.set(p.workId,p);},getInvoiceClaim:async id=>claims.get(id),saveOfficialDocument:async(id,format,bytes,sha256)=>{files.set(format,bytes);return {blob:`integracoes/atp/${id}/${sha256}.${format}`,sha256,size:bytes.length};},commitLink:async c=>{if(request.etag!==c.requestEtag||claims.has(c.claim.invoiceIdentity))throw Error('CAS');request={...c.request,etag:'2'};claims.set(c.claim.invoiceIdentity,c.claim);audits.push(c.audit);}};
 const table=memoryTable(),store=createAtpMunicipalStore(table);
 let work,pdfFailure=false,mismatch=false;
 const executor={async execute(payload){calls.push(payload.action);if(payload.action==='emitir'&&timeout)throw Error('Timeout after provider');return {success:true,xml:payload.action==='consultar'?(mismatch?Buffer.from(officialFixture(work,i.recipient).toString().replace('199.00','198.00')):officialFixture(work,i.recipient)):Buffer.from('<Acknowledgement/>')};},async downloadPdf(){if(pdfFailure)throw Error('Unavailable');return pdfFor(i.recipient.document);}};
 const workflow=createAtpMunicipalWorkflow({repository,store,executor,enabled:true,issuanceEnabled,now:()=>calls.includes('emitir')||calls.includes('consultar')?now():'2026-10-27T15:00:00Z'});
 const prepare=async()=>work=await workflow.prepare({requestId:request.id,profile,series:'ATPQA',initialNumber:'1',exclusiveSeriesConfirmed:true,emissionDate:'2026-10-27',actor});
 const run=()=>workflow.run({workId:work.workId,actor,approvedHash:work.hash,confirmed:true});
 return {workflow,prepare,run,repository,table,store,calls,files,audits,current:()=>request,pdfFail:()=>pdfFailure=true,mismatch:()=>mismatch=true,work:()=>work};
}
test('CPF e CNPJ têm XML tipado e cadeia 86 posições sem alterar legado; novembro bloqueado',()=>{
 for(const [type,document,indicator] of [['CPF','52998224725','1'],['CNPJ',input.recipient.document,'2']]){
  const d=buildAtpMunicipal({...args,input:{...input,recipient:{...input.recipient,documentType:type,document}}});assert.equal(d.chain.length,86);assert.equal(d.chain.slice(-15),indicator+document.padStart(14,'0'));assert.ok(d.xml.includes(`<${type}>${document}</${type}>`));
 }
 assert.throws(()=>buildAtpMunicipal({...args,emissionDate:'2026-11-01'}),/NOVEMBER/);
 assert.throws(()=>buildAtpMunicipal({...args,profile:{...profile,codigoServico:'01050'}}),/PROFILE/);
});
test('reserva RPS atômica recupera timeout, replay e concorrência; não ocupa série legado',async()=>{
 const table=memoryTable(),store=createAtpMunicipalStore(table),a={requestId:'a'.repeat(64),series:'ATPQA',preparationHash:'b'.repeat(64),emissionDate:'2026-10-27',issuer:profile.issuer,initialNumber:'1',exclusiveSeriesConfirmed:true};
 table.timeoutOnce();const first=await store.reserve(a);assert.equal(first.number,'1');assert.deepEqual(await store.reserve(a),first);
 const many=await Promise.all(Array.from({length:8},(_,i)=>store.reserve({...a,requestId:digest('request'+i)})));assert.equal(new Set(many.map(x=>x.number)).size,8);
 await assert.rejects(store.reserve({...a,preparationHash:'c'.repeat(64)}),/CONFLICT/);await assert.rejects(store.reserve({...a,series:'SB001'}),/EXCLUSIVE/);
});
test('armazenamento privado chunked com CAS verifica integridade e ledger insert-only',async()=>{
 const table=memoryTable(),store=createAtpMunicipalStore(table),id='a'.repeat(64);await store.create({workId:id,data:'x'.repeat(100000)});
 let w=await store.get(id);assert.equal(w.data.length,100000);await store.save({...w,state:'ok'});await assert.rejects(store.save({...w,state:'stale'}));assert.equal(await store.claim(id,'b'.repeat(64)),true);assert.equal(await store.claim(id,'b'.repeat(64)),false);await assert.rejects(store.claim(id,'c'.repeat(64)),/CONFLICT/);
 const pointer=table.rows.get('atp-municipal-v1|work-'+id),chunk=[...table.rows.values()].find(x=>x.rowKey.startsWith('content-'+pointer.hash));chunk.data='AAAA';await assert.rejects(store.get(id),/CORRUPT/);
});
test('fluxo CPF/CNPJ por proveniência → teste → ledger → consulta → PDF → projeção',async()=>{
 for(const cpf of [false,true]){const s=setup({cpf}),w=await s.prepare();assert.equal((await s.prepare()).workId,w.workId);await s.workflow.test({workId:w.workId,actor});const r=await s.run();assert.equal(r.state,'authorized');assert.equal(s.current().status,'pending_review');assert.equal(r.documents.pdf,true);
  await s.run();assert.equal(s.calls.filter(x=>x==='emitir').length,1);const linked=await s.workflow.project({workId:w.workId,actor,confirmed:true});assert.equal(linked.status,'issued');assert.equal(s.audits.length,1);assert.equal(s.files.size,2);assert.equal(linked.invoice.number,'53');assert.equal((await s.workflow.project({workId:w.workId,actor,confirmed:true})).status,'issued');assert.equal(s.audits.length,1);
 }
});
test('timeout não repete emissão; nova instância do store conserva ledger e consulta recupera',async()=>{
 const s=setup({timeout:true}),w=await s.prepare();await s.workflow.test({workId:w.workId,actor});assert.equal((await s.run()).state,'uncertain');assert.equal((await s.run()).state,'authorized');assert.equal(s.calls.filter(x=>x==='emitir').length,1);assert.equal((await createAtpMunicipalStore(s.table).get(w.workId)).state,'authorized');
});
test('gates off, hash, estorno e teste expirado impedem transmissão',async()=>{
 const s=setup({issuanceEnabled:false}),w=await s.prepare();await s.workflow.test({workId:w.workId,actor});await assert.rejects(s.run(),/DISABLED/);assert.deepEqual(s.calls,['testar']);
 const t=setup(),v=await t.prepare();await assert.rejects(t.run(),/APPROVAL/);t.current().reviewStatus='refund_review_required';await assert.rejects(t.workflow.test({workId:v.workId,actor}),/ELIGIBLE/);
 let spawned=0;const executor=createAtpMunicipalExecutor({spawnProcess:()=>{spawned++;}});await assert.rejects(executor.execute({action:'emitir'}),/DISABLED/);assert.equal(spawned,0);
});
test('retorno divergente nunca projeta; PDF indisponível preserva XML e recupera só consulta',async()=>{
 const s=setup(),w=await s.prepare();await s.workflow.test({workId:w.workId,actor});s.mismatch();assert.equal((await s.run()).state,'reconciliation_required');await assert.rejects(s.workflow.project({workId:w.workId,actor,confirmed:true}),/EVIDENCE/);assert.equal(s.files.size,0);
 const t=setup(),v=await t.prepare();await t.workflow.test({workId:v.workId,actor});t.pdfFail();const r=await t.run();assert.equal(r.documents.xml,true);assert.equal(r.documents.pdf,false);assert.equal((await t.store.get(v.workId)).result.pdfReason,'PDF_PENDING_REVIEW_OR_DOWNLOAD');await t.workflow.recover({workId:v.workId,actor});assert.equal(t.calls.filter(x=>x==='emitir').length,1);
});
test('PDF com mesmo valor mas outro tomador e XML com identidade/namespace duplicados recusados',async()=>{
 const s=setup(),w=await s.prepare(),request=s.current(),p=await s.repository.getProvenance(w.workId),xml=officialFixture(w);
 const e=reconcileAtpMunicipal({xml,work:w,request,provenance:p,receivedAtUtc:now()});await validateAtpMunicipalPdf(await pdfFor(),e);await assert.rejects(validateAtpMunicipalPdf(await pdfFor('52998224725'),e));
 for(const bad of [xml.toString().replace('<StatusNFe>N','<StatusNFe>C'),xml.toString().replace('ATPQA','ATPXX'),xml.toString().replace('<NFe>','<NFe xmlns="evil">'),xml.toString().replace('</NFe>','</NFe><NFe/>'),xml.toString().replace('199.00','198.00')])assert.throws(()=>reconcileAtpMunicipal({xml:Buffer.from(bad),work:w,request,provenance:p,receivedAtUtc:now()}));
});
test('adaptador on-demand passa hash aprovado e gates ao processo; PDF só usa origem oficial fixa',async()=>{
 const d=buildAtpMunicipal(args),workId=digest('process'),calls=[];
 const spawnProcess=(command,argv,options)=>{
  calls.push({command,argv,options});const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};const chunks=[];
  child.stdin.on('data',b=>chunks.push(b));child.stdin.on('end',()=>{
   const message=JSON.parse(Buffer.concat(chunks));assert.equal(message.xmlHash,digest(d.xml));assert.equal(message.approvedHash,d.hash);assert.equal(options.windowsHide,true);assert.equal(options.env.ATP_MUNICIPAL_ISSUANCE_ENABLED,'true');
   const bytes=Buffer.from(JSON.stringify({success:true,xml:'<Retorno>síntese</Retorno>'})),cut=bytes.indexOf(Buffer.from('í'))+1;
   child.stdout.write(bytes.subarray(0,cut));child.stdout.write(bytes.subarray(cut));child.emit('close',0);
  });return child;
 };
 const executor=createAtpMunicipalExecutor({enabled:true,issuanceEnabled:true,thumbprint:'a'.repeat(40),spawnProcess,fetchPdf:async(url,options)=>{assert.equal(url.origin,'https://nfe.prefeitura.sp.gov.br');assert.equal(url.pathname,'/contribuinte/notaprintpdf.aspx');assert.equal(url.searchParams.get('nf'),'53');assert.equal(options.redirect,'error');return new Response(await pdfFor(),{headers:{'content-type':'application/pdf'}});}});
 const result=await executor.execute({action:'emitir',workId,xml:d.xml,chain:d.chain,approvedHash:d.hash,confirmed:true});assert.equal(result.xml.toString(),'<Retorno>síntese</Retorno>');assert.equal(calls.length,1);
 await assert.rejects(executor.execute({action:'emitir',workId,xml:d.xml,approvedHash:digest('wrong'),confirmed:true}),/DISABLED/);assert.equal(calls.length,1);
 assert.ok((await executor.downloadPdf({provider:'municipal_sp',issuerDocument:'57767099000179',authorityKey:'15539300:53:ABCD1234'})).length>100);
 await assert.rejects(executor.downloadPdf({provider:'municipal_sp',issuerDocument:'57767099000179',authorityKey:'https://evil.example'}),/IDENTITY/);
});
