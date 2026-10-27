import {gzipSync,gunzipSync} from 'node:zlib';
import {digest} from './atp-fiscal-v1.mjs';
const validDps=id=>/^DPS3550308257767099000179\d{20}$/.test(id);
const validKey=key=>/^\d{50}$/.test(key);
const fail=code=>{throw Object.assign(Error(code),{code});};
export function unpackNationalXml(base64){
 if(typeof base64!=='string'||base64.length>8_000_000||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))fail('INVALID_XML_ENCODING');
 try{return gunzipSync(Buffer.from(base64,'base64'),{maxOutputLength:5_000_000});}catch{fail('INVALID_COMPRESSED_XML');}
}
export function createNationalRestrictedClient({transport,ledger}){
 if(typeof transport!=='function')fail('TRANSPORT_REQUIRED');
 async function json(method,path,body){
  const response=await transport({service:'sefin',environment:'homologacao',method,path,body,...(method==='POST'?{explicitRestrictedApproval:true}:{})});
  if(response.status===404)return null;
  if(![200,201].includes(response.status)){
   let errors=[];try{const p=JSON.parse(response.body.toString('utf8'));errors=(Array.isArray(p.erros)?p.erros:[]).filter(e=>/^[A-Za-z0-9_]{1,16}$/.test(e.codigo)).slice(0,10).map(e=>({code:e.codigo,description:String(e.descricao||'').replace(/<[^>]*>/g,'').replace(/\d{11,14}/g,'[documento]').slice(0,320)}));}catch{}
   const code=response.status===403?'CERTIFICATE_OR_PERMISSION_DENIED':'NATIONAL_HTTP_ERROR';
   throw Object.assign(Error(code),{code,providerHttpStatus:response.status,providerErrors:errors});
  }
  let data;try{data=JSON.parse(response.body.toString('utf8'));}catch{fail('INVALID_JSON');}
  if(data.tipoAmbiente!==2)fail('WRONG_ENVIRONMENT');return data;
 }
 async function consultInvoice(key){
  if(!validKey(key))fail('INVALID_KEY');const data=await json('GET',`/nfse/${key}`);
  if(!data)return null;if(data.chaveAcesso!==key)fail('KEY_MISMATCH');
  return {...data,xml:unpackNationalXml(data.nfseXmlGZipB64)};
 }
 async function recover(id){
  if(!validDps(id))fail('INVALID_DPS');const dps=await json('GET',`/dps/${id}`);
  if(!dps)return {status:'uncertain',idDps:id};
  if(dps.idDps!==id||!validKey(dps.chaveAcesso))fail('DPS_MISMATCH');
  const invoice=await consultInvoice(dps.chaveAcesso);return invoice?{status:'confirmed_restricted',...invoice,idDps:id}:{status:'uncertain',idDps:id};
 }
 return {
  consultInvoice,recover,
  async submit({idDps,signedXml,explicitRestrictedApproval=false}){
   if(!validDps(idDps)||!explicitRestrictedApproval||!Buffer.isBuffer(signedXml)||signedXml.length>1_000_000)fail('INVALID_RESTRICTED_REQUEST');
   if(!ledger?.reserve||!ledger?.get)fail('DURABLE_LEDGER_REQUIRED');
   const hash=digest(signedXml),existing=await ledger.get(idDps);
   if(existing){if(existing.hash!==hash)fail('DPS_CONTENT_CONFLICT');return recover(idDps);}
   // Reserva durável ANTES da transmissão. Depois dela, só consulta, inclusive
   // rejeição/timeout. O transport Windows valida assinatura/XSD/ambiente de novo.
   try{await ledger.reserve({idDps,hash,status:'transmitting'});}catch{
    const current=await ledger.get(idDps);if(!current||current.hash!==hash)fail('DPS_RESERVATION_CONFLICT');return recover(idDps);
   }
   try{
    const data=await json('POST','/nfse',{dpsXmlGZipB64:gzipSync(signedXml).toString('base64')});
    if(!data||data.idDps!==idDps||!validKey(data.chaveAcesso))return {status:'uncertain',idDps};
    return {status:'confirmed_restricted',...data,xml:unpackNationalXml(data.nfseXmlGZipB64)};
   }catch(e){return {status:[400,403].includes(e.providerHttpStatus)?'rejected_restricted':'uncertain',idDps,...(e.providerHttpStatus?{providerHttpStatus:e.providerHttpStatus,providerErrors:e.providerErrors}: {})};}
  },
  async consultEvent(key,type,sequence){
   if(!validKey(key)||!/^\d{6}$/.test(type)||!Number.isSafeInteger(sequence)||sequence<1||sequence>999)fail('INVALID_EVENT');
   return json('GET',`/nfse/${key}/eventos/${type}/${sequence}`);
  },
  async downloadPdf(key){
   if(!validKey(key))fail('INVALID_KEY');
   const response=await transport({service:'danfse',environment:'homologacao',method:'GET',path:`/danfse/${key}`});
   if(response.status!==200||!response.contentType?.toLowerCase().includes('application/pdf'))fail('PDF_UNAVAILABLE');
   const bytes=response.body;
   if(!Buffer.isBuffer(bytes)||bytes.length<30||bytes.length>5_000_000||!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||!bytes.subarray(-1024).includes(Buffer.from('%%EOF')))fail('INVALID_PDF');
   return bytes;
  },
 };
}
