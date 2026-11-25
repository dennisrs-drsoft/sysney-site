import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {memoryTable} from './atp-municipal-fixture.mjs';

const bundle=await build({entryPoints:['lib/regularizacao-emissao.ts','lib/regularizacao-emissao-modelo.ts','lib/regularizacao-emissao-store.ts','lib/regularizacao-cobranca.ts'],bundle:true,outdir:'unused',write:false,platform:'node',format:'esm',packages:'external',outExtension:{'.js':'.mjs'}});
await mkdir(new URL('../../output/regularizacao-test/',import.meta.url),{recursive:true});
const modules={};for(const file of bundle.outputFiles){const name=file.path.split(/[\\/]/).at(-1);const url=new URL('../../output/regularizacao-test/'+process.pid+'-'+name,import.meta.url);await writeFile(url,file.text);Object.assign(modules,await import(url.href+'?'+process.pid));}
export const {criarRegularizacaoEmissao,identidadesItem,digestFiscal,manifestoLote,entidadeLoteFiscal,lerLoteFiscal,identidadesHistorico,criarCobrancaRegularizada}=modules;
export const hoje=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const perfil={codigoNacional:'170201',codigoMunicipal:'099',nbs:'118064000',serie:'41027',regimeEspecial:'0',apuracaoSimples:'1',retencaoIss:'1',aliquotaIss:'',transparencia:{tipo:'simples',percentual:'6.00'}};
export const endereco={tipo:'R',logradouro:'Rua de teste',numero:'1',complemento:'',bairro:'Centro',municipio:'3550308',uf:'SP',cep:'01000000'};
export const req=new Request('https://qa.local/api/admin/regularizacao-fiscal',{headers:{'x-ms-client-principal':Buffer.from(JSON.stringify({userDetails:'QA local',userRoles:['administrador']})).toString('base64')}});
export function fixture(empresa='sysney',opts={}){
 const tables={AdminDocumentos:memoryTable(),AdminConfiguracoes:memoryTable(),FiscalFila:memoryTable()};
 for(const t of Object.values(tables))t.listEntities=async function*(options){const part=/PartitionKey eq '([^']+)'/.exec(options?.queryOptions?.filter||'')?.[1];for(const r of t.rows.values())if(!part||r.partitionKey===part)yield structuredClone(r);};
 const table=(name='AdminDocumentos')=>tables[name];
 const row=(p,k,json,t='AdminDocumentos')=>table(t).rows.set(p+'|'+k,{partitionKey:p,rowKey:k,json:JSON.stringify(json),etag:'1'});
 row('nfse-nacional-politicas',empresa,{cnpj:'12345678000199',perfis:[digestFiscal(perfil)],homologacao:true,producao:true},'AdminConfiguracoes');
 row('nfse-nacional-homologacoes-'+empresa,digestFiscal(perfil),{cnpj:'12345678000199'});
 const source=(id,transacao=id)=>({id,empresa,documento:'98765432000199',cliente:'Cliente QA sem validade fiscal',contato:'QA',email:'qa@example.invalid',descricao:'Suporte contratado',formaPagamento:'pix',transacao,endToEndId:'E'+transacao,recebimento:'2025-01-10',inclusaoBanco:'2025-01-10',centavos:10000,competencia:'2025-01',evidenciaCompetencia:'Referência preservada',emissaoPlanejada:'',nota:'',notasCandidatas:[],vencimentoReferencia:'2025-01-10',importadoEm:new Date().toISOString(),atualizadoEm:new Date().toISOString()});
 const recebimentos=[source('a'.repeat(64)),source('b'.repeat(64))];recebimentos.forEach(r=>row('regularizacao-'+empresa,r.id,r));
 row('nfse-regimes',empresa,{historico:[{vigencia:'2020-01-01',regime:empresa==='sysney'?'simples':'presumido'}]},'AdminConfiguracoes');
 table('AdminConfiguracoes').rows.set('nfse-emitentes|'+empresa,{partitionKey:'nfse-emitentes',rowKey:empresa,cnpj:'12345678000199',inscricao:'12345678',etag:'1'});
 table('FiscalFila').rows.set('servico|nacional-admin',{partitionKey:'servico',rowKey:'nacional-admin',em:new Date().toISOString(),assinatura:true,envio:true,etag:'1'});
 table('FiscalFila').rows.set('servico|drserver',{partitionKey:'servico',rowKey:'drserver',em:new Date().toISOString(),modo:'producao',etag:'1'});
 const ph=digestFiscal(perfil);
 row('nfse-nacional-politicas',empresa,{cnpj:'12345678000199',perfis:[ph],homologacao:true,producao:true},'AdminConfiguracoes');
 row('nfse-nacional-homologacoes-'+empresa,ph,{cnpj:'12345678000199'});
 const calls=[],emits=new Map();let fault=opts.falhaDepoisDeTransmitir===true;
 const wk=(a)=>a.body.ambiente?createHash('sha256').update(`${empresa}:${a.ctx.idNota}:${a.body.ambiente}:nacional-admin-v1`).digest('hex'):a.ctx.idNota;
 const wp=(a)=>a.body.ambiente?'nfse-nacional-trabalhos-'+empresa:'nfse-sp-'+empresa;
 async function execute(a){
  const action=a.body.acao;calls.push({action,id:a.ctx.idNota});const key=wk(a),part=wp(a);let old=table().rows.get(part+'|'+key),w=old?JSON.parse(old.json):null;
  const save=()=>row(part,key,w);
  const confirm=async()=>{
   w.status=a.body.ambiente==='homologacao'?'homologada':'emitida';w.resultado={numero:String((empresa==='sysney'?7:929)+[...emits.keys()].indexOf(key)+1),chave:'8'.repeat(50),xmlBlob:`historico/${empresa}/nfse/${key}.xml`,pdfBlob:`historico/${empresa}/nfse/${key}.pdf`};
   const ep='regularizacao-documentos-'+empresa,cp='regularizacao-controles-'+empresa;
   const er=await table().getEntity(ep,a.ctx.email.id),email=JSON.parse(er.json);email.fluxo.nota=w.resultado.numero;email.status='rascunho';email.anexos=[{tipo:'nota',nome:'QA.pdf',blob:`historico/${empresa}/nfse/${key}.pdf`,tamanho:500}];await table().updateEntity({...er,json:JSON.stringify(email)},'Replace',{etag:er.etag});
   const cr=await table().getEntity(cp,a.ctx.cobranca.id),c=JSON.parse(cr.json);c.nota=w.resultado.numero;await table().updateEntity({...cr,json:JSON.stringify(c)},'Replace',{etag:cr.etag});save();
  };
  if(['nacional-assinar','preparar'].includes(action)){w={id:key,status:action==='preparar'?'preparada':opts.assincrono?'assinando':'assinada',hash:'c'.repeat(64),atualizadoEm:new Date().toISOString()};save();}
  else if(action==='testar'){w.status='testada';w.teste={hash:w.hash,em:new Date().toISOString(),resultado:{sucesso:true,erros:[]}};save();}
  else if(['nacional-emitir','emitir'].includes(action)){
   assert.equal(a.body.aprovado,true);assert.equal(a.ctx.origem,'regularizacao');emits.set(key,(emits.get(key)||0)+1);assert.equal(emits.get(key),1,'retransmissão indevida');
   w.aprovacao={hash:w.hash,em:new Date().toISOString()};w.status='transmitindo';save();
   if(fault){fault=false;w.status='incerta';save();throw Error('Timeout depois de provider aceitar');}
   if(!opts.assincrono)await confirm();
  }else if(action==='nacional-consultar'){w.consulta=true;save();return {trabalho:w,mensagem:'Consulta da mesma DPS solicitada. Nenhuma nova emissão.'};}
  else if(action==='nacional-resultado'){
   if(w.status==='assinando'){w.status='assinada';save();}else await confirm();
  }else if(action==='consultar')await confirm();
  return {trabalho:w,mensagem:'Resultado sintético local; sem transmissão real.'};
 }
 const service=criarRegularizacaoEmissao({table,nacional:execute,municipal:execute,arquivo:opts.arquivo|| (async()=>({tamanho:500}))});
 const fiscal={regime:'presumido',serie:'SB001',numeroInicial:'4',dataEmissao:hoje(),codigoServico:'03158',aliquota:'0',issRetido:false,nbs:'118064000',indicadorOperacao:'100301',classificacaoTributaria:'000001',consumidorFinal:false,municipioPrestacao:'3550308',deducoes:0,pis:0,cofins:0,inss:0,ir:0,csll:0,ipi:0,retencaoPisCofins:'0',endereco};
 const config=empresa==='sysney'?{emissor:'nacional',ambiente:'producao',perfil,endereco}:{emissor:'municipal',ambiente:'producao',fiscal};
 const body=()=>({confirmado:true,recebimentos:recebimentos.map(r=>{const real=JSON.parse(table().rows.get(`regularizacao-${empresa}|${r.id}`).json);return {id:r.id,atualizadoEm:real.atualizadoEm};}),configuracao:config});
 return {service,table,tables,row,recebimentos,calls,emits,body,empresa,source,config};
}
