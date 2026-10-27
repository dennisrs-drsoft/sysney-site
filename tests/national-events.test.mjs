import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {inspectRestrictedNationalEvent} from '../admin-api/src/services/atp-authorized-xml.mjs';
import {createNationalRestrictedClient} from '../admin-api/src/services/national-restricted-client.mjs';
const key='1'.repeat(50);
const event=type=>Buffer.from(`<evento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infEvento Id="EVT${key}${type}001"><nSeqEvento>001</nSeqEvento><dhProc>2026-10-27T12:00:00Z</dhProc><pedRegEvento><infPedReg Id="PRE${key}${type}"><tpAmb>2</tpAmb><chNFSe>${key}</chNFSe><e${type}><xMotivo>SIMULACAO</xMotivo></e${type}></infPedReg></pedRegEvento></infEvento><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo/></Signature></evento>`);
test('evento oficial específico normaliza cancelamento/substituição e recusa chave/ambiente divergente',()=>{
 assert.equal(inspectRestrictedNationalEvent(event('101101'),{authorityKey:key,type:'101101'}).cancelled,true);
 assert.equal(inspectRestrictedNationalEvent(event('105102'),{authorityKey:key,type:'105102'}).substituted,true);
 assert.equal(inspectRestrictedNationalEvent(event('105104'),{authorityKey:key,type:'105104'}).cancelled,true);
 assert.throws(()=>inspectRestrictedNationalEvent(event('101101'),{authorityKey:'2'.repeat(50),type:'101101'}));
 assert.throws(()=>inspectRestrictedNationalEvent(Buffer.from(event('101101').toString().replace('<tpAmb>2','<tpAmb>1')),{authorityKey:key,type:'101101'}));
});
test('GET404/indisponível não confirma inexistência global; resposta oficial negativa é monotônica',async()=>{
 const make=mode=>createNationalRestrictedClient({transport:async r=>{
  assert.equal(r.method,'GET');const type=r.path.match(/eventos\/(\d{6})/)[1];
  if(mode==='error')throw Error('Synthetic offline');
  if(mode==='cancel'&&type==='101101'||mode==='substitute'&&type==='105102')return {status:200,body:Buffer.from(JSON.stringify({tipoAmbiente:2,eventoXmlGZipB64:gzipSync(event(type)).toString('base64')}))};
  return {status:404,body:Buffer.alloc(0)};
 }});
 for(const mode of ['none','error']){const state=await make(mode).consultCancellationState(key);assert.equal(state.authorityStatus,'unknown');assert.equal(state.cancelled,null);assert.equal(state.completeSnapshot,false);assert.equal(state.requiresReview,true);}
 assert.equal((await make('cancel').consultCancellationState(key)).authorityStatus,'cancelled');
 assert.equal((await make('substitute').consultCancellationState(key)).authorityStatus,'substituted');
});
