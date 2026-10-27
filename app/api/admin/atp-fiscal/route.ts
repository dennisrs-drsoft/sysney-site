import {NextRequest,NextResponse} from 'next/server';
import {TableClient} from '@azure/data-tables';
import {DefaultAzureCredential} from '@azure/identity';
import {usuarioAdministrador} from '../_auth';
import {encaminharAdmin} from '../_remote';
import {createFiscalAdminBoundary} from '@/admin-api/src/services/atp-fiscal-admin.mjs';
import {createAtpFiscalStore} from '@/admin-api/src/services/atp-fiscal-store.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
type RecordAtp={id:string;source:string;input:{paymentId:string;externalReference:string;amountCentsBRL:number;competence:string};status:string;reviewStatus:string;createdAtUtc:string;updatedAtUtc:string;invoice?:{number:string};};
export async function GET(req:NextRequest){
 const remote=await encaminharAdmin(req);if(remote)return remote;
 if(!usuarioAdministrador(req))return reply({erro:'Não autorizado.'},401);
 if(req.nextUrl.searchParams.get('empresa')!=='sysney')return reply({erro:'Solicitações ATP pertencem ao emitente SYSNEY.'},400);
 if(req.nextUrl.searchParams.get('acao')==='vinculo-capacidades')return reply({disponivel:false,motivos:['Validação XSD e assinatura fiscal nacional ainda não homologadas.','Consulta oficial de autorização/cancelamento ainda não conectada.','Proveniência ainda não ligada ao fluxo nacional de emissão.'],emissaoReal:false});
 const cursor=req.nextUrl.searchParams.get('cursor')||undefined;
 if(cursor&&(cursor.length>4096||/[\x00-\x1f]/.test(cursor)))return reply({erro:'Cursor inválido.'},400);
 try{
  const account=process.env.ADMIN_STORAGE_ACCOUNT;
  if(!/^[a-z0-9]{3,24}$/.test(account||''))return reply({erro:'Armazenamento não configurado.'},503);
  const table=new TableClient(`https://${account}.table.core.windows.net`,'AdminDocumentos',new DefaultAzureCredential());
  const pages=table.listEntities<{json:string}>({queryOptions:{filter:"PartitionKey eq 'integracao-fiscal-atp-v1' and RowKey ge 'request-0' and RowKey lt 'request-g'"}}).byPage({maxPageSize:50,continuationToken:cursor});
  const page=await pages.next(),rows=page.value;
  const solicitacoes=(rows||[]).map((r:{json:string})=>JSON.parse(r.json) as RecordAtp).filter((r:RecordAtp)=>r.source==='ATP').map((r:RecordAtp)=>({id:r.id,source:'ATP',paymentId:r.input.paymentId,externalReference:r.input.externalReference,amountCentsBRL:r.input.amountCentsBRL,competence:r.input.competence,status:r.status,reviewStatus:r.reviewStatus,invoiceNumber:r.invoice?.number||null,createdAtUtc:r.createdAtUtc,updatedAtUtc:r.updatedAtUtc}));
  return reply({solicitacoes,nextCursor:rows?.continuationToken||null,emissaoAutomatica:false,vinculoSupervisionadoDisponivel:false});
 }catch{return reply({erro:'Não foi possível consultar as solicitações ATP.'},503);}
}

export async function POST(req:NextRequest){
 const remote=await encaminharAdmin(req);if(remote)return remote;
 if(!usuarioAdministrador(req))return reply({erro:'Não autorizado.'},401);
 if(req.nextUrl.searchParams.get('empresa')!=='sysney')return reply({erro:'Emitente inválido.'},400);
 if(req.headers.get('origin')!==req.nextUrl.origin)return reply({erro:'Origem inválida.'},403);
 // Nenhuma flag de ambiente transforma evidência sintética em fiscal real.
 // Só mudar esta capacidade junto ao adaptador homologado e sua revisão.
 const verificacaoFiscalRealHomologada=false;
 const enabled=process.env.ATP_FISCAL_LINK_ENABLED==='true'&&verificacaoFiscalRealHomologada;
 if(!enabled)return reply({erro:'Vínculo bloqueado: faltam schema, assinatura, autorização oficial e proveniência nacional homologados.'},503);
 const encoded=req.headers.get('x-ms-client-principal');
 if(!encoded)return reply({erro:'Identidade administrativa obrigatória.'},401);
 try{
  const principal=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));
  const actorId=principal.userId;
  if(typeof actorId!=='string'||!actorId||actorId.length>254)return reply({erro:'Identidade administrativa inválida.'},401);
  const repository=createAtpFiscalStore(process.env.ADMIN_STORAGE_ACCOUNT);
  const handler=createFiscalAdminBoundary({enabled,repository,authenticate:async()=>({role:'administrador',id:actorId}),readAuthorizedEvidence:async()=>{throw Error('Adaptador de autorização real não implementado.');}});
  const response=await handler(req);
  return NextResponse.json(response.jsonBody,{status:response.status,headers:response.headers});
 }catch{return reply({erro:'Vínculo não confirmado; consulte antes de repetir.'},503);}
}
