// Exception confirmed by the issuer for the SEFIN response. Raw XML stays intact.
const sysneyDocument = '57767099000179';
const returnedPostalCode = '5734150';
const confirmedPostalCode = '05734150';

export function nationalIssuerPostalCode(document, original) {
  if (original === undefined) return {};
  const corrected = document === sysneyDocument && original === returnedPostalCode;
  const postalCode = corrected ? confirmedPostalCode : original;
  if (typeof postalCode !== 'string' || !/^\d{8}$/.test(postalCode)) {
    throw Error('NATIONAL_ISSUER_POSTAL_CODE_INVALID');
  }
  return {
    issuerPostalCodeOriginal: original,
    issuerPostalCode: postalCode,
    issuerPostalCodeFormatted: `${postalCode.slice(0, 5)}-${postalCode.slice(5)}`,
    issuerPostalCodeCorrected: corrected,
  };
}

export function acceptedNationalSchemaProof(proof, fields) {
  if (proof?.schemaValid === true) return true;
  const exceptions = proof?.schemaExceptions;
  const cepMatched = proof?.schemaValid === false && proof.schemaCompatible === true
    && fields.issuerDocument === sysneyDocument
    && fields.issuerPostalCodeOriginal === returnedPostalCode
    && fields.issuerPostalCode === confirmedPostalCode
    && Array.isArray(exceptions)
    && exceptions[0]?.code === 'SYSNEY_ISSUER_CEP_LEADING_ZERO'
    && exceptions[0].path === 'NFSe/infNFSe/emit/enderNac/CEP'
    && exceptions[0].original === returnedPostalCode
    && exceptions[0].formatted === confirmedPostalCode;
  if (!cepMatched) return false;
  if (exceptions.length === 1) return true;
  return exceptions.length === 2
    && exceptions[1]?.code === 'SYSNEY_MUNICIPAL_DESCRIPTION_LINE_BREAKS'
    && exceptions[1].path === 'NFSe/infNFSe/xTribMun'
    && fields.environment === 'production'
    && fields.municipalDescriptionWithLineBreaks === true
    && fields.municipalServiceCode === '099'
    && fields.nationalServiceCode === '170201';
}
