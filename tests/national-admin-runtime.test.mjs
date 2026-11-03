import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {memoryTable} from './helpers/atp-municipal-fixture.mjs';
import {createNationalAdminQueue} from '../admin-api/src/services/national-admin-store.mjs';
const bundle=await build({entryPoints:['lib/nfse-nacional-runtime.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'private-blob-test-double',setup(b){b.onResolve({filter:/^@azure\/storage-blob$/},()=>({path:'blob',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export class BlobServiceClient{getContainerClient(){return {getBlockBlobClient:path=>({uploadData:async bytes=>{if(globalThis.nationalQaBlobs.has(path))throw Object.assign(Error(),{statusCode:409});globalThis.nationalQaBlobs.set(path,Buffer.from(bytes));},downloadToBuffer:async()=>globalThis.nationalQaBlobs.get(path)})}}}`,loader:'js'}));}}]});
const generated=new URL(`../output/national-admin-runtime-test-${process.pid}.mjs`,import.meta.url);await mkdir(new URL('../output/',import.meta.url),{recursive:true});await writeFile(generated,bundle.outputFiles[0].text);
const {operarNacional,statusNacional}=await import(generated.href);
const digest=s=>createHash('sha256').update(s).digest('hex'),RealDate=Date,clock=Date.parse('2026-11-02T15:00:00Z');
const p={codigoNacional:'010701',codigoMunicipal:'',nbs:'',serie:'777',regimeEspecial:'0',apuracaoSimples:'1',retencaoIss:'1',aliquotaIss:'',transparencia:{tipo:'naoInformar',percentual:''}};
function fixture(){
 globalThis.nationalQaBlobs=new Map();
 const databases={AdminDocumentos:memoryTable(),AdminConfiguracoes:memoryTable(),FiscalFila:memoryTable()},table=(n='AdminDocumentos')=>databases[n];
 const email={id:'11111111-1111-4111-8111-111111111111',empresa:'sysney',cliente:'Cliente QA',descricao:'Teste local',po:'',competencia:'2026-11',centavos:10000,vencimento:'2026-12-08',status:'rascunho',atualizadoEm:'2026-11-02T14:00:00Z',anexos:[],fluxo:{cobrancaId:'a'.repeat(64)+'_2026-11',nota:'',boleto:''}};
 const dados={empresa:'sysney',cnpj:'12345678000199',regime:'simples',documento:'98765432000199',cliente:email.cliente,descricao:email.descricao,centavos:email.centavos,referencia:email.competencia,competenciaFiscal:'2026-11-01',emissao:'2026-11-02',endereco:{tipo:'R',logradouro:'Teste',numero:'1',bairro:'Centro',municipio:'3550308',uf:'SP',cep:'01000000'},perfil:p};
 const idNota='c'.repeat(64),ctx={email,cobranca:{id:email.fluxo.cobrancaId,nota:'',eventos:[]},documento:dados.documento,idNota,row:{etag:'1'},cr:null},previa={dados,hash:digest(JSON.stringify(dados))};
 table().rows.set('emails-sysney|'+email.id,{partitionKey:'emails-sysney',rowKey:email.id,json:JSON.stringify(email),etag:'1'});
 table().rows.set('nfse-nacional-previas-sysney|'+idNota,{partitionKey:'nfse-nacional-previas-sysney',rowKey:idNota,json:JSON.stringify(previa),etag:'1'});
 table('AdminConfiguracoes').rows.set('nfse-emitentes|sysney',{partitionKey:'nfse-emitentes',rowKey:'sysney',cnpj:dados.cnpj,etag:'1'});
 table('FiscalFila').rows.set('servico|nacional-admin',{partitionKey:'servico',rowKey:'nacional-admin',em:new Date().toISOString(),assinatura:true,envio:true,etag:'1'});
 const args={table,emp:'sysney',ctx,regime:'simples',req:new Request('https://local.invalid'),body:{acao:'nacional-assinar',ambiente:'homologacao',confirmarSerie:true,hash:previa.hash,atualizadoEm:email.atualizadoEm}};
 return {table,databases,ctx,args};
}
test('runtime nacional: prévia → reserva transacional → assinatura; servidor indisponível não reserva nada',async()=>{
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
 try{
  const f=fixture();f.table('FiscalFila').rows.clear();await assert.rejects(operarNacional(f.args),/indisponível/);assert.equal([...f.table().rows.keys()].some(k=>k.includes('sequencia')),false);
  const good=fixture(),r=await operarNacional(good.args);assert.equal(r.trabalho.status,'assinando');assert.equal(r.trabalho.numero,'1');assert.equal(JSON.parse(good.table().rows.get('emails-sysney|'+good.ctx.email.id).json).status,'rascunho');
  const again=await operarNacional(good.args);assert.equal(again.trabalho.jobId,r.trabalho.jobId);assert.equal([...good.table('FiscalFila').rows.values()].filter(r=>r.estado==='pendente').length,1);
  const q=createNationalAdminQueue(good.table('FiscalFila')),job=await q.get(r.trabalho.jobId);await q.claim(job);const b=Buffer.from(r.trabalho.xml);
  await q.complete(r.trabalho.jobId,{status:'assinada',signedXml:b.toString('base64'),signedHash:digest(b),xmlHash:r.trabalho.xmlHash});
  const ready=await operarNacional({...good.args,body:{acao:'nacional-resultado',ambiente:'homologacao'}});assert.equal(ready.trabalho.status,'assinada');
  await assert.rejects(operarNacional({...good.args,body:{acao:'nacional-emitir',ambiente:'homologacao',aprovado:true,hash:ready.trabalho.hash,atualizadoEm:good.ctx.email.atualizadoEm}}),/política protegida/);
  const part='nfse-nacional-politicas',row='sysney';await good.table('AdminConfiguracoes').createEntity({partitionKey:part,rowKey:row,json:JSON.stringify({cnpj:ready.trabalho.cnpj,perfis:[ready.trabalho.perfilHash],homologacao:true})});
  const run=()=>operarNacional({...good.args,ctx:structuredClone(good.ctx),body:{acao:'nacional-emitir',ambiente:'homologacao',aprovado:true,hash:ready.trabalho.hash,atualizadoEm:good.ctx.email.atualizadoEm}});
  const results=await Promise.allSettled([run(),run()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal([...good.table('FiscalFila').rows.values()].filter(r=>r.pedido&&JSON.parse(r.pedido).acao==='emitir').length,1);
  const status=await statusNacional(good.table,'sysney',good.ctx.idNota,'homologacao');assert.equal(status.trabalho.status,'transmitindo');
  await assert.rejects(run());assert.equal([...good.table('FiscalFila').rows.values()].filter(r=>r.pedido&&JSON.parse(r.pedido).acao==='emitir').length,1);
 }finally{globalThis.Date=RealDate;}
});
test('resultado de produção vincula XML/PDF, separa emissor e preserva pagamento; repetição não duplica',async()=>{
 const lateClock=RealDate.parse('2026-11-03T02:00:00Z');
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[lateClock]));}static now(){return lateClock;}};
 try{
  const f=fixture();await operarNacional({...f.args,body:{...f.args.body,ambiente:'producao'}});const prep=await operarNacional({...f.args,body:{acao:'nacional-consultar',ambiente:'producao'}}),w=prep.trabalho,q=createNationalAdminQueue(f.table('FiscalFila')),jr=await q.get(w.jobId);await q.claim(jr);
  const key='8'.repeat(50),xml=Buffer.from(`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS${key}"><nNFSe>1</nNFSe><dhProc>${new Date().toISOString()}</dhProc><emit><CNPJ>${w.cnpj}</CNPJ></emit>${w.xml.replace(/<\?xml[^?]*\?>/,'')}</infNFSe></NFSe>`),pdf=Buffer.from('%PDF-1.4\n'+'QA SEM VALIDADE FISCAL '.repeat(10)+'\n%%EOF');
  await q.complete(w.jobId,{status:'confirmada',xml:xml.toString('base64'),pdf:pdf.toString('base64'),pdfHash:digest(pdf),proof:{xmlHash:digest(xml),schemaValid:true,signatureValid:true,chainValid:true}});
  const first=await operarNacional({...f.args,body:{acao:'nacional-resultado',ambiente:'producao'}});
  assert.equal(first.trabalho.status,'emitida');assert.equal(first.email.fluxo.notaChave,key);assert.equal(first.email.fluxo.notaEmissor,'nacional');assert.equal(first.email.anexos.length,1);assert.equal(first.email.status,'rascunho');assert.equal(globalThis.nationalQaBlobs.size,2);
  const fiscal=JSON.parse((await f.table().getEntity('nfse-historico-sysney','N-'+key)).json);assert.equal(fiscal.emissao,'2026-11-02');assert.equal(fiscal.autorizadaEmUtc,'2026-11-03T02:00:00.000Z');
  const charge=JSON.parse(f.table().rows.get('cobrancas-sysney|'+f.ctx.cobranca.id).json);assert.equal(charge.notaChave,key);assert.ok(charge.eventos.every(e=>e.tipo==='documentos'));
  const er=await f.table().getEntity('emails-sysney',f.ctx.email.id),cr=await f.table().getEntity('cobrancas-sysney',f.ctx.cobranca.id);
  const next={...f.args,ctx:{...f.ctx,email:JSON.parse(er.json),cobranca:JSON.parse(cr.json),row:er,cr},body:{acao:'nacional-resultado',ambiente:'producao'}};
  const repeated=await operarNacional(next);assert.equal(repeated.email.anexos.length,1);assert.equal(globalThis.nationalQaBlobs.size,2);assert.equal(JSON.parse((await f.table().getEntity('cobrancas-sysney',f.ctx.cobranca.id)).json).eventos.length,1);
 }finally{globalThis.Date=RealDate;delete globalThis.nationalQaBlobs;}
});
