import {readFile} from 'node:fs/promises';
import {buildRestrictedDps} from '../../admin-api/src/services/national-restricted-profile.mjs';
const request=JSON.parse(await readFile(new URL('../../postman/fixtures/atp-fiscal-v1.synthetic.json',import.meta.url)));
const profile={issuer:{opSimpNac:'3',regApTribSN:'1',regEspTrib:'0'},service:{cTribNac:'000000',tribISSQN:'1',tpRetISSQN:'1',totTrib:{kind:'indTotTrib',value:'0'}},dps:{serie:'99'}};
process.stdout.write(buildRestrictedDps({profile,request,number:'1',emissionAt:'2026-10-27T12:00:00-03:00',synthetic:true}).xml);
