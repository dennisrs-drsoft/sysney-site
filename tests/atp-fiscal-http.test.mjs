import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startSyntheticFiscalServer} from './helpers/atp-fiscal-http.mjs';

test('HTTP real loopback: auth, preparação, lookup, replay, revisão e PDF pendente',async()=>{
 const token='t'.repeat(48),s=await startSyntheticFiscalServer({token});
 try{
  const body=JSON.parse(await readFile(new URL('../postman/fixtures/atp-fiscal-v1.synthetic.json',import.meta.url),'utf8'));
  const base=s.baseUrl+'/api/integracoes/atp/v1/solicitacoes-fiscais',headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
  assert.equal((await fetch(base,{method:'POST',body:JSON.stringify(body)})).status,401);
  const created=await fetch(base,{method:'POST',headers,body:JSON.stringify(body)});assert.equal(created.status,202);const data=await created.json();
  const lookup=await fetch(base+'?externalReference='+encodeURIComponent(body.externalReference),{headers});assert.equal(lookup.status,200);assert.equal((await lookup.json()).request.id,data.request.id);
  assert.equal((await fetch(base,{method:'POST',headers,body:JSON.stringify(body)})).status,200);
  const pdf=await fetch(base+'/'+data.request.id+'/documentos/pdf',{headers});assert.equal(pdf.status,409);assert.equal((await pdf.json()).error.code,'DOCUMENT_NOT_READY');
  const review=await fetch(base+'/'+data.request.id+'/revisao-estorno',{method:'POST',headers,body:JSON.stringify({refundId:'ATP:revisao-sintetica',reason:'Teste offline'})});assert.equal(review.status,200);assert.equal((await review.json()).request.reviewStatus,'refund_review_required');
  const after=await fetch(base+'/'+data.request.id,{headers});assert.equal((await after.json()).request.status,'pending_review');
 }finally{await s.close();}
});
