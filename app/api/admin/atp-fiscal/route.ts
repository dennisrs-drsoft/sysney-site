import {NextRequest,NextResponse} from 'next/server';
import {TableClient} from '@azure/data-tables';
import {DefaultAzureCredential} from '@azure/identity';
import {usuarioAdministrador} from '../_auth';
import {encaminharAdmin} from '../_remote';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
type RecordAtp={id:string;source:string;input:{paymentId:string;externalReference:string;amountCentsBRL:number;competence:string};status:string;reviewStatus:string;createdAtUtc:string;updatedAtUtc:string;invoice?:{number:string};};
export async function GET(req:NextRequest){
 const remote=await encaminharAdmin(req);if(remote)return remote;
 if(!usuarioAdministrador(req))return reply({erro:'Não autorizado.'},401);
 if(req.nextUrl.searchParams.get('empresa')!=='sysney')return reply({erro:'Solicitações ATP pertencem ao emitente SYSNEY.'},400);
 const cursor=req.nextUrl.searchParams.get('cursor')||undefined;
 if(cursor&&(cursor.length>4096||/[\x00-\x1f]/.test(cursor)))return reply({erro:'Cursor inválido.'},400);
 try{
  const account=process.env.ADMIN_STORAGE_ACCOUNT;
  if(!/^[a-z0-9]{3,24}$/.test(account||''))return reply({erro:'Armazenamento não configurado.'},503);
  const table=new TableClient(`https://${account}.table.core.windows.net`,'AdminDocumentos',new DefaultAzureCredential());
  const pages=table.listEntities<{json:string}>({queryOptions:{filter:"PartitionKey eq 'integracao-fiscal-atp-v1' and RowKey ge 'request-' and RowKey lt 'request.'"}}).byPage({maxPageSize:50,continuationToken:cursor});
  const page=await pages.next(),rows=page.value;
  const solicitacoes=(rows||[]).map((r:{json:string})=>JSON.parse(r.json) as RecordAtp).filter((r:RecordAtp)=>r.source==='ATP').map((r:RecordAtp)=>({id:r.id,source:'ATP',paymentId:r.input.paymentId,externalReference:r.input.externalReference,amountCentsBRL:r.input.amountCentsBRL,competence:r.input.competence,status:r.status,reviewStatus:r.reviewStatus,invoiceNumber:r.invoice?.number||null,createdAtUtc:r.createdAtUtc,updatedAtUtc:r.updatedAtUtc}));
  return reply({solicitacoes,nextCursor:rows?.continuationToken||null,emissaoAutomatica:false,vinculoSupervisionadoDisponivel:false});
 }catch{return reply({erro:'Não foi possível consultar as solicitações ATP.'},503);}
}
