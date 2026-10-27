import {digest,validatePreparation} from './atp-fiscal-v1.mjs';
export const municipalNamespace='http://www.prefeitura.sp.gov.br/nfe';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fail=code=>{throw Error(code);};
export function buildAtpMunicipal({input,profile,series,number,emissionDate}){
 input=validatePreparation(input);
 if(!profile?.version||profile.version.length>100||profile.issuer?.cnpj!=='57767099000179'||!/^\d{8}$/.test(profile.issuer.inscricao)||profile.regime!=='simples'||profile.codigoServico!=='03158'||profile.municipioPrestacao!=='3550308'||profile.aliquota!=='0'||profile.issRetido!==false)fail('ATP_MUNICIPAL_PROFILE_REQUIRED');
 if(!/^[A-Z0-9]{1,5}$/.test(series)||!/^\d{1,12}$/.test(number)||BigInt(number)<1n)fail('ATP_RPS_KEY_INVALID');
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(emissionDate)||new Date(emissionDate).toISOString().slice(0,10)!==emissionDate)fail('ATP_EMISSION_DATE_INVALID');
 if(input.competence>='2026-11'||input.servicePeriod.endDate>='2026-11-01'||emissionDate>='2026-11-01')fail('ATP_NOVEMBER_ROUTING_REVIEW_REQUIRED');
 if(input.servicePeriod.startDate.slice(0,7)!==input.competence)fail('ATP_SERVICE_PERIOD_REVIEW_REQUIRED');
 const r=input.recipient,a=r.address;
 for(const [value,max] of [[r.legalName,75],[a.streetType,3],[a.street,50],[a.number,10],[a.complement||'',30],[a.district,30]])if(value.length>max)fail('ATP_MUNICIPAL_FIELD_TOO_LONG');
 const ccm=profile.issuer.inscricao,amount=(input.amountCentsBRL/100).toFixed(2);
 const key=`<ChaveRPS><InscricaoPrestador>${ccm}</InscricaoPrestador><SerieRPS>${series}</SerieRPS><NumeroRPS>${number}</NumeroRPS></ChaveRPS>`;
 const header=`<CPFCNPJRemetente><CNPJ>${profile.issuer.cnpj}</CNPJ></CPFCNPJRemetente>`;
 // Manual municipal: indicator 1 CPF / 2 CNPJ; CPF padded ONLY in the ASCII chain.
 const chain=ccm+series.padEnd(5,' ')+number.padStart(12,'0')+emissionDate.replaceAll('-','')+'TNN'+String(input.amountCentsBRL).padStart(15,'0')+'0'.repeat(15)+'03158'+(r.documentType==='CPF'?'1':'2')+r.document.padStart(14,'0');
 if(chain.length!==86)fail('ATP_RPS_CHAIN_INVALID');
 const rps=`<RPS><Assinatura>AA==</Assinatura>${key}<TipoRPS>RPS</TipoRPS><DataEmissao>${emissionDate}</DataEmissao><StatusRPS>N</StatusRPS><TributacaoRPS>T</TributacaoRPS><ValorServicos>${amount}</ValorServicos><ValorDeducoes>0.00</ValorDeducoes><ValorPIS>0.00</ValorPIS><ValorCOFINS>0.00</ValorCOFINS><ValorINSS>0.00</ValorINSS><ValorIR>0.00</ValorIR><ValorCSLL>0.00</ValorCSLL><CodigoServico>03158</CodigoServico><AliquotaServicos>0.000000</AliquotaServicos><ISSRetido>false</ISSRetido><CPFCNPJTomador><${r.documentType}>${r.document}</${r.documentType}></CPFCNPJTomador><RazaoSocialTomador>${esc(r.legalName)}</RazaoSocialTomador><EnderecoTomador><TipoLogradouro>${esc(a.streetType)}</TipoLogradouro><Logradouro>${esc(a.street)}</Logradouro><NumeroEndereco>${esc(a.number)}</NumeroEndereco>${a.complement?`<ComplementoEndereco>${esc(a.complement)}</ComplementoEndereco>`:''}<Bairro>${esc(a.district)}</Bairro><Cidade>${a.municipalityCode}</Cidade><UF>${a.state}</UF><CEP>${a.postalCode}</CEP></EnderecoTomador><Discriminacao>${esc(input.description)}</Discriminacao></RPS>`;
 const wrap=(name,body)=>`<p:${name} xmlns:p="${municipalNamespace}">${body}</p:${name}>`;
 const xml=wrap('PedidoEnvioRPS',`<Cabecalho Versao="1">${header}</Cabecalho>${rps}`);
 const testXml=wrap('PedidoEnvioLoteRPS',`<Cabecalho Versao="1">${header}<transacao>true</transacao><dtInicio>${emissionDate}</dtInicio><dtFim>${emissionDate}</dtFim><QtdRPS>1</QtdRPS><ValorTotalServicos>${amount}</ValorTotalServicos><ValorTotalDeducoes>0.00</ValorTotalDeducoes></Cabecalho>${rps}`);
 const queryXml=wrap('PedidoConsultaNFe',`<Cabecalho Versao="1">${header}</Cabecalho><Detalhe>${key}</Detalhe>`);
 return {input,xml,testXml,queryXml,chain,series,number,emissionDate,issuer:profile.issuer,profileHash:digest(JSON.stringify(profile)),hash:digest(xml)};
}
