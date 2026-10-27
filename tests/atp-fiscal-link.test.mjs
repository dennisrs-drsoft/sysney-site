import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {digest} from '../admin-api/src/services/atp-fiscal-v1.mjs';
import {createSupervisedAtpLink} from '../admin-api/src/services/atp-fiscal-link.mjs';
const input=JSON.parse(await readFile(new URL('../postman/fixtures/atp-fiscal-v1.synthetic.json',import.meta.url),'utf8'));
const actor={role:'administrador',id:'ADMIN-SINTETICO'},workId='a'.repeat(64),requestId='b'.repeat(64);
function setup({pdf=true,timeout=false}={}){
 let r={id:requestId,source:'ATP',hash:digest(JSON.stringify(input)),input:structuredClone(input),status:'pending_review',reviewStatus:'none',etag:'1'};
 const proofs=new Map(),requestProofs=new Map(),claims=new Map(),files=new Map(),audits=[];
 const xml=Buffer.from('<NFSeSimulada>SEM VALIDADE FISCAL</NFSeSimulada>'),pdfBytes=Buffer.from('%PDF-1.7\nDOCUMENTO SINTETICO SEM VALIDADE FISCAL\n%%EOF');
 const evidence={workId,source:'ATP',requestId,status:'issued',test:false,issuerDocument:'57767099000179',recipientDocument:input.recipient.document,amountCentsBRL:input.amountCentsBRL,competence:input.competence,description:input.description,servicePeriod:input.servicePeriod,authorizedAtUtc:'2026-10-27T12:01:00Z',provider:'national',number:'SINTETICA-1',authorityKey:'CHAVE-SINTETICA-SEM-VALIDADE',authorizedXmlVerified:true,xml,authorizedXmlHash:digest(xml),...(pdf?{pdf:pdfBytes,officialPdfHash:digest(pdfBytes)}:{})};
 const repository={getRequest:async()=>structuredClone(r),getProvenance:async id=>proofs.get(id),reserveProvenance:async p=>{if(proofs.has(p.workId)||requestProofs.has(p.requestId))throw Error('Conflito');proofs.set(p.workId,p);requestProofs.set(p.requestId,p.workId);},getInvoiceClaim:async id=>claims.get(id),saveOfficialDocument:async(id,format,bytes,sha256)=>{const blob=`integracoes/atp/${id}/${sha256}.${format}`;files.set(blob,bytes);return {blob,sha256,size:bytes.length};},commitLink:async c=>{if(r.etag!==c.requestEtag||claims.has(c.claim.invoiceIdentity)||proofs.get(workId)?.snapshotHash!==c.provenance.snapshotHash)throw Error('Conflito CAS');r={...c.request,etag:'2'};claims.set(c.claim.invoiceIdentity,c.claim);audits.push(c.audit);if(timeout)throw Error('Timeout apos commit');}};
 const service=createSupervisedAtpLink({repository,readAuthorizedEvidence:async()=>evidence,enabled:true,now:()=> '2026-10-27T12:00:00Z'});
 const reserve=()=>service.reserveProvenance({requestId,workId,actor});
 const link=async()=>{const p=await reserve();return service.approveLink({requestId,workId,expectedSnapshotHash:p.snapshotHash,actor,confirmed:true});};
 return {repository,evidence,service,reserve,link,audits,files,claims,current:()=>r};
}
test('vinculo sintetico auditado torna issued com XML/PDF e replay sem duplicar',async()=>{
 const s=setup(),p=await s.reserve();const r=await s.service.approveLink({requestId,workId,expectedSnapshotHash:p.snapshotHash,actor,confirmed:true});assert.equal(r.status,'issued');assert.equal(s.audits.length,1);assert.equal(s.files.size,2);
 const replay=await s.service.approveLink({requestId,workId,expectedSnapshotHash:p.snapshotHash,actor,confirmed:true});assert.equal(replay.status,'issued');assert.equal(s.audits.length,1);
});
test('nota sem PDF continua issued; timeout apos commit recupera mesma associacao',async()=>{const s=setup({pdf:false,timeout:true}),r=await s.link();assert.equal(r.status,'issued');assert.ok(r.documents.xml);assert.equal(r.documents.pdf,undefined);assert.equal(s.audits.length,1);});
test('proveniencia posterior a autorizacao e mera coincidencia sao recusadas',async()=>{
 const s=setup();s.evidence.authorizedAtUtc='2026-10-27T11:59:00Z';await assert.rejects(s.link());assert.equal(s.claims.size,0);
 const t=setup();t.evidence.source='OUTRO';await assert.rejects(t.link());assert.equal(t.audits.length,0);
});
test('rejeita origem/tomador/valor/competencia/periodo/hash divergentes',async()=>{
 for(const [key,value] of [['recipientDocument','99999999999999'],['amountCentsBRL',1],['competence','2025-01'],['test',true],['authorizedXmlHash','0'.repeat(64)],['servicePeriod',{startDate:'2025-01-01',endDate:'2025-01-31'}]]){const s=setup();s.evidence[key]=value;await assert.rejects(s.link());assert.equal(s.claims.size,0);}
});
test('sem aprovacao/role, reserva dupla, estorno e concorrencia nao vinculam livremente',async()=>{
 const s=setup(),p=await s.reserve();await assert.rejects(s.service.approveLink({requestId,workId,expectedSnapshotHash:p.snapshotHash,actor:{id:'ATP',role:'servico'},confirmed:true}));
 await assert.rejects(s.service.reserveProvenance({requestId,workId:'c'.repeat(64),actor}));
 s.current().reviewStatus='refund_review_required';await assert.rejects(s.service.approveLink({requestId,workId,expectedSnapshotHash:p.snapshotHash,actor,confirmed:true}));assert.equal(s.audits.length,0);
});
test('duas aprovacoes concorrentes geram no maximo uma auditoria/claim',async()=>{const s=setup(),p=await s.reserve(),args={requestId,workId,expectedSnapshotHash:p.snapshotHash,actor,confirmed:true};await Promise.allSettled([s.service.approveLink(args),s.service.approveLink(args)]);assert.equal(s.claims.size,1);assert.equal(s.audits.length,1);});
