import {digest} from './atp-fiscal-v1.mjs';
import {randomUUID} from 'node:crypto';
// One partition per automation deployment; per-request lease+checkpoint use CAS.
// Production must supply a fixed not-before date: no implicit historical backfill.
export function createAtpAutomationStore(table,{now=()=>Date.now(),leaseMs=600000}={}){
 const partitionKey='atp-municipal-automation-v1';
 const read=async id=>{try{const e=await table.getEntity(partitionKey,id);return {...JSON.parse(e.json),etag:e.etag};}catch(e){if(e.statusCode===404)return null;throw e;}};
 const entity=v=>({partitionKey,rowKey:v.requestId,json:JSON.stringify({...v,etag:undefined})});
 return {
  get:read,
  async acquire({requestId,owner,requestHash,policyHash,seed}){
   const claimId=randomUUID();
   if(!/^[a-f0-9]{64}$/.test(requestId)||!owner||!/^[a-f0-9]{64}$/.test(requestHash)||!/^[a-f0-9]{64}$/.test(policyHash))throw Error('ATP_AUTOMATION_LEASE_INPUT');
   for(let i=0;i<4;i++){
    const old=await read(requestId);
    if(old&&(old.requestHash!==requestHash||old.policyHash!==policyHash))throw Error('ATP_AUTOMATION_POLICY_CHANGED_REVIEW');
    if(old?.leaseUntil>now())return null;
    const v={...(old||seed),requestId,requestHash,policyHash,owner,claimId,fence:(old?.fence||0)+1,leaseUntil:now()+leaseMs};
    try{if(old)await table.updateEntity(entity(v),'Replace',{etag:old.etag});else await table.createEntity(entity(v));return read(requestId);}
    catch(e){const saved=await read(requestId);if(saved?.claimId===claimId&&saved.fence===v.fence)return saved;if(![409,412].includes(e.statusCode))throw e;}
   }return null;
  },
  async assert(lease){const current=await read(lease.requestId);if(current?.owner!==lease.owner||current.claimId!==lease.claimId||current.fence!==lease.fence||current.leaseUntil<=now())throw Error('ATP_AUTOMATION_LEASE_LOST');return current;},
  async save(lease,changes){
   const current=await this.assert(lease),updated={...current,...changes,leaseUntil:now()+leaseMs,updatedAtUtc:new Date(now()).toISOString()};
   await table.updateEntity(entity(updated),'Replace',{etag:current.etag});return read(lease.requestId);
  },
  async release(lease){const current=await this.assert(lease);await table.updateEntity(entity({...current,leaseUntil:0}),'Replace',{etag:current.etag});},
 };
}
