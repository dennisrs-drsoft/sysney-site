import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectNationalXml,createNationalEvidenceReader,createOfficialQueryEvidenceReader} from '../admin-api/src/services/atp-authorized-xml.mjs';
import {digest} from '../admin-api/src/services/atp-fiscal-v1.mjs';
const key='1'.repeat(50),workId='a'.repeat(64),requestId='b'.repeat(64);
// Estrutura reduzida nacional simulada, NÃO documento autorizado ou XSD válido.
const synthetic=()=>Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS${key}"><nNFSe>1</nNFSe><dhProc>2026-10-27T12:01:00Z</dhProc><emit><CNPJ>57767099000179</CNPJ></emit><DPS><infDPS Id="DPS-SINTETICA"><tpAmb>1</tpAmb><dCompet>2026-10-01</dCompet><prest><CNPJ>57767099000179</CNPJ></prest><toma><CNPJ>11222333000181</CNPJ></toma><serv><cServ><xDescServ>SEM VALIDADE FISCAL</xDescServ></cServ></serv><valores><vServPrest><vServ>199.00</vServ></vServPrest></valores></infDPS></DPS></infNFSe></NFSe>`);
test('extrai campos de estrutura nacional sem converter valor bruto para liquido',()=>{const r=inspectNationalXml(synthetic());assert.equal(r.amountCentsBRL,19900);assert.equal(r.authorityKey,key);assert.equal(r.recipientDocument,'11222333000181');assert.equal(r.competence,'2026-10');});
test('rejeita DTD/XXE, duplicidade, namespace divergente e XML grande',()=>{
 const xml=synthetic().toString();
 for(const v of [xml.replace('<NFSe ','<!DOCTYPE x [<!ENTITY p SYSTEM "file:///secret">]><NFSe '),xml.replace('<nNFSe>1</nNFSe>','<nNFSe>1</nNFSe><nNFSe>2</nNFSe>'),xml.replace('<emit>','<emit xmlns="https://evil.invalid">'),xml.replace('Id="DPS-SINTETICA"',`Id="NFS${key}"`),xml.replace('<tpAmb>1</tpAmb>','<tpAmb>2</tpAmb>')])assert.throws(()=>inspectNationalXml(Buffer.from(v)));
 assert.throws(()=>inspectNationalXml(Buffer.alloc(1_000_001)));
});

test('consulta oficial normalizada dispensa verificador customizado, mas exige status e bytes exatos',async()=>{
 const xml=synthetic(),work={source:'ATP',requestId,provider:'national',status:'issued',test:false,authorityKey:key,authorizedXmlHash:digest(xml),provenance:{requestId,servicePeriod:{startDate:'2026-10-01',endDate:'2026-10-31'}}};
 const response={provider:'national',environment:'production',authorityKey:key,status:'authorized',cancelled:false,substituted:false,checkedAtUtc:'2026-10-27T12:02:00Z',xml};
 const reader=changes=>createOfficialQueryEvidenceReader({loadWork:async()=>work,consultOfficial:async requested=>{assert.equal(requested,key);return {...response,...changes};},now:()=>Date.parse('2026-10-27T12:02:00Z')});
 assert.equal((await reader({})(workId)).authorizedXmlHash,digest(xml));
 for(const change of [{status:'unknown'},{status:'cancelled',cancelled:true},{substituted:true},{authorityKey:'2'.repeat(50)},{environment:'homologation'},{checkedAtUtc:'2026-10-27T10:00:00Z'},{xml:Buffer.from('<Outro>SEM VALIDADE</Outro>')}])await assert.rejects(reader(change)(workId));
 await assert.rejects(createOfficialQueryEvidenceReader({loadWork:async()=>work})(workId));
});
test('leitor falha fechado sem schema/assinatura/confirmacao real; verifier sintetico explicito',async()=>{
 const xml=synthetic(),w={source:'ATP',requestId,provider:'national',status:'issued',test:false,xml,authorizedXmlHash:digest(xml),provenance:{requestId,servicePeriod:{startDate:'2026-10-01',endDate:'2026-10-31'}}};
 await assert.rejects(createNationalEvidenceReader({loadWork:async()=>w})(workId));
 const clock=()=>Date.parse('2026-10-27T12:02:00Z');
 const verify=async()=>({xmlHash:digest(xml),authorityKey:key,schemaValid:true,signatureValid:true,authorityConfirmed:true,cancelled:false,environment:'production',verifiedAtUtc:'2026-10-27T12:02:00Z'});
 const result=await createNationalEvidenceReader({loadWork:async()=>w,verifyAuthorization:verify,now:clock})(workId);assert.equal(result.authorizedXmlVerified,true);
 for(const altered of [{cancelled:true},{signatureValid:false},{schemaValid:false},{xmlHash:'0'.repeat(64)},{environment:'homologation'},{verifiedAtUtc:'2026-10-27T11:00:00Z'}])await assert.rejects(createNationalEvidenceReader({loadWork:async()=>w,verifyAuthorization:async()=>({...await verify(),...altered}),now:clock})(workId));
});
