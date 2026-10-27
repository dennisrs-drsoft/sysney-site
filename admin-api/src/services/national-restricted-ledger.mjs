// Recebe TableClient autenticado do servidor. Sem credencial ou endpoint no corpo.
const partitionKey='nacional-restrita-ledger-v1';
export function createRestrictedDpsLedger(table){
 const check=id=>{if(!/^DPS3550308257767099000179\d{20}$/.test(id))throw Error('INVALID_DPS');};
 return {
  async get(id){check(id);try{const r=await table.getEntity(partitionKey,id);return JSON.parse(r.json);}catch(e){if(e.statusCode===404)return null;throw e;}},
  async reserve(r){check(r.idDps);if(!/^[a-f0-9]{64}$/.test(r.hash)||r.status!=='transmitting')throw Error('INVALID_RESERVATION');await table.createEntity({partitionKey,rowKey:r.idDps,json:JSON.stringify({...r,createdAtUtc:new Date().toISOString()})});},
 };
}
