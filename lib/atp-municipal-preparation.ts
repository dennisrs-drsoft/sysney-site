import {normalizarFiscalSP,validarNotaSP,montarXmlSP,hashNotaSP,type DadosNotaSP,type FiscalSP} from './nfse-sp';
// Offline adapter only. No counter, queue, executor, upload, email or emission.
type Input={paymentId:string;orderId:string;competence:string;servicePeriod:{startDate:string;endDate:string};amountCentsBRL:number;description:string;recipient:{documentType:'CNPJ'|'CPF';document:string;legalName:string;confirmed:boolean;address:{streetType:string;street:string;number:string;complement?:string;district:string;municipalityCode:string;state:string;postalCode:string}}};
export function prepareAtpMunicipalPreview({input,issuer,approvedService,profileVersion,emissionDate,series,number}:{input:Input;issuer:{cnpj:string;inscricao:string};approvedService:FiscalSP;profileVersion:string;emissionDate:string;series:string;number:string}){
 if(!profileVersion||profileVersion.length>100||issuer.cnpj!=='57767099000179'||!/^\d{8}$/.test(issuer.inscricao))throw Error('ATP_MUNICIPAL_PROFILE_REQUIRED');
 if(approvedService.regime!=='simples'||approvedService.codigoServico!=='03158'||approvedService.municipioPrestacao!=='3550308')throw Error('ATP_MUNICIPAL_PROFILE_MISMATCH');
 // November is not silently routed to municipal on accountant advice. Official
 // SP19/10 rule requires national; existing national remains disabled. Review.
 if(input.competence>='2026-11'||input.servicePeriod.endDate>='2026-11-01')throw Error('ATP_NOVEMBER_ROUTING_REVIEW_REQUIRED');
 if(emissionDate>='2026-11-01')throw Error('ATP_RETROACTIVE_MUNICIPAL_REVIEW_REQUIRED');
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(input.servicePeriod.startDate)||!/^20\d{2}-\d{2}-\d{2}$/.test(input.servicePeriod.endDate)||input.servicePeriod.endDate<input.servicePeriod.startDate||input.servicePeriod.startDate.slice(0,7)!==input.competence)throw Error('ATP_SERVICE_PERIOD_REQUIRED');
 if(input.recipient.documentType!=='CNPJ'||!input.recipient.confirmed)throw Error('ATP_MUNICIPAL_CNPJ_ONLY');
 const a=input.recipient.address;
 // Technical RPS key/date and ATP recipient ALWAYS replace legacy client data.
 const fiscal=normalizarFiscalSP({...approvedService,serie:series,numeroInicial:number,dataEmissao:emissionDate,endereco:{tipo:a.streetType,logradouro:a.street,numero:a.number,complemento:a.complement,bairro:a.district,municipio:a.municipalityCode,uf:a.state,cep:a.postalCode}},input.amountCentsBRL);
 const dados:DadosNotaSP={empresa:'sysney',cnpj:issuer.cnpj,inscricao:issuer.inscricao,clienteDocumento:input.recipient.document,clienteNome:input.recipient.legalName,competencia:input.competence,centavos:input.amountCentsBRL,descricao:input.description,po:'',numero:number,fiscal};
 validarNotaSP(dados);
 return {dados,hash:hashNotaSP(dados),xmlTeste:montarXmlSP(dados,true),profileVersion,source:'ATP' as const,paymentId:input.paymentId,orderId:input.orderId,emissionEnabled:false as const,numberReserved:false as const,nationalEnabled:false as const};
}
