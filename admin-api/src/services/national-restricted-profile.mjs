import {validatePreparation} from './atp-fiscal-v1.mjs';
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export const NATIONAL_PROFILE_FIELDS=[
 {key:'issuer.opSimpNac',source:'regime cadastral nacional',meaning:'Indicador nacional de opção pelo Simples (não alíquota)'},
 {key:'issuer.regEspTrib',source:'configuração tributária externa',meaning:'Regime especial de tributação aplicável'},
 {key:'service.cTribNac',source:'configuração tributária externa',meaning:'Código nacional do serviço ATP, seis dígitos'},
 {key:'service.tribISSQN',source:'configuração tributária externa',meaning:'Tratamento de tributação do ISSQN'},
 {key:'service.tpRetISSQN',source:'configuração tributária externa',meaning:'Tipo de retenção do ISSQN'},
 {key:'service.totTrib',source:'configuração tributária externa',meaning:'Modalidade e valores/percentuais de transparência tributária'},
 {key:'dps.serie',source:'configuração técnica',meaning:'Série DPS restrita própria; não série RPS municipal'},
];
const get=(p,key)=>key.split('.').reduce((o,k)=>o?.[k],p);
export function missingNationalConfiguration(profile={}){
 const missing=NATIONAL_PROFILE_FIELDS.filter(f=>get(profile,f.key)===undefined||get(profile,f.key)==='');
 if(profile.issuer?.opSimpNac==='3'&&profile.issuer?.regApTribSN===undefined)missing.push({key:'issuer.regApTribSN',source:'configuração tributária externa',meaning:'Regime de apuração nacional do Simples, quando aplicável à ME/EPP'});
 if(profile.service?.cTribNac==='000000')missing.push({key:'service.cTribNac',source:'configuração tributária externa',meaning:'Código 000000 é fictício e não pode habilitar transmissão'});
 return missing;
}
export function buildRestrictedDps({profile,request,number,emissionAt,synthetic=false}){
 validatePreparation(request);
 const missing=missingNationalConfiguration(profile).filter(f=>!(synthetic&&f.key==='service.cTribNac'&&profile.service?.cTribNac==='000000'));
 if(missing.length)throw Object.assign(Error('NATIONAL_CONFIGURATION_MISSING'),{fields:missing.map(f=>f.key)});
 const p=profile.issuer,s=profile.service,serie=String(profile.dps.serie),n=String(number),r=request.recipient;
 const only=(o,keys)=>Object.keys(o).every(k=>keys.includes(k));
 if(!only(profile,['issuer','service','dps'])||!only(p,['opSimpNac','regEspTrib','regApTribSN'])||!only(s,['cTribNac','cTribMun','cNBS','tribISSQN','tpRetISSQN','pAliq','totTrib'])||!only(profile.dps,['serie'])||s.tribISSQN!=='1')throw Error('NATIONAL_PROFILE_UNSUPPORTED');
 if(!/^\d{1,5}$/.test(serie)||! /^[1-9]\d{0,14}$/.test(n)||!/^\d{6}$/.test(s.cTribNac)||! /^[123]$/.test(p.opSimpNac)||! /^\d$/.test(p.regEspTrib)||! /^[1234]$/.test(s.tribISSQN)||! /^[123]$/.test(s.tpRetISSQN)||!Number.isSafeInteger(request.amountCentsBRL)||request.amountCentsBRL<=0||request.amountCentsBRL>10000000000)throw Error('NATIONAL_PROFILE_INVALID');
 // A data do serviço vem do período confirmado, jamais da data do crédito bancário.
 const competenceDate=request.servicePeriod.startDate;
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(competenceDate)||competenceDate.slice(0,7)!==request.competence||!Number.isFinite(Date.parse(competenceDate)))throw Error('COMPETENCE_DATE_REVIEW_REQUIRED');
 if(!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(emissionAt)||!Number.isFinite(Date.parse(emissionAt)))throw Error('NATIONAL_EMISSION_TIME_INVALID');
 if(!r?.confirmed||!['CNPJ','CPF'].includes(r.documentType)||!(r.documentType==='CNPJ'?/^\d{14}$/:/^\d{11}$/).test(r.document))throw Error('RECIPIENT_REQUIRED');
 const tax=s.totTrib;
 if(!tax||!['indTotTrib','pTotTribSN'].includes(tax.kind)||typeof tax.value!=='string'||!(tax.kind==='indTotTrib'?/^0$/:/^\d{1,2}\.\d{2}$/).test(tax.value))throw Error('TAX_DISCLOSURE_PROFILE_UNSUPPORTED');
 const optional=(tag,v)=>v===undefined?'':`<${tag}>${esc(v)}</${tag}>`;
 const id=`DPS3550308257767099000179${serie.padStart(5,'0')}${n.padStart(15,'0')}`;
 const description=(synthetic?'SIMULACAO LOCAL NAO TRANSMITIR. ':'')+request.description;
 const a=r.address,address=`<end><endNac><cMun>${a.municipalityCode}</cMun><CEP>${a.postalCode}</CEP></endNac><xLgr>${esc(a.streetType+' '+a.street)}</xLgr><nro>${esc(a.number)}</nro>${a.complement?optional('xCpl',a.complement):''}<xBairro>${esc(a.district)}</xBairro></end>`;
 const xml=`<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infDPS Id="${id}"><tpAmb>2</tpAmb><dhEmi>${emissionAt}</dhEmi><verAplic>SYSNEY-ATP-QA</verAplic><serie>${serie}</serie><nDPS>${n}</nDPS><dCompet>${competenceDate}</dCompet><tpEmit>1</tpEmit><finNFSe>0</finNFSe><cLocEmi>3550308</cLocEmi><prest><CNPJ>57767099000179</CNPJ><regTrib><opSimpNac>${p.opSimpNac}</opSimpNac>${optional('regApTribSN',p.regApTribSN)}<regEspTrib>${p.regEspTrib}</regEspTrib></regTrib></prest><toma><${r.documentType}>${r.document}</${r.documentType}><xNome>${esc(r.legalName)}</xNome></toma><serv><locPrest><cLocPrestacao>3550308</cLocPrestacao></locPrest><cServ><cTribNac>${s.cTribNac}</cTribNac>${optional('cTribMun',s.cTribMun)}${optional('cNBS',s.cNBS)}<xDescServ>${esc(description)}</xDescServ></cServ></serv><valores><vServPrest><vServ>${(request.amountCentsBRL/100).toFixed(2)}</vServ></vServPrest><trib><tribMun><tribISSQN>${s.tribISSQN}</tribISSQN><tpRetISSQN>${s.tpRetISSQN}</tpRetISSQN>${optional('pAliq',s.pAliq)}</tribMun><totTrib><${tax.kind}>${tax.value}</${tax.kind}></totTrib></trib></valores></infDPS></DPS>`;
 const withAddress=xml.replace('</xNome></toma>',`</xNome>${address}</toma>`);
 return {idDps:id,xml:Buffer.from(withAddress,'utf8'),environment:'homologacao',synthetic};
}
