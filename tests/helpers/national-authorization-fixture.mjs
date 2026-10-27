import {readFile} from 'node:fs/promises';
import {buildRestrictedDps} from '../../admin-api/src/services/national-restricted-profile.mjs';
import {digest,validatePreparation} from '../../admin-api/src/services/atp-fiscal-v1.mjs';
export const key='1'.repeat(50);
export async function authorizationFixture(){
 const input=validatePreparation(JSON.parse(await readFile(new URL('../../postman/fixtures/atp-fiscal-v1.synthetic.json',import.meta.url))));
 const profile={issuer:{opSimpNac:'3',regApTribSN:'1',regEspTrib:'0'},service:{cTribNac:'000000',tribISSQN:'1',tpRetISSQN:'1',totTrib:{kind:'indTotTrib',value:'0'}},dps:{serie:'99'}};
 const draft=buildRestrictedDps({profile,request:input,number:'1',emissionAt:'2026-10-27T12:00:00-03:00',synthetic:true});
 const request={id:'a'.repeat(64),source:'ATP',input,hash:digest(JSON.stringify(input))};
 const work={workId:'b'.repeat(64),requestId:request.id,requestHash:request.hash,snapshotHash:digest('snapshot'),idDps:draft.idDps,emissionAt:'2026-10-27T12:00:00-03:00',serviceCode:'000000',createdAtUtc:'2026-10-27T15:00:01Z',environment:'homologacao',synthetic:true};
 const provenance={source:'ATP',workId:work.workId,requestId:request.id,paymentId:input.paymentId,externalReference:input.externalReference,snapshotHash:work.snapshotHash};
 const xml=Buffer.from(`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS${key}"><nNFSe>53</nNFSe><dhProc>2026-10-27T15:00:02Z</dhProc><emit><CNPJ>57767099000179</CNPJ></emit>${draft.xml.toString().replace(/<\?xml[^?]*\?>/,'')}</infNFSe></NFSe>`);
 return {request,work,provenance,result:{tipoAmbiente:2,chaveAcesso:key,idDps:work.idDps,xml},now:Date.parse('2026-10-27T15:01:00Z')};
}
