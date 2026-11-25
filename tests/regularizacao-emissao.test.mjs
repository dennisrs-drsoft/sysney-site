import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.NFSE_NACIONAL_PRODUCAO_HABILITADA='true';process.env.NFSE_SP_PRODUCAO_HABILITADA='true';process.env.NFSE_SP_VM_PRODUCAO_HABILITADA='true';
import {fixture,req,hoje,manifestoLote,entidadeLoteFiscal,lerLoteFiscal} from './helpers/regularizacao-emissao-fixture.mjs';
async function validar(f,l){for(let count=0;count<15&&!l.itens.every(i=>i.status==='pronta');count++){l=await f.service.avancar(f.empresa,l.id,{modo:'validar',hash:l.hash},req);assert.notEqual(l.estado,'revisar',JSON.stringify(l));}assert.ok(l.itens.every(i=>i.status==='pronta'));return l;}
async function aprovar(f,l){return f.service.aprovar(f.empresa,l.id,{hash:l.hash,confirmado:true},req);}
for(const empresa of ['sysney','drsoft'])test(`${empresa}: lote usa os emissores existentes, preserva PIX e cria histórico quitado com rascunho após confirmação`,async()=>{
 const f=fixture(empresa,{assincrono:empresa==='sysney'});let l=await f.service.criar(empresa,f.body(),req);
 assert.equal(l.dataFiscal,hoje());assert.equal(l.itens[0].referencia,'2025-01');assert.match(l.itens[0].descricao,/Serviço já pago/);
 await assert.rejects(f.service.avancar(empresa,l.id,{hash:l.hash,modo:'emitir'},req),/Aprove/);l=await validar(f,l);assert.equal(f.emits.size,0);l=await aprovar(f,l);
 for(let count=0;count<15&&l.estado!=='concluido';count++)l=await f.service.avancar(empresa,l.id,{hash:l.hash,modo:'emitir'},req);
 assert.equal(l.estado,'concluido',JSON.stringify(l));assert.equal(f.emits.size,2);
 for(const i of l.itens){const r=JSON.parse((await f.table().getEntity('regularizacao-'+empresa,i.recebimentoId)).json);assert.equal(r.nota,i.nota);assert.equal(r.centavos,10000);assert.equal(r.competencia,'2025-01');assert.equal(r.recebimento,'2025-01-10');assert.equal(r.emissaoFiscal,hoje());}
 assert.equal([...f.table().rows.keys()].filter(k=>k.startsWith('emails-')).length,2);assert.equal([...f.table().rows.keys()].filter(k=>k.startsWith('cobrancas-')).length,2);assert.ok(l.itens.every(i=>i.historicoCobranca&&!i.erroHistorico),JSON.stringify(l));
 const again=await f.service.avancar(empresa,l.id,{hash:l.hash,modo:'emitir'},req);assert.equal(again.estado,'concluido');assert.equal([...f.emits.values()].reduce((a,b)=>a+b,0),2);
});

test('retorno incerto pausa o lote; consulta reutiliza a identidade e não retransmite',async()=>{
 const f=fixture('sysney',{falhaDepoisDeTransmitir:true});let l=await f.service.criar(f.empresa,f.body(),req);l=await aprovar(f,await validar(f,l));l=await f.service.avancar(f.empresa,l.id,{hash:l.hash,modo:'emitir'},req);
 assert.equal(l.itens[0].status,'incerta');assert.equal(f.emits.size,1);await assert.rejects(f.service.avancar(f.empresa,l.id,{hash:l.hash,modo:'emitir'},req),/pendente/);
 await assert.rejects(f.service.criar(f.empresa,{...f.body(),revisar:true},req),/transmissão|tentativa|resultado/);
 for(let count=0;count<4&&l.itens[0].status!=='emitida';count++)l=await f.service.avancar(f.empresa,l.id,{hash:l.hash,modo:'consultar',recebimentoId:l.itens[0].recebimentoId},req);
 assert.equal(l.itens[0].status,'emitida',JSON.stringify(l));assert.equal(f.emits.size,1);
 l=await f.service.avancar(f.empresa,l.id,{hash:l.hash,modo:'emitir'},req);assert.equal(l.estado,'concluido');assert.equal(f.emits.size,2);
});

test('conflito entre duas abas deixa somente uma etapa fiscal assumir o lote',async()=>{
 const f=fixture();let l=await f.service.criar(f.empresa,f.body(),req);l=await aprovar(f,await validar(f,l));
 await Promise.allSettled([f.service.avancar(f.empresa,l.id,{hash:l.hash,modo:'emitir'},req),f.service.avancar(f.empresa,l.id,{hash:l.hash,modo:'emitir'},req)]);
 assert.equal([...f.emits.values()].reduce((a,b)=>a+b,0),1);
});

test('pagamento alterado, outra empresa, candidato fiscal e hash adulterado são bloqueados',async()=>{
 const f=fixture();let l=await f.service.criar(f.empresa,f.body(),req);
 await assert.rejects(f.service.avancar('drsoft',l.id,{hash:l.hash,modo:'validar'},req));
 await assert.rejects(f.service.avancar(f.empresa,l.id,{hash:'0'.repeat(64),modo:'validar'},req),/mudou/);
 const r=f.recebimentos[0];f.row('regularizacao-sysney',r.id,{...r,centavos:20000});await assert.rejects(f.service.avancar(f.empresa,l.id,{hash:l.hash,modo:'validar'},req),/alterado/);assert.equal(f.calls.length,0);
 const g=fixture();const c=g.recebimentos[0];g.row('regularizacao-sysney',c.id,{...c,notasCandidatas:[{numero:'4'}]});await assert.rejects(g.service.criar(g.empresa,g.body(),req),/nota.*candidata/i);
});

test('reserva por identidade PIX impede outro lote e preserva atomicidade de falha',async()=>{
 const f=fixture();const first=f.recebimentos[0];const b=f.body();b.recebimentos=b.recebimentos.slice(0,1);await f.service.criar(f.empresa,b,req);
 const clone=f.source('d'.repeat(64),first.transacao);f.row('regularizacao-sysney',clone.id,clone);await assert.rejects(f.service.criar(f.empresa,{...b,recebimentos:[{id:clone.id,atualizadoEm:clone.atualizadoEm}]},req),/reservado/);
 assert.equal((await f.service.listar(f.empresa)).length,1);
});

test('resposta perdida depois de salvar o lote é recuperável sem outra reserva',async()=>{
 const f=fixture();f.table().timeoutOnce();await assert.rejects(f.service.criar(f.empresa,f.body(),req),/Timeout committed/);
 const l=await f.service.criar(f.empresa,f.body(),req);assert.equal((await f.service.listar(f.empresa)).length,1);assert.equal(l.itens.length,2);assert.equal(f.emits.size,0);
});

test('lotes extensos respeitam o limite por propriedade e reconstituem o documento',()=>{
 const l={id:'emissao-'+'a'.repeat(64),tipo:'emissao-regularizacao',empresa:'sysney',itens:Array.from({length:30},(_,i)=>({i,descricao:'Descrição longa '.repeat(130)}))};
 const row=entidadeLoteFiscal(l);assert.ok(JSON.parse(row.json).partes>1);for(const [k,v] of Object.entries(row))if(k.startsWith('json'))assert.ok(Buffer.byteLength(v,'utf16le')<=60000);assert.deepEqual(lerLoteFiscal(row),l);
 assert.throws(()=>lerLoteFiscal({...row,json0:undefined}),/incompleto/);
});

test('data expirada bloqueia emissão sem criar outro trabalho fiscal',async()=>{
 const f=fixture();let l=await f.service.criar(f.empresa,f.body(),req);const original=l.dataFiscal;l.dataFiscal='2020-01-01';l.hash=manifestoLote(l);f.row('regularizacao-sysney',l.id,l);
 await assert.rejects(f.service.avancar(f.empresa,l.id,{hash:l.hash,modo:'validar'},req),/data de emissão mudou/i);assert.equal(f.calls.length,0);assert.notEqual(original,l.dataFiscal);
});


test('liberação protegida, homologação e serviço são conferidos antes de aprovar produção',async()=>{
 const f=fixture();let l=await validar(f,await f.service.criar(f.empresa,f.body(),req));
 const policy=f.table('AdminConfiguracoes').rows.get('nfse-nacional-politicas|sysney');
 f.table('AdminConfiguracoes').rows.delete('nfse-nacional-politicas|sysney');await assert.rejects(aprovar(f,l),/política protegida/);assert.equal(f.emits.size,0);
 f.table('AdminConfiguracoes').rows.set('nfse-nacional-politicas|sysney',policy);
 const proofs=f.table().rows;for(const key of proofs.keys())if(key.startsWith('nfse-nacional-homologacoes'))proofs.delete(key);
 await assert.rejects(aprovar(f,l),/homologação/);assert.equal(f.emits.size,0);
 f.table('FiscalFila').rows.clear();await assert.rejects(aprovar(f,l),/não está disponível/);assert.equal(f.emits.size,0);
});

test('homologação pode gerar nova versão de produção sem consumir nem vincular o PIX duas vezes',async()=>{
 const f=fixture();const body=f.body();body.configuracao={...body.configuracao,ambiente:'homologacao'};
 let l=await aprovar(f,await validar(f,await f.service.criar(f.empresa,body,req)));
 for(let c=0;c<8&&l.estado!=='concluido';c++)l=await f.service.avancar(f.empresa,l.id,{hash:l.hash,modo:'emitir'},req);
 assert.ok(l.itens.every(i=>i.status==='homologada'&&i.pdf&&i.xml));
 assert.equal(JSON.parse((await f.table().getEntity('regularizacao-sysney',f.recebimentos[0].id)).json).nota,'');
 const novo=await f.service.criar(f.empresa,{...f.body(),revisar:true},req);
 assert.equal(novo.versao,2);assert.equal(novo.configuracao.ambiente,'producao');assert.equal(novo.aprovacao,undefined);assert.ok(novo.itens.every(i=>i.status==='pendente'));assert.match(novo.historico[0].motivo,/Homologação/);
 const real=await aprovar(f,await validar(f,novo));await f.service.avancar(f.empresa,real.id,{hash:real.hash,modo:'emitir'},req);assert.equal(f.emits.size,3);
});


test('queda depois de vincular a nota recupera o mesmo documento e não duplica emissão',async()=>{
 const f=fixture();let l=await aprovar(f,await validar(f,await f.service.criar(f.empresa,f.body(),req)));
 const original=f.table().updateEntity.bind(f.table());let fail=true;
 f.table().updateEntity=async(e,...args)=>{if(e.rowKey===l.id){const value=lerLoteFiscal(e);if(fail&&!value.execucao&&value.itens[0].status==='emitida'){fail=false;throw Error('Resposta final perdida');}}return original(e,...args);};
 await assert.rejects(f.service.avancar(f.empresa,l.id,{hash:l.hash,modo:'emitir'},req),/perdida/);
 assert.equal(f.emits.size,1);assert.ok(JSON.parse((await f.table().getEntity('regularizacao-sysney',f.recebimentos[0].id)).json).nota);
 l=(await f.service.lote(f.empresa,l.id)).l;l.execucao.em='2020-01-01T00:00:00Z';f.row('regularizacao-sysney',l.id,l);
 for(let c=0;c<5&&l.itens[0].status!=='emitida';c++)l=await f.service.avancar(f.empresa,l.id,{hash:l.hash,modo:'consultar',recebimentoId:l.itens[0].recebimentoId},req);
 assert.equal(l.itens[0].status,'emitida');assert.equal(f.emits.size,1);
});
