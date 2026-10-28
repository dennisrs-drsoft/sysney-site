import {createHash, randomUUID, timingSafeEqual} from 'node:crypto';
import {lerCorpoLimitado, headersPrivados, ErroRequisicao} from './seguranca-http.mjs';

export const digest=v=>createHash('sha256').update(v).digest('hex');
const canonical=v=>JSON.stringify(v&&typeof v==='object'?(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))]))):v);
export class FiscalError extends Error {constructor(status,code,message,retryable=false){super(message);Object.assign(this,{status,code,retryable});}}
const invalid=()=>{throw new FiscalError(400,'INVALID_REQUEST','Confira os dados da solicitação fiscal.');};
const conflict=()=>{throw new FiscalError(409,'IDEMPOTENCY_CONFLICT','Referência já registrada com dados diferentes.');};
function object(v,required,optional=[]){if(!v||Array.isArray(v)||typeof v!=='object'||required.some(k=>!(k in v))||Object.keys(v).some(k=>![...required,...optional].includes(k)))invalid();}
function text(v,max,min=1){if(typeof v!=='string'||v.length<min||v.length>max||v!==v.trim()||/[\x00-\x1f]/.test(v))invalid();}
function date(v){if(typeof v!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)invalid();}
function timestamp(v){if(typeof v!=='string'||!/^20\d{2}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v)||!Number.isFinite(Date.parse(v)))invalid();date(v.slice(0,10));}
function documentValid(value,type){
 if(typeof value!=='string'||!(type==='CNPJ'?/^\d{14}$/:/^\d{11}$/).test(value)||/^(\d)\1+$/.test(value))return false;
 const base=value.slice(0,-2);let s=base;
 for(let step=0;step<2;step++){
  const weights=type==='CNPJ'?(step?[6,5,4,3,2,9,8,7,6,5,4,3,2]:[5,4,3,2,9,8,7,6,5,4,3,2]):Array.from({length:s.length},(_,i)=>s.length+1-i);
  const rem=[...s].reduce((sum,c,i)=>sum+Number(c)*weights[i],0)%11;
  s+=String(rem<2?0:11-rem);
 }
 return s===value;
}
export function validatePreparation(v){
 object(v,['paymentId','externalReference','orderId','arenaId','amountCentsBRL','paymentVerifiedAtUtc','competence','servicePeriod','description','recipient'],['paidAtUtc','issuanceWindow']);
 for(const k of ['paymentId','externalReference','orderId','arenaId'])text(v[k],160);
 if(!Number.isSafeInteger(v.amountCentsBRL)||v.amountCentsBRL<1||v.amountCentsBRL>10000000000)invalid();
 timestamp(v.paymentVerifiedAtUtc);if(v.paidAtUtc!==undefined)timestamp(v.paidAtUtc);
 if(v.issuanceWindow!==undefined){const w=v.issuanceWindow;object(w,['notBeforeUtc','fiscalDeadlineUtc','policyVersion']);timestamp(w.notBeforeUtc);timestamp(w.fiscalDeadlineUtc);text(w.policyVersion,100);const delta=Date.parse(w.notBeforeUtc)-Date.parse(v.paymentVerifiedAtUtc);if(delta<=0||delta>86400000)invalid();}
 if(typeof v.competence!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(v.competence))invalid();
 object(v.servicePeriod,['startDate','endDate']);date(v.servicePeriod.startDate);date(v.servicePeriod.endDate);if(v.servicePeriod.endDate<v.servicePeriod.startDate)invalid();text(v.description,1500);
 const r=v.recipient;object(r,['documentType','document','legalName','confirmed','address']);
 if(!['CNPJ','CPF'].includes(r.documentType)||!documentValid(r.document,r.documentType)||r.confirmed!==true)invalid();text(r.legalName,150);
 const a=r.address;object(a,['streetType','street','number','district','municipalityCode','state','postalCode'],['complement']);
 for(const [k,max] of Object.entries({streetType:10,street:150,number:20,district:100}))text(a[k],max);
 if(a.complement!==undefined)text(a.complement,100,0);
 if(typeof a.municipalityCode!=='string'||!/^\d{7}$/.test(a.municipalityCode)||typeof a.state!=='string'||!['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].includes(a.state)||typeof a.postalCode!=='string'||!/^\d{8}$/.test(a.postalCode))invalid();
 return JSON.parse(canonical(v));
}
export const preparationId=paymentId=>digest('ATP\0'+paymentId);
const projection=r=>({id:r.id,source:'ATP',paymentId:r.input.paymentId,externalReference:r.input.externalReference,orderId:r.input.orderId,arenaId:r.input.arenaId,amountCentsBRL:r.input.amountCentsBRL,competence:r.input.competence,status:r.status,reviewStatus:r.reviewStatus,createdAtUtc:r.createdAtUtc,updatedAtUtc:r.updatedAtUtc,capabilities:{automaticIssuance:false,nationalAdapterReady:false,emailHandledBy:'ATP'},...(r.invoice?{invoice:r.invoice}:{}),documents:{xml:r.reviewStatus==='none'&&r.documents?.xml?'available':'pending',pdf:r.reviewStatus==='none'&&r.documents?.pdf?'available':'pending'}});
export function createAtpFiscalHandler({storeFactory,config=()=>({enabled:process.env.ATP_FISCAL_V1_ENABLED,token:process.env.ATP_FISCAL_V1_TOKEN}),limit=async()=>({permitido:true}),now=()=>new Date().toISOString()}){
 return async req=>{
  const requestId=randomUUID();
  const reply=(status,body,headers={})=>({status,headers:{...headersPrivados,'X-Request-Id':requestId,...headers},jsonBody:body});
  try{
   const cfg=await config();
   if(cfg.enabled!=='true'||typeof cfg.token!=='string'||cfg.token.length<43||cfg.token.length>512||/\s/.test(cfg.token))throw new FiscalError(503,'INTEGRATION_DISABLED','Integração fiscal indisponível.');
   const auth=req.headers.get('authorization')||'';
   if(auth.length>1024||!auth.startsWith('Bearer ')||!timingSafeEqual(Buffer.from(digest(auth.slice(7)),'hex'),Buffer.from(digest(cfg.token),'hex')))throw new FiscalError(401,'UNAUTHORIZED','Não autorizado.');
   const lim=await limit();if(!lim.permitido)return reply(429,{requestId,error:{code:'RATE_LIMITED',message:'Aguarde antes de tentar novamente.',retryable:true}},{'Retry-After':String(lim.retryAfter||60)});
   const store=await storeFactory(),id=req.params?.id,format=req.params?.format,action=req.params?.action;
   if(id&&!/^[a-f0-9]{64}$/.test(id))invalid();
   const get=async key=>{const r=await store.get(key);if(!r||r.source!=='ATP')throw new FiscalError(404,'NOT_FOUND','Solicitação não encontrada.');return r;};
   if(req.method==='GET'){
    let r;
    if(id)r=await get(id);else{const url=new URL(req.url);if(url.searchParams.size!==1||!url.searchParams.has('externalReference'))invalid();const ref=url.searchParams.get('externalReference');text(ref,160);r=await store.byReference(ref);if(!r||r.source!=='ATP')throw new FiscalError(404,'NOT_FOUND','Solicitação não encontrada.');}
    if(format){
     if(!['xml','pdf'].includes(format))invalid();
     if(r.status!=='issued'||r.reviewStatus!=='none'||!r.documents?.[format])throw new FiscalError(409,'DOCUMENT_NOT_READY','Documento oficial ainda não disponível.',true);
     const bytes=await store.download(r,format);
     return {status:200,headers:{...headersPrivados,'X-Request-Id':requestId,'Content-Type':format==='xml'?'application/xml':'application/pdf','Content-Disposition':`attachment; filename="nota-${r.id}.${format}"`},body:bytes};
    }
    return reply(200,{requestId,replayed:false,request:projection(r)});
   }
   if(req.method!=='POST')invalid();
   let body;try{const bytes=await lerCorpoLimitado(req,16384);body=JSON.parse(bytes?.toString('utf8')||'');}catch(e){if(e instanceof ErroRequisicao&&e.status===413)throw new FiscalError(413,'PAYLOAD_TOO_LARGE','Solicitação excede o limite.');invalid();}
   if(id){
    if(action==='assumir-manual'){
     object(body,['claimId','externalReference','reason']);text(body.claimId,160);text(body.externalReference,160);text(body.reason,500);
     if(typeof store.claimManual!=='function')throw new FiscalError(503,'MANUAL_CONTROL_UNAVAILABLE','Controle manual indisponível; não emita outra nota.',true);
     const result=await store.claimManual({requestId:id,...body,at:now()});
     return reply(200,{requestId,replayed:result.replayed,request:projection(result.request),manualControl:result.manualControl});
    }
    if(action!=='revisao-estorno')invalid();object(body,['refundId','reason']);text(body.refundId,160);text(body.reason,500);
    for(let attempt=0;attempt<4;attempt++){
     const r=await get(id),hash=digest(canonical(body)),key=digest(body.refundId);
     if(r.refunds?.[key]){if(r.refunds[key].hash!==hash)conflict();return reply(200,{requestId,replayed:true,request:projection(r)});}
     const updated={...r,reviewStatus:'refund_review_required',updatedAtUtc:now(),refunds:{...r.refunds,[key]:{hash,...body}}};
     if(Object.keys(updated.refunds).length>32)invalid();
     try{await store.replace(updated,r.etag);return reply(200,{requestId,replayed:false,request:projection(updated)});}catch(e){if(e.statusCode!==412)throw e;}
    }
    throw new FiscalError(503,'STORAGE_UNAVAILABLE','Conflito temporário; consulte antes de repetir.',true);
   }
   const input=validatePreparation(body),hash=digest(canonical(input)),key=preparationId(input.paymentId);
   const exists=await store.get(key),ref=await store.byReference(input.externalReference);
   if(exists||ref){const r=exists||ref;if(r.source!=='ATP'||r.id!==key||r.hash!==hash)conflict();return reply(200,{requestId,replayed:true,request:projection(r)});}
   const at=now(),r={id:key,source:'ATP',hash,input,status:'pending_review',reviewStatus:'none',createdAtUtc:at,updatedAtUtc:at,documents:{},refunds:{}};
   try{await store.create(r);}catch(e){
    // Atomic transaction may have committed before a timeout; recover by stable identity.
    const saved=await store.get(key),indexed=await store.byReference(input.externalReference);
    if(saved&&indexed?.id===key&&saved.source==='ATP'&&saved.hash===hash)return reply(200,{requestId,replayed:true,request:projection(saved)});
    if(saved||indexed||e.statusCode===409)conflict();throw e;
   }
   return reply(202,{requestId,replayed:false,request:projection(r)});
  }catch(e){
   const f=e instanceof FiscalError?e:new FiscalError(503,'STORAGE_UNAVAILABLE','Serviço temporariamente indisponível; consulte a referência antes de repetir.',true);
   return reply(f.status,{requestId,error:{code:f.code,message:f.message,retryable:f.retryable}});
  }
 };
}
