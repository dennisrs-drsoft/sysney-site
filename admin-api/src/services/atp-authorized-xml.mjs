import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {TextDecoder} from 'node:util';
import {digest} from './atp-fiscal-v1.mjs';
const NS='http://www.sped.fazenda.gov.br/nfse';
const fail=()=>{throw Error('XML nacional não comprovado ou incompatível.');};
const obj=v=>{if(!v||typeof v!=='object'||Array.isArray(v))fail();return v;};
const str=(v,re)=>{if(typeof v!=='string'||!re.test(v))fail();return v;};
export function inspectNationalXml(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>1_000_000||bytes.length<50)fail();
 let xml;try{xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail();}
 // Rejeição conservadora antes do parser: sem DTD, entidades, CDATA ou PIs externas.
 if(/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?(?!xml\s)|\b(?:SYSTEM|PUBLIC)\s+["']/i.test(xml)||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(xml))fail();
 let depth=0,count=0;const ids=new Set();
 for(const tag of xml.matchAll(/<([^>]+)>/g)){
  const t=tag[1];if(t.startsWith('?')||t.startsWith('!'))continue;
  if(t.startsWith('/'))depth--;else {if(++count>2000||++depth>40)fail();if(t.endsWith('/'))depth--;}
  for(const id of t.matchAll(/\b(?:Id|ID|id)\s*=\s*["']([^"']+)["']/g)){if(ids.has(id[1]))fail();ids.add(id[1]);}
 }
 if(depth!==0||XMLValidator.validate(xml)!==true)fail();
 const parsed=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:false,parseAttributeValue:false,trimValues:false,processEntities:false,allowBooleanAttributes:false}).parse(xml);
 // Perfil restrito ao namespace padrão oficial; prefixos alternativos ficam bloqueados
 // até homologação específica. Arrays nunca viram 'primeiro elemento'.
 const root=obj(parsed.NFSe);if(root['@_xmlns']!==NS||root['@_versao']!=='1.01')fail();
 function namespaces(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(k==='@_xmlns'&&x!==NS)fail();if(!k.startsWith('@_')&&k.includes(':')&&!k.startsWith('ds:'))fail();if(k==='@_xmlns:ds'&&x!=='http://www.w3.org/2000/09/xmldsig#')fail();namespaces(x);}}
 namespaces(root);
 const n=obj(root.infNFSe),d=obj(obj(n.DPS).infDPS),t=obj(d.toma),e=obj(n.emit),prest=obj(d.prest);
 const authorityKey=str(n['@_Id'],/^NFS\d{50}$/).slice(3),number=str(n.nNFSe,/^[1-9]\d{0,12}$/);
 const issuerDocument=str(e.CNPJ,/^\d{14}$/);if(prest.CNPJ!==issuerDocument||prest.CPF!==undefined)fail();
 if(d.tpAmb!=='1'||d.subst!==undefined||d.interm!==undefined)fail();
 const recipientDocument=t.CNPJ!==undefined?str(t.CNPJ,/^\d{14}$/):str(t.CPF,/^\d{11}$/);if(t.CNPJ!==undefined&&t.CPF!==undefined)fail();
 const competenceDate=str(d.dCompet,/^20\d{2}-\d{2}-\d{2}$/);if(!Number.isFinite(Date.parse(competenceDate))||new Date(competenceDate).toISOString().slice(0,10)!==competenceDate)fail();
 const authorizedAtUtc=str(n.dhProc,/^20\d{2}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/);if(!Number.isFinite(Date.parse(authorizedAtUtc)))fail();
 const amount=str(obj(obj(d.valores).vServPrest).vServ,/^\d{1,11}\.\d{2}$/),[whole,cents]=amount.split('.'),amountCentsBRL=Number(whole)*100+Number(cents);
 if(!Number.isSafeInteger(amountCentsBRL)||amountCentsBRL<=0||amountCentsBRL>10000000000)fail();
 const description=str(obj(obj(d.serv).cServ).xDescServ,/^[\s\S]{1,1500}$/);
 return {authorityKey,number,issuerDocument,recipientDocument,amountCentsBRL,competence:competenceDate.slice(0,7),description,authorizedAtUtc:new Date(authorizedAtUtc).toISOString(),xmlHash:digest(bytes),schemaVersion:'1.01'};
}

export function createNationalEvidenceReader({loadWork,verifyAuthorization,now=Date.now}){
 // Sem verificadores reais de schema/assinatura/retorno oficial => fail closed.
 return async workId=>{
  if(!/^[a-f0-9]{64}$/.test(workId)||typeof verifyAuthorization!=='function')fail();
  const work=await loadWork(workId);
  if(!work||work.source!=='ATP'||work.provider!=='national'||work.status!=='issued'||!work.requestId||!work.provenance||work.test!==false)fail();
  const result=inspectNationalXml(work.xml);
  // Verificador deve usar bytes exatos/chain de confiança e consulta privada recente;
  // flags recebidas do navegador não são uma implementação deste verificador.
  const proof=await verifyAuthorization({xml:work.xml,xmlHash:result.xmlHash,authorityKey:result.authorityKey,schemaVersion:result.schemaVersion,workId});
  if(!proof||proof.xmlHash!==result.xmlHash||proof.authorityKey!==result.authorityKey||proof.schemaValid!==true||proof.signatureValid!==true||proof.authorityConfirmed!==true||proof.cancelled!==false||proof.environment!=='production')fail();
  const checked=Date.parse(proof.verifiedAtUtc),clock=now();
  if(!Number.isFinite(checked)||clock-checked>300000||checked-clock>30000||Date.parse(result.authorizedAtUtc)-clock>30000)fail();
  if(result.issuerDocument!=='57767099000179'||work.authorizedXmlHash!==result.xmlHash||work.provenance.requestId!==work.requestId)fail();
  return {workId,source:'ATP',requestId:work.requestId,status:'issued',test:false,provider:'national',...result,servicePeriod:work.provenance.servicePeriod,xml:work.xml,authorizedXmlVerified:true,authorizedXmlHash:result.xmlHash,...(work.pdf?{pdf:work.pdf,officialPdfHash:work.officialPdfHash}:{})};
 };
}

// Caminho preferido: a própria consulta autenticada do emissor oficial fornece
// os bytes e a situação atual. Não exige um serviço customizado de assinatura.
// consultOfficial é dependência PRIVADA de servidor, nunca corpo/upload da UI.
// Seu transporte mTLS, contrato HTTP e normalização de eventos ainda precisam
// ser homologados; esta função não transforma um HTTP 200 genérico em autorização.
export function createOfficialQueryEvidenceReader({loadWork,consultOfficial,now=Date.now}){
 return async workId=>{
  if(typeof consultOfficial!=='function'||!/^[a-f0-9]{64}$/.test(workId))fail();
  const work=await loadWork(workId);
  if(!work||work.source!=='ATP'||work.provider!=='national'||work.status!=='issued'||work.test!==false||work.provenance?.requestId!==work.requestId||!/^\d{50}$/.test(work.authorityKey||''))fail();
  const official=await consultOfficial(work.authorityKey);
  if(!official||official.provider!=='national'||official.environment!=='production'||official.authorityKey!==work.authorityKey||official.status!=='authorized'||official.cancelled!==false||official.substituted!==false||!Buffer.isBuffer(official.xml))fail();
  const checked=Date.parse(official.checkedAtUtc),clock=now();
  if(!Number.isFinite(checked)||clock-checked>300000||checked-clock>30000)fail();
  const fields=inspectNationalXml(official.xml);
  if(fields.authorityKey!==work.authorityKey||fields.issuerDocument!=='57767099000179'||fields.xmlHash!==work.authorizedXmlHash||Date.parse(fields.authorizedAtUtc)-clock>30000)fail();
  return {workId,source:'ATP',requestId:work.requestId,status:'issued',test:false,provider:'national',...fields,servicePeriod:work.provenance.servicePeriod,xml:official.xml,authorizedXmlVerified:true,authorizedXmlHash:fields.xmlHash,...(work.pdf?{pdf:work.pdf,officialPdfHash:work.officialPdfHash}:{})};
 };
}
