import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {digest} from './atp-fiscal-v1.mjs';
import {municipalNamespace} from './atp-municipal-model.mjs';
import {readBoundedPdfText} from './national-danfse.mjs';
const fail=()=>{throw Error('ATP_MUNICIPAL_EVIDENCE_MISMATCH');};
const one=v=>{if(!v||typeof v!=='object'||Array.isArray(v))fail();return v;};
const string=v=>{if(typeof v!=='string')fail();return v;};
const cents=v=>{if(typeof v!=='string'||!/^\d{1,11}(?:\.\d{1,2})?$/.test(v))fail();const [whole,fraction='']=v.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));};
export function reconcileAtpMunicipal({xml,work,request,provenance,receivedAtUtc}){
 if(!Buffer.isBuffer(xml)||xml.length>1_000_000)fail();
 const text=new TextDecoder('utf-8',{fatal:true}).decode(xml);
 if(/<!|<\?(?!xml\s)/i.test(text)||XMLValidator.validate(text)!==true)fail();
 const parsed=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false,processEntities:true}).parse(text);
 const roots=Object.keys(parsed).filter(k=>k!=='?xml');if(roots.length!==1)fail();
 const rootName=roots[0],prefix=rootName.includes(':')?rootName.split(':')[0]:null;
 if(!['RetornoConsulta','RetornoConsultaNFe'].includes(rootName.split(':').at(-1)))fail();
 const root=one(parsed[rootName]);if(root[prefix?'@_xmlns:'+prefix:'@_xmlns']!==municipalNamespace)fail();
 let nodes=0;
 function walk(v,depth=0){if(depth>35||++nodes>2000)fail();if(Array.isArray(v))fail();if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){if(k.includes(':')&&!k.startsWith('@_xmlns'))fail();if(k.startsWith('@_xmlns')&&!(v===root&&k===(prefix?'@_xmlns:'+prefix:'@_xmlns')))fail();walk(x,depth+1);}}
 walk(root);
 const n=one(root.NFe),h=one(root.Cabecalho),k=one(n.ChaveNFe),rps=one(n.ChaveRPS),tom=one(n.CPFCNPJTomador),i=request.input;
 if(h.Sucesso!=='true'||root.Erro||n.StatusNFe!=='N'||n.DataCancelamento)fail();
 if(work.requestId!==request.id||work.requestHash!==request.hash||digest(JSON.stringify(i))!==request.hash||provenance?.source!=='ATP'||provenance.requestId!==request.id||provenance.workId!==work.workId||provenance.snapshotHash!==work.snapshotHash||provenance.paymentId!==i.paymentId||provenance.externalReference!==i.externalReference)fail();
 if(n.CPFCNPJPrestador?.CNPJ!=='57767099000179'||Object.keys(tom).length!==1||tom[i.recipient.documentType]!==i.recipient.document||k.InscricaoPrestador!==work.issuer.inscricao||rps.InscricaoPrestador!==work.issuer.inscricao||rps.SerieRPS!==work.series||BigInt(string(rps.NumeroRPS))!==BigInt(work.number)||n.DataEmissaoRPS!==work.emissionDate||!/^0?3158$/.test(n.CodigoServico)||n.Discriminacao!==i.description||cents(n.ValorServicos)!==i.amountCentsBRL||n.TributacaoNFe!=='T'||!['false','0'].includes(n.ISSRetido)||n.OpcaoSimples!=='4'||string(n.DataFatoGeradorNFe).slice(0,7)!==i.competence)fail();
 for(const field of ['ValorDeducoes','ValorPIS','ValorCOFINS','ValorINSS','ValorIR','ValorCSLL'])if(n[field]!==undefined&&cents(n[field])!==0)fail();
 if(!/^\d{1,12}$/.test(k.NumeroNFe)||!/^\w{8}$/.test(k.CodigoVerificacao))fail();
 // SP dates are local civil timestamps; demand an offset for an unambiguous instant.
 const date=string(n.DataEmissaoNFe),instant=/Z$|[+-]\d\d:\d\d$/.test(date)?date:date+'-03:00';
 const authorized=Date.parse(instant),received=Date.parse(receivedAtUtc);
 if(!Number.isFinite(authorized)||!Number.isFinite(received)||authorized<Date.parse(provenance.createdAtUtc)-1000||authorized>received+300000||date.slice(0,10)!==work.emissionDate)fail();
 return {source:'ATP',workId:work.workId,requestId:request.id,status:'issued',test:false,provider:'municipal_sp',issuerDocument:'57767099000179',recipientDocument:i.recipient.document,amountCentsBRL:i.amountCentsBRL,competence:i.competence,servicePeriod:i.servicePeriod,description:i.description,number:String(BigInt(k.NumeroNFe)),verification:k.CodigoVerificacao,authorityKey:`${work.issuer.inscricao}:${String(BigInt(k.NumeroNFe))}:${k.CodigoVerificacao}`,authorizedAtUtc:new Date(authorized).toISOString(),xml,authorizedXmlVerified:true,authorizedXmlHash:digest(xml)};
}
export async function validateAtpMunicipalPdf(bytes,evidence){
 const {normalized,pages}=await readBoundedPdfText(bytes),digits=normalized.replace(/\D/g,'');
 const match=normalized.match(/Numero\s+da\s+N(?:FS[ -]?e|ota)\s*:?\s*(\d+)/i);
 const amount=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(evidence.amountCentsBRL/100);
 if(!match||BigInt(match[1])!==BigInt(evidence.number)||!normalized.includes(evidence.verification)||!digits.includes(evidence.issuerDocument)||!digits.includes(evidence.recipientDocument)||!normalized.includes(amount))throw Error('ATP_MUNICIPAL_PDF_BINDING_UNVERIFIED');
 return {sha256:digest(bytes),pages,contentVerified:true,method:'bounded-content-stream-profile'};
}
