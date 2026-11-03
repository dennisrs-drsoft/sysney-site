import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {unpackNationalXml} from './national-restricted-client.mjs';
import {inspectNationalXml} from './atp-authorized-xml.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Error(code);};
export function inspectAdminDps(bytes,{cnpj,ambiente}){
 if(!Buffer.isBuffer(bytes)||bytes.length>1000000)fail('DPS_BYTES_INVALID');
 const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(xml)||XMLValidator.validate(xml)!==true)fail('DPS_XML_INVALID');
 const root=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false}).parse(xml).DPS;
 if(!root||Array.isArray(root)||root['@_xmlns']!=='http://www.sped.fazenda.gov.br/nfse'||root['@_versao']!=='1.01'||Array.isArray(root.infDPS))fail('DPS_ROOT_INVALID');
 const d=root.infDPS;
 if(!d||d.prest?.CNPJ!==cnpj||d.tpAmb!==(ambiente==='producao'?'1':'2')||!/^\d{1,5}$/.test(d.serie)||! /^[1-9]\d{0,14}$/.test(d.nDPS))fail('DPS_SCOPE_MISMATCH');
 const id=`DPS35503082${cnpj}${d.serie.padStart(5,'0')}${d.nDPS.padStart(15,'0')}`;
 const ids=[...xml.matchAll(/\bId=["']([^"']+)["']/g)].map(m=>m[1]);if(new Set(ids).size!==ids.length||d['@_Id']!==id)fail('DPS_ID_MISMATCH');
 return {idDps:id,dps:d};
}
export function createNationalAdminClient({cnpj,ambiente,transport,ledger,authorize,verifyOfficialXml}){
 if(!/^\d{14}$/.test(cnpj)||!['homologacao','producao'].includes(ambiente)||typeof transport!=='function'||typeof verifyOfficialXml!=='function')fail('NATIONAL_CLIENT_SCOPE_REQUIRED');
 const validId=id=>typeof id==='string'&&id.startsWith(`DPS35503082${cnpj}`)&&/^DPS\d{42}$/.test(id),key=k=>/^\d{50}$/.test(k||'');
 async function json(method,path,body){
  const r=await transport({service:'sefin',ambiente,cnpj,method,path,...(body?{body}:{})});
  if(r.status===404&&method==='GET')return null;
  if(![200,201].includes(r.status))throw Object.assign(Error('NATIONAL_PROVIDER_ERROR'),{providerStatus:r.status});
  if(!Buffer.isBuffer(r.body)||r.body.length>8000000)fail('NATIONAL_RESPONSE_LIMIT');
  let data;try{data=JSON.parse(r.body.toString('utf8'));}catch{fail('NATIONAL_JSON_INVALID');}
  if(data.tipoAmbiente!==(ambiente==='producao'?1:2))fail('NATIONAL_ENVIRONMENT_MISMATCH');return data;
 }
 async function invoice(data,idDps,expected){
  if(!data||!key(data.chaveAcesso))return {status:'incerta',idDps};
  const xml=unpackNationalXml(data.nfseXmlGZipB64),fields=inspectNationalXml(xml,{environment:ambiente==='producao'?'production':'homologacao'});
  const root=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false}).parse(xml).NFSe.infNFSe.DPS.infDPS;
  if(fields.issuerDocument!==cnpj||fields.authorityKey!==data.chaveAcesso||root['@_Id']!==idDps)fail('NATIONAL_OFFICIAL_ID_MISMATCH');
  // The exact DPS content, including taxes/address, must survive authorization.
  if(expected){
   const {dps}=inspectAdminDps(expected,{cnpj,ambiente});
   if(JSON.stringify(root)!==JSON.stringify(dps))fail('NATIONAL_OFFICIAL_DPS_CHANGED');
  }
  const proof=await verifyOfficialXml({xml,ambiente,cnpj,authorityKey:fields.authorityKey});
  if(proof?.xmlHash!==hash(xml)||proof.schemaValid!==true||proof.signatureValid!==true||proof.chainValid!==true)fail('NATIONAL_OFFICIAL_PROOF_REQUIRED');
  return {status:'confirmada',idDps,fields,xml,proof};
 }
 async function recover(idDps,expected){
  if(!validId(idDps))fail('NATIONAL_DPS_INVALID');
  const r=await json('GET',`/dps/${idDps}`);
  if(!r)return {status:'incerta',idDps};
  if(r.idDps!==idDps||!key(r.chaveAcesso))fail('NATIONAL_DPS_RETURN_MISMATCH');
  const data=await json('GET',`/nfse/${r.chaveAcesso}`);
  if(data&&data.chaveAcesso!==r.chaveAcesso)fail('NATIONAL_ACCESS_KEY_MISMATCH');
  return invoice(data,idDps,expected);
 }
 return {recover,async submit({signedXml,expectedXml}){
  const parsed=inspectAdminDps(signedXml,{cnpj,ambiente}),{idDps}=parsed,signedHash=hash(signedXml);
  if(!Buffer.isBuffer(expectedXml))fail('NATIONAL_EXPECTED_XML_REQUIRED');
  const expected=inspectAdminDps(expectedXml,{cnpj,ambiente});if(expected.idDps!==idDps||JSON.stringify(expected.dps)!==JSON.stringify(parsed.dps))fail('NATIONAL_EXPECTED_XML_REQUIRED');
  if(!ledger?.get||!ledger?.reserve||typeof authorize!=='function')fail('NATIONAL_DURABLE_AUTHORITY_REQUIRED');
  const existing=await ledger.get(idDps);
  if(existing){if(existing.unsignedHash!==hash(expectedXml))fail('NATIONAL_DPS_CONTENT_CONFLICT');return recover(idDps,expectedXml);}
  // A known DPS is recovered even if it was issued by another authorized client.
  const prior=await recover(idDps,expectedXml);if(prior.status==='confirmada')return prior;
  await authorize({idDps,signedHash,unsignedHash:hash(expectedXml)});
  try{await ledger.reserve({idDps,signedHash,unsignedHash:hash(expectedXml)});}catch{const claimed=await ledger.get(idDps);if(!claimed||claimed.unsignedHash!==hash(expectedXml))fail('NATIONAL_CLAIM_CONFLICT');return recover(idDps,expectedXml);}
  // Never clear a claim after rejection, timeout, invalid response or process crash.
  try{const data=await json('POST','/nfse',{dpsXmlGZipB64:gzipSync(signedXml).toString('base64')});return await invoice(data,idDps,expectedXml);}catch(e){return {status:e.providerStatus===400||e.providerStatus===403?'rejeitada':'incerta',idDps,...(e.providerStatus?{providerStatus:e.providerStatus}:{})};}
 },async downloadPdf(authorityKey){
  if(!key(authorityKey))fail('NATIONAL_ACCESS_KEY_INVALID');
  const r=await transport({service:'danfse',ambiente,cnpj,method:'GET',path:`/danfse/${authorityKey}`}),b=r.body;
  if(r.status!==200||!r.contentType?.toLowerCase().includes('application/pdf')||!Buffer.isBuffer(b)||b.length<30||b.length>5000000||b.subarray(0,5).toString()!=='%PDF-'||!b.subarray(-1024).includes(Buffer.from('%%EOF')))fail('NATIONAL_PDF_UNAVAILABLE');
  return b;
 }};
}
