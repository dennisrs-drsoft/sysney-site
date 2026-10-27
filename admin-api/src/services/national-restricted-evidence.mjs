import {inspectNationalXml} from './atp-authorized-xml.mjs';
import {validatePreparation,digest} from './atp-fiscal-v1.mjs';
const fail=()=>{throw Object.assign(Error('RESTRICTED_XML_BINDING_MISMATCH'),{code:'RESTRICTED_XML_BINDING_MISMATCH'});};
export function reconcileRestrictedAuthorization({work,request,provenance,result,now=Date.now()}){
 try{
  const input=validatePreparation(request.input),f=inspectNationalXml(result.xml,{environment:'homologacao'});
  const expectedDescription=(work.synthetic?'SIMULACAO LOCAL NAO TRANSMITIR. ':'')+input.description;
  if(request.source!=='ATP'||work.environment!=='homologacao'||request.id!==work.requestId||work.requestHash!==request.hash||digest(JSON.stringify(input))!==request.hash||provenance?.source!=='ATP'||provenance.requestId!==request.id||provenance.workId!==work.workId||provenance.paymentId!==input.paymentId||provenance.externalReference!==input.externalReference||provenance.snapshotHash!==work.snapshotHash)fail();
  if(result.tipoAmbiente!==2||f.authorityKey!==result.chaveAcesso||result.idDps!==work.idDps||f.dpsId!==work.idDps||f.issuerDocument!=='57767099000179'||f.recipientDocument!==input.recipient.document||f.recipientType!==input.recipient.documentType||f.amountCentsBRL!==input.amountCentsBRL||f.competence!==input.competence||f.competenceDate!==input.servicePeriod.startDate||f.description!==expectedDescription||f.municipalityCode!=='3550308'||f.serviceMunicipality!=='3550308'||f.serviceCode!==work.serviceCode||Date.parse(f.emissionAt)!==Date.parse(work.emissionAt))fail();
  const at=Date.parse(f.authorizedAtUtc),prepared=Date.parse(work.createdAtUtc);
  if(!Number.isFinite(at)||!Number.isFinite(prepared)||at<prepared||at>now+30000||f.xmlHash!==digest(result.xml))fail();
  // Cancellation/substitution is not inferred from successful authorization or
  // a specific event404. No complete ADN snapshot is wired: fail closed globally.
  return {...f,requestId:request.id,workId:work.workId,orderId:input.orderId,arenaId:input.arenaId,paymentId:input.paymentId,externalReference:input.externalReference,servicePeriod:input.servicePeriod,authorization:'confirmed_restricted',authorityStatus:'unknown',cancelled:null,substituted:null,requiresReview:true,productionIssued:false};
 }catch{fail();}
}
