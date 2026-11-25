process.env.NFSE_NACIONAL_PRODUCAO_HABILITADA='true';process.env.NFSE_SP_PRODUCAO_HABILITADA='true';process.env.NFSE_SP_VM_PRODUCAO_HABILITADA='true';
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';import {createHash} from 'node:crypto';
import {fixture,req,hoje,identidadesHistorico} from './helpers/regularizacao-emissao-fixture.mjs';
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const compile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=uri(compile('../lib/cobrancas.ts')),emailModel=uri(compile('../lib/emails-cobranca.ts').replaceAll('"./cobrancas"',JSON.stringify(model)));
const {pago,carteira,integrarPagamentosPix,integrarEnvios}=await import(model);
const {validarDocumentosEmail,validarRegularizacaoEmail,htmlEmail,mimeAnexo}=await import(emailModel);
const {consolidarFinanceiro,resumoFinanceiro}=await import(uri(compile('../lib/visao-financeira.ts').replaceAll('"./cobrancas"',JSON.stringify(model))));
const {saldoAviso}=await import(uri(compile('../lib/avisos-cobranca.ts').replaceAll('"./cobrancas"',JSON.stringify(model))));
const values=(f,part,name='AdminDocumentos')=>[...f.table(name).rows.values()].filter(r=>r.partitionKey===part).map(r=>JSON.parse(r.json));
async function emitido(empresa='sysney',opts={}){const f=fixture(empresa,opts);let l=await f.service.criar(empresa,f.body(),req);for(let n=0;n<15&&!l.itens.every(i=>i.status==='pronta');n++)l=await f.service.avancar(empresa,l.id,{hash:l.hash,modo:'validar'},req);l=await f.service.aprovar(empresa,l.id,{hash:l.hash,confirmado:true},req);for(let n=0;n<15&&l.estado!=='concluido';n++)l=await f.service.avancar(empresa,l.id,{hash:l.hash,modo:'emitir'},req);assert.equal(l.estado,'concluido');return {f,l};}
for(const empresa of ['sysney','drsoft'])test(`${empresa}: cobrança quitada, datas reais e rascunho com PDF/XML exigem aprovações separadas`,async()=>{
 const {f,l}=await emitido(empresa),cs=values(f,'cobrancas-'+empresa),es=values(f,'emails-'+empresa),ps=values(f,'cobrancas-'+empresa,'AdminConfiguracoes');
 assert.equal(cs.length,2);assert.equal(es.length,2);assert.equal(ps.length,2);
 for(const c of cs){const e=es.find(e=>e.fluxo.cobrancaId===c.id);assert.equal(pago(c),c.centavos);assert.equal(c.vencimento,'2025-01-10');assert.equal(c.competencia,'2025-01');assert.equal(c.regularizacao.emissaoFiscal,hoje());assert.ok(c.eventos.every(v=>v.registradoEm.startsWith(hoje())));assert.ok(!c.eventos.some(v=>v.tipo==='envio'));assert.equal(c.eventos.find(v=>v.tipo==='pagamento').data,'2025-01-10');assert.equal(e.status,'rascunho');assert.equal(e.aprovacaoEnvio,undefined);assert.equal(e.fluxo.documentos,undefined);assert.equal(e.tentativas.length,0);assert.deepEqual(e.anexos.map(a=>a.tipo),['nota','xml']);validarDocumentosEmail(e);validarRegularizacaoEmail(e,c);assert.equal(mimeAnexo(e.anexos[1]),'application/xml');const html=htmlEmail(e);assert.match(html,/Regularização de serviço já pago/);assert.match(html,/não solicita novo pagamento/);assert.match(html,/Saldo a pagar/);assert.doesNotMatch(html,/Chave PIX/);assert.doesNotMatch(html,/>Vencimento</);assert.throws(()=>saldoAviso(c,'atraso',hoje()),/não recebe aviso/);assert.throws(()=>validarDocumentosEmail({...e,anexos:e.anexos.slice(0,1)}),/PDF e o XML/);}
 const final=carteira(ps,cs,'2027-12');assert.equal(final.length,2,'plano avulso não cria futuras mensalidades');const linked=integrarPagamentosPix(cs,ps,values(f,'pix-conciliacao-'+empresa),es);assert.deepEqual(linked.map(pago),[10000,10000],'o vínculo bancário não soma outro pagamento');const lines=consolidarFinanceiro(linked,ps,[],es,hoje());assert.equal(lines.length,2);assert.ok(lines.every(l=>l.estado==='pago'&&l.pagamento==='2025-01-10'&&l.saldo===0));assert.equal(resumoFinanceiro(lines,hoje()).recebido,20000);assert.equal(l.itens.filter(i=>i.erroHistorico).length,0);
});

test('retomar histórico não emite, não duplica valores e preserva rascunho editado/aprovado',async()=>{
 const {f,l}=await emitido(),n=f.calls.length;const e=values(f,'emails-sysney')[0];e.para='outro@example.invalid';e.status='revisado';e.aprovacaoEnvio={hash:'aprovacao-revisada',por:'QA',em:new Date().toISOString(),remetente:'qa@example.invalid'};f.row('emails-sysney',e.id,e);
 for(let j=0;j<2;j++){const r=await f.service.organizarHistorico('sysney',l.id,{hash:l.hash,confirmado:true},req);assert.ok(r.itens.every(i=>i.historicoCobranca&&!i.erroHistorico));}
 assert.equal(f.calls.length,n);assert.equal(values(f,'cobrancas-sysney').length,2);assert.equal(values(f,'emails-sysney').length,2);assert.deepEqual(values(f,'emails-sysney').find(x=>x.id===e.id),e);
});

test('falha documental mantém a nota confirmada e permite completar o mesmo histórico sem reemitir',async()=>{
 let fail=true;const {f,l}=await emitido('sysney',{arquivo:async()=>{if(fail)throw Error('armazenamento temporariamente indisponível');return {tamanho:500};}});assert.ok(l.itens.every(i=>i.status==='emitida'&&i.erroHistorico));assert.equal(values(f,'emails-sysney').length,0);const calls=f.calls.length;fail=false;const r=await f.service.organizarHistorico('sysney',l.id,{hash:l.hash,confirmado:true},req);assert.ok(r.itens.every(i=>i.historicoCobranca&&!i.erroHistorico));assert.equal(f.calls.length,calls);assert.equal(values(f,'cobrancas-sysney').length,2);
});

test('PIX reservado por outra cobrança bloqueia materialização e não altera a nota emitida',async()=>{
 const f=fixture('sysney'),r=f.recebimentos[0],ids=identidadesHistorico('sysney',r.id,r.recebimento),key='p-'+createHash('sha256').update(r.endToEndId).digest('hex');f.row('pix-conciliacao-sysney',key,{tipo:'reserva',cobrancaId:'outra-cobranca',pixId:r.endToEndId});let l=await f.service.criar('sysney',f.body(),req);for(let n=0;n<5&&!l.itens.every(i=>i.status==='pronta');n++)l=await f.service.avancar('sysney',l.id,{hash:l.hash,modo:'validar'},req);l=await f.service.aprovar('sysney',l.id,{hash:l.hash,confirmado:true},req);l=await f.service.avancar('sysney',l.id,{hash:l.hash,modo:'emitir'},req);assert.equal(l.itens[0].status,'emitida');assert.ok(l.itens[0].erroHistorico);assert.ok(!f.table().rows.has('cobrancas-sysney|'+ids.cobrancaId));assert.equal(f.emits.size,1);
});

test('organização exige empresa, hash, confirmação e emissão de produção',async()=>{
 const f=fixture();const l=await f.service.criar('sysney',f.body(),req);for(const args of [['sysney',l.id,{hash:l.hash,confirmado:true}],['drsoft',l.id,{hash:l.hash,confirmado:true}]])await assert.rejects(f.service.organizarHistorico(...args,req));const done=await emitido();await assert.rejects(done.f.service.organizarHistorico('sysney',done.l.id,{hash:'incorreto',confirmado:true},req));await assert.rejects(done.f.service.organizarHistorico('sysney',done.l.id,{hash:done.l.hash},req));
});

test('envio efetivo registra a data atual e nunca recria envio histórico',async()=>{
 const {f}=await emitido(),c=values(f,'cobrancas-sysney')[0],e=values(f,'emails-sysney').find(e=>e.fluxo.cobrancaId===c.id);e.tentativas=[{id:'envio-qa',data:new Date().toISOString(),status:'aceito',messageId:'protocolo-sintetico'}];const projected=integrarEnvios([c],[e],'sysney')[0];assert.equal(projected.eventos.find(v=>v.tipo==='envio').data,hoje());assert.equal(projected.eventos.find(v=>v.tipo==='pagamento').data,'2025-01-10');assert.equal(pago(projected),c.centavos);
});
