const fail=code=>{throw Error(code);};
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
// This adapter has no Asaas credential. Only ATP verifies payment/provider state.
export function createAtpPaymentGate({baseUrl,mode='production',tokenProvider,fetcher=fetch,now=()=>Date.now()}){
 const url=new URL(baseUrl);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(mode==='production'&&url.origin==='https://api.agoratemplay.com.br'||mode==='simulation'&&url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port))fail('ATP_PAYMENT_GATE_ORIGIN_REQUIRED');
 const origin=url.origin;
 async function post(path,body,token){
  if(typeof token!=='string'||token.length<43||token.length>512||/\s/.test(token))fail('ATP_PAYMENT_GATE_CREDENTIAL_REQUIRED');
  const sent=now();let r;
  try{r=await fetcher(origin+path,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});}catch{fail('ATP_PAYMENT_GATE_UNAVAILABLE');}
  if(r.status!==200||!r.headers.get('content-type')?.includes('application/json'))fail('ATP_PAYMENT_GATE_UNAVAILABLE');
  const chunks=[];let size=0;for await(const b of r.body){size+=b.length;if(size>16384)fail('ATP_PAYMENT_GATE_RESPONSE_LIMIT');chunks.push(Buffer.from(b));}
  let v;try{v=JSON.parse(Buffer.concat(chunks).toString());}catch{fail('ATP_PAYMENT_GATE_RESPONSE_INVALID');}
  const received=now();
  if(!v||Array.isArray(v)||v.protocolVersion!=='1'||typeof v.authorized!=='boolean')fail('ATP_PAYMENT_GATE_RESPONSE_INVALID');
  for(const key of ['requestId','externalReference','requestHash','policyHash',...(body.phase?['phase']:['authorizationId','executionId']),...(body.workId?['workId','xmlHash','dispatchReservationId','controlFence']:[])])if(v[key]!==body[key])fail('ATP_PAYMENT_GATE_BINDING_REVIEW_REQUIRED');
  if(v.authorized!==true)fail('ATP_PAYMENT_NOT_AUTHORIZED_REVIEW_REQUIRED');
  const checked=Date.parse(v.checkedAtUtc),expires=Date.parse(v.expiresAtUtc);
  if(!Number.isFinite(checked)||!Number.isFinite(expires)||checked<sent-5000||checked>received+5000||expires<=received||expires<=checked||expires-checked>180000)fail('ATP_PAYMENT_GATE_EXPIRED');
  if(body.fiscalDeadlineUtc&&expires>Date.parse(body.fiscalDeadlineUtc))fail('ATP_PAYMENT_GATE_DEADLINE_REVIEW_REQUIRED');
  return v;
 }
 return {
  async authorize({phase,request,policyHash,dispatch}){
   if(!['prepare','dispatch'].includes(phase)||!hex(request?.id)||!hex(request.hash)||!hex(policyHash))fail('ATP_PAYMENT_GATE_INPUT_INVALID');
   const body={protocolVersion:'1',phase,requestId:request.id,paymentId:request.input.paymentId,externalReference:request.input.externalReference,requestHash:request.hash,policyHash,notBeforeUtc:request.input.issuanceWindow?.notBeforeUtc,fiscalDeadlineUtc:request.input.issuanceWindow?.fiscalDeadlineUtc,...(dispatch||{})};
   if(phase==='dispatch'&&(!hex(body.workId)||!hex(body.xmlHash)||!hex(body.dispatchReservationId)||!Number.isSafeInteger(body.controlFence)))fail('ATP_PAYMENT_GATE_INPUT_INVALID');
   const v=await post('/api/internal/fiscal-sysney/authorize',body,await tokenProvider());
   if(typeof v.authorizationId!=='string'||!/^[a-f0-9]{32}$/.test(v.authorizationId))fail('ATP_PAYMENT_GATE_RESPONSE_INVALID');
   if(phase==='dispatch'&&(typeof v.permitToken!=='string'||!/^[A-Za-z0-9_-]{64}$/.test(v.permitToken)))fail('ATP_PAYMENT_GATE_RESPONSE_INVALID');
   return v;
  },
  async consume({permit,executionId,request,workId,xmlHash,dispatch,policyHash}){
   if(!permit||permit.authorized!==true||permit.phase!=='dispatch'||!/^[a-f0-9]{32}$/.test(permit.authorizationId||'')||!/^[A-Za-z0-9_-]{64}$/.test(permit.permitToken||'')||typeof executionId!=='string'||!/^[\x21-\x7e]{1,128}$/.test(executionId)||!Number.isFinite(Date.parse(permit.expiresAtUtc))||Date.parse(permit.expiresAtUtc)<=now())fail('ATP_PAYMENT_PERMIT_EXPIRED');
   const body={protocolVersion:'1',authorizationId:permit.authorizationId,requestId:request.id,externalReference:request.input.externalReference,requestHash:request.hash,policyHash,workId,xmlHash,dispatchReservationId:dispatch.reservationId,controlFence:dispatch.controlFence,executionId};
   for(const key of ['requestId','externalReference','requestHash','policyHash','workId','xmlHash','dispatchReservationId','controlFence'])if(permit[key]!==body[key])fail('ATP_PAYMENT_GATE_BINDING_REVIEW_REQUIRED');
   const v=await post('/api/internal/fiscal-sysney/consume',body,permit.permitToken);
   if(v.phase!=='consume')fail('ATP_PAYMENT_GATE_BINDING_REVIEW_REQUIRED');
   if(Date.parse(v.expiresAtUtc)>Date.parse(permit.expiresAtUtc))fail('ATP_PAYMENT_PERMIT_EXTENDED');
   return v;
  },
 };
}
