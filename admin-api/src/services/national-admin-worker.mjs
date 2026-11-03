import {createHash} from 'node:crypto';
import {createNationalAdminClient,inspectAdminDps} from './national-admin-client.mjs';
import {createNationalAdminQueue} from './national-admin-store.mjs';
import {validateNationalDanfse} from './national-danfse.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
export async function runNationalAdminJob({queueTable,documents,config,native,row,now=()=>Date.now()}){
 if(config.paused!==false||config.allowQueries!==true)throw Error('NATIONAL_WORKER_PAUSED');
 const queue=createNationalAdminQueue(queueTable),p=await queue.claim(row);
 try{
  if(!['sysney','drsoft'].includes(p.empresa)||!['homologacao','producao'].includes(p.ambiente)||!['assinar','emitir','consultar'].includes(p.acao)||!/^[a-f0-9]{64}$/.test(p.workId))throw Error('NATIONAL_JOB_SCOPE');
  const partition=`nfse-nacional-trabalhos-${p.empresa}`,load=async()=>JSON.parse((await documents.getEntity(partition,p.workId)).json),work=await load();
  const fixed={empresa:p.empresa,cnpj:work.cnpj,ambiente:p.ambiente,workId:p.workId,unsignedHash:work.xmlHash};
  if(work.empresa!==p.empresa||work.ambiente!==p.ambiente||work.hash!==p.hash||work.xmlHash!==digest(work.xml)||inspectAdminDps(Buffer.from(work.xml),fixed).idDps!==work.idDps)throw Error('NATIONAL_JOB_BINDING');
  if(p.acao==='assinar'){
   if(config.allowSigning!==true||work.status!=='assinando')throw Error('NATIONAL_SIGNING_DISABLED');
   const r=await native({...fixed,acao:'sign',xmlBase64:Buffer.from(work.xml).toString('base64')});
   if(r.status!==200||inspectAdminDps(r.body,fixed).idDps!==work.idDps)throw Error('NATIONAL_SIGNATURE_FAILED');
   await queue.complete(row.rowKey,{status:'assinada',signedXml:r.body.toString('base64'),signedHash:digest(r.body),xmlHash:work.xmlHash});return {state:'assinada',transmitted:false};
  }
  const ledgerPart=`nacional-admin-client-ledger-${p.ambiente}-${work.cnpj}`;
  const ledger={get:async id=>{try{return await queueTable.getEntity(ledgerPart,id);}catch(e){if(e.statusCode!==404)throw e;return null;}},reserve:r=>queueTable.createEntity({partitionKey:ledgerPart,rowKey:r.idDps,...r,em:new Date(now()).toISOString()})};
  const client=createNationalAdminClient({...fixed,ledger,
   transport:r=>native({...r,...fixed,acao:'request'}),
   verifyOfficialXml:async({xml,authorityKey})=>{const r=await native({...fixed,acao:'verify',xmlBase64:xml.toString('base64'),authorityKey});if(r.status!==200)throw Error('NATIONAL_XML_UNVERIFIED');return JSON.parse(r.body.toString());},
   authorize:async()=>{
    const latest=await load(),policy=config.emitentes?.find(x=>x.empresa===p.empresa&&x.ambiente===p.ambiente&&x.enabled===true);
    if(config.allowSend!==true||!policy||policy.perfilHash!==latest.perfilHash||latest.status!=='transmitindo'||latest.hash!==p.hash||latest.aprovacao?.hash!==latest.hash||now()-Date.parse(latest.aprovacao.em)>600000||Date.parse(latest.aprovacao.em)>now()+30000)throw Error('NATIONAL_APPROVAL_REQUIRED');
    const e=JSON.parse((await documents.getEntity(`emails-${p.empresa}`,latest.emailId)).json);
    if(e.status!=='emitindo_documento'||e.atualizadoEm!==latest.emailBloqueadoEm||e.centavos!==latest.dados.centavos||e.descricao!==latest.emailDescricao||e.fluxo?.nota||e.anexos.some(a=>a.tipo==='nota'))throw Error('NATIONAL_BILLING_CHANGED');
   },
  });
  const expectedXml=Buffer.from(work.xml),result=p.acao==='emitir'?await client.submit({signedXml:Buffer.from(work.signedXml,'base64'),expectedXml}):await client.recover(work.idDps,expectedXml);
  let pdf,pdfError;
  if(result.status==='confirmada')try{const b=await client.downloadPdf(result.fields.authorityKey);await validateNationalDanfse(b,result.fields);pdf=b;}catch{pdfError='DANFSe indisponível ou sem identificação conferida; recuperar por consulta, sem reemitir.';}
  await queue.complete(row.rowKey,{...result,...(result.xml?{xml:result.xml.toString('base64')}:{}),...(pdf?{pdf:pdf.toString('base64'),pdfHash:digest(pdf)}:{}),...(pdfError?{pdfError}:{})});
  return {state:result.status,transmitted:p.acao==='emitir'};
 }catch{
  // Failed native calls may have reached SEFIN. Keep all claims and allow GET recovery only.
  await queue.complete(row.rowKey,{status:'incerta',mensagem:'Operação não confirmada. Consulte a mesma DPS; não repita a transmissão.'});return {state:'incerta',transmitted:null};
 }
}
