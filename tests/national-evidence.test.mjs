import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reconcileRestrictedAuthorization} from '../admin-api/src/services/national-restricted-evidence.mjs';
import {inspectNationalXml} from '../admin-api/src/services/atp-authorized-xml.mjs';
import {authorizationFixture} from './helpers/national-authorization-fixture.mjs';
test('restrito reconcilia XML nacional2 e pedido completo; produção continua separada',async()=>{
 const data=await authorizationFixture(),proof=reconcileRestrictedAuthorization(data);
 assert.equal(proof.number,'53');assert.equal(proof.requestId,data.request.id);assert.equal(proof.orderId,data.request.input.orderId);assert.equal(proof.amountCentsBRL,19900);assert.equal(proof.authorityStatus,'unknown');assert.equal(proof.cancelled,null);assert.equal(proof.substituted,null);assert.equal(proof.requiresReview,true);
 assert.throws(()=>inspectNationalXml(data.result.xml));
 const ds=data.result.xml.toString().replace('</NFSe>','<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo/></Signature></NFSe>');assert.equal(inspectNationalXml(Buffer.from(ds),{environment:'homologacao'}).number,'53');
});
test('recusa XML de outra nota/pedido, ambiente1, duplicidade, XXE e valores divergentes',async()=>{
 const data=await authorizationFixture(),xml=data.result.xml.toString();
 const changes=[['<nNFSe>53</nNFSe>','<nNFSe>53</nNFSe><nNFSe>54</nNFSe>'],['<tpAmb>2</tpAmb>','<tpAmb>1</tpAmb>'],['11222333000181','27381256000142'],['199.00','198.00'],['<dCompet>2026-10-01','<dCompet>2026-10-02'],[data.work.idDps,data.work.idDps.slice(0,-1)+'2'],['<cTribNac>000000','<cTribNac>010501'],['<nNFSe>53','<nNFSe>0'],['<NFSe ','<!DOCTYPE p [<!ENTITY e SYSTEM "file:///secret">]><NFSe '],['<emit>','<emit xmlns="https://evil.invalid">']];
 for(const [a,b] of changes)assert.throws(()=>reconcileRestrictedAuthorization({...data,result:{...data.result,xml:Buffer.from(xml.replace(a,b))}}),/BINDING/);
 assert.throws(()=>reconcileRestrictedAuthorization({...data,result:{...data.result,chaveAcesso:'2'.repeat(50)}}));
 assert.throws(()=>reconcileRestrictedAuthorization({...data,provenance:{...data.provenance,paymentId:'other'}}));
 assert.throws(()=>reconcileRestrictedAuthorization({...data,request:{...data.request,input:{...data.request.input,orderId:'other'}}}));
 assert.throws(()=>reconcileRestrictedAuthorization({...data,work:{...data.work,requestHash:'0'.repeat(64)}}));
 assert.throws(()=>reconcileRestrictedAuthorization({...data,result:{...data.result,xml:Buffer.from(xml.replace('<emit><CNPJ>57767099000179','<emit><CNPJ>27381256000142'))}}));
 assert.throws(()=>reconcileRestrictedAuthorization({...data,work:{...data.work,emissionAt:'2026-10-27T11:00:00-03:00'}}));
 assert.throws(()=>reconcileRestrictedAuthorization({...data,work:{...data.work,createdAtUtc:'2026-10-27T16:00:00Z'}}));
});
