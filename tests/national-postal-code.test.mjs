import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nationalIssuerPostalCode, acceptedNationalSchemaProof} from '../admin-api/src/services/national-postal-code.mjs';

test('CEP confirmado da SYSNEY conserva original e formata zero inicial', () => {
  assert.deepEqual(nationalIssuerPostalCode('57767099000179', '5734150'), {
    issuerPostalCodeOriginal: '5734150', issuerPostalCode: '05734150',
    issuerPostalCodeFormatted: '05734-150', issuerPostalCodeCorrected: true,
  });
  assert.equal(nationalIssuerPostalCode('57767099000179', '05734150').issuerPostalCodeCorrected, false);
  assert.throws(() => nationalIssuerPostalCode('11111111000191', '5734150'));
  assert.throws(() => nationalIssuerPostalCode('57767099000179', '1234567'));
});

test('compatibilidade exige prova específica do único CEP confirmado', () => {
  const fields = {issuerDocument: '57767099000179', ...nationalIssuerPostalCode('57767099000179', '5734150')};
  const proof = {schemaValid: false, schemaCompatible: true, schemaExceptions: [{
    code: 'SYSNEY_ISSUER_CEP_LEADING_ZERO', path: 'NFSe/infNFSe/emit/enderNac/CEP',
    original: '5734150', formatted: '05734150',
  }]};
  assert.equal(acceptedNationalSchemaProof(proof, fields), true);
  assert.equal(acceptedNationalSchemaProof({...proof, schemaCompatible: false}, fields), false);
  assert.equal(acceptedNationalSchemaProof(proof, {...fields, issuerDocument: '11111111000191'}), false);
  assert.equal(acceptedNationalSchemaProof({...proof, schemaExceptions: [...proof.schemaExceptions, {}]}, fields), false);
  assert.equal(acceptedNationalSchemaProof({...proof, schemaExceptions: [{...proof.schemaExceptions[0], path: 'toma/end/CEP'}]}, fields), false);
});


test('quebra de linha municipal só aceita a exceção já validada do código da SYSNEY',()=>{
 const fields={issuerDocument:'57767099000179',...nationalIssuerPostalCode('57767099000179','5734150'),environment:'production',municipalDescriptionWithLineBreaks:true,municipalServiceCode:'099',nationalServiceCode:'170201'};
 const proof={schemaValid:false,schemaCompatible:true,schemaExceptions:[{code:'SYSNEY_ISSUER_CEP_LEADING_ZERO',path:'NFSe/infNFSe/emit/enderNac/CEP',original:'5734150',formatted:'05734150'},{code:'SYSNEY_MUNICIPAL_DESCRIPTION_LINE_BREAKS',path:'NFSe/infNFSe/xTribMun'}]};
 assert.equal(acceptedNationalSchemaProof(proof,fields),true);
 for(const patch of [{environment:'homologacao'},{municipalDescriptionWithLineBreaks:false},{municipalServiceCode:'001'},{nationalServiceCode:'010101'}])assert.equal(acceptedNationalSchemaProof(proof,{...fields,...patch}),false);
 assert.equal(acceptedNationalSchemaProof({...proof,schemaExceptions:[...proof.schemaExceptions,{}]},fields),false);
});
