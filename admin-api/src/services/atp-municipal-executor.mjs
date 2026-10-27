import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {digest} from './atp-fiscal-v1.mjs';
// On-demand Windows process, not an installed service. Fixed official origins only.
export function createAtpMunicipalExecutor({enabled=false,issuanceEnabled=false,thumbprint,powershell='powershell.exe',spawnProcess=spawn,fetchPdf=fetch}={}){
 const gate=()=>{if(enabled!==true)throw Error('ATP_MUNICIPAL_EXECUTOR_DISABLED');};
 return {
  async execute(input){
   gate();if(!['testar','emitir','consultar'].includes(input.action)||!/^[a-f0-9]{64}$/.test(input.workId)||typeof input.xml!=='string'||input.xml.length>1_000_000)throw Error('ATP_EXECUTOR_INPUT_INVALID');
   if(input.action==='emitir'&&(issuanceEnabled!==true||input.confirmed!==true||digest(input.xml)!==input.approvedHash))throw Error('ATP_MUNICIPAL_ISSUANCE_DISABLED');
   if(!/^[a-fA-F0-9]{40}$/.test(thumbprint||''))throw Error('ATP_CERT_BINDING_REQUIRED');
   return new Promise((resolve,reject)=>{
    const child=spawnProcess(powershell,['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('../../scripts/executar-atp-municipal.ps1',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,ATP_MUNICIPAL_EXECUTOR_ENABLED:'true',ATP_MUNICIPAL_ISSUANCE_ENABLED:issuanceEnabled===true?'true':'false',ATP_MUNICIPAL_CERT_THUMBPRINT:thumbprint}});
    const output=[];let size=0;const timeout=setTimeout(()=>{child.kill();reject(Error('ATP_EXECUTOR_UNCERTAIN'));},60000);
    child.stdout.on('data',b=>{size+=b.length;if(size>1_500_000){child.kill();reject(Error('ATP_EXECUTOR_RESPONSE_LIMIT'));}else output.push(Buffer.from(b));});
    // Never forward native stderr/XML/certificate diagnostics to public callers.
    child.stderr.on('data',()=>{});child.on('error',()=>{clearTimeout(timeout);reject(Error('ATP_EXECUTOR_UNAVAILABLE'));});
    child.on('close',code=>{clearTimeout(timeout);if(code!==0)return reject(Error('ATP_EXECUTOR_UNCERTAIN'));try{const r=JSON.parse(Buffer.concat(output).toString('utf8'));if(typeof r.success!=='boolean'||typeof r.xml!=='string')throw Error();resolve({success:r.success,xml:Buffer.from(r.xml)});}catch{reject(Error('ATP_EXECUTOR_RESPONSE_INVALID'));}});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({...input,xmlHash:digest(input.xml)}));
   });
  },
  async downloadPdf(e){
   gate();if(e.provider!=='municipal_sp'||e.issuerDocument!=='57767099000179'||!/^\d{8}:\d{1,12}:\w{8}$/.test(e.authorityKey))throw Error('ATP_PDF_IDENTITY_INVALID');
   const [inscricao,nf,verificacao]=e.authorityKey.split(':'),url=new URL('https://nfe.prefeitura.sp.gov.br/contribuinte/notaprintpdf.aspx');
   url.search=new URLSearchParams({nf,inscricao,verificacao}).toString();
   const r=await fetchPdf(url,{signal:AbortSignal.timeout(30000),redirect:'error',headers:{Accept:'application/pdf'}});
   if(!r.ok||!r.headers.get('content-type')?.includes('application/pdf'))throw Error('ATP_PDF_UNAVAILABLE');
   const parts=[];let size=0;for await(const b of r.body){size+=b.length;if(size>5_000_000)throw Error('ATP_PDF_LIMIT');parts.push(Buffer.from(b));}return Buffer.concat(parts);
  },
 };
}
