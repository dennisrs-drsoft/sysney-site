import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildRestrictedDps,missingNationalConfiguration} from '../admin-api/src/services/national-restricted-profile.mjs';
const request=JSON.parse(await readFile(new URL('../postman/fixtures/atp-fiscal-v1.synthetic.json',import.meta.url),'utf8'));
const profile={issuer:{opSimpNac:'3',regApTribSN:'1',regEspTrib:'0'},service:{cTribNac:'000000',tribISSQN:'1',tpRetISSQN:'1',totTrib:{kind:'indTotTrib',value:'0'}},dps:{serie:'1'}};
test('perfil ausente retorna chaves exatas, sem parecer contabil',()=>{assert.ok(missingNationalConfiguration().some(f=>f.key==='service.cTribNac'));assert.throws(()=>buildRestrictedDps({profile,request,number:'1',emissionAt:'2026-10-27T12:00:00-03:00'}),{message:'NATIONAL_CONFIGURATION_MISSING'});});
test('DPS sintetica usa ambiente2, sequencia propria e bloqueio de envio',()=>{const d=buildRestrictedDps({profile,request,number:'1',emissionAt:'2026-10-27T12:00:00-03:00',synthetic:true});assert.match(d.xml.toString(),/<tpAmb>2<\/tpAmb>/);assert.match(d.xml.toString(),/NAO TRANSMITIR/);assert.equal(d.idDps,'DPS355030825776709900017900001000000000000001');});
