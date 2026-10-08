"use client";
import {useEffect,useState} from 'react';
import {moeda} from '@/lib/cobrancas';
import {compararPgdas,type ApuracaoPgdas} from '@/lib/pgdas';
import type {NotaFinanceira} from '@/lib/visao-financeira';
import {MensagemAdmin} from './dialogos-admin';
const card='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6';
export function ApuracoesPgdas({empresa,notas,inicio,fim}:{empresa:'sysney'|'drsoft';notas:NotaFinanceira[];inicio:string;fim:string}){
  const [dados,setDados]=useState<{empresa:string;apuracoes:ApuracaoPgdas[];erro?:string}|null>(null);
  const [revisao,setRevisao]=useState(0);
  const [mesDetalhe,setMesDetalhe]=useState('');
  useEffect(()=>{
    const abort=new AbortController();
    fetch(`/api/admin/nfse?empresa=${empresa}&pgdas=1`,{cache:'no-store',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(45000)])}).then(async r=>{
      if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))throw Error('Não foi possível consultar as apurações. Atualize ou confira o acesso administrativo.');
      const j=await r.json();if(!Array.isArray(j.apuracoes))throw Error('Resposta fiscal inválida.');
      if(!abort.signal.aborted)setDados({empresa,apuracoes:j.apuracoes});
    }).catch(e=>{if(!abort.signal.aborted)setDados({empresa,apuracoes:[],erro:e.message});});
    return ()=>abort.abort();
  },[empresa,revisao]);
  const atual=dados?.empresa===empresa?dados:null;
  const apuracoes=atual?.apuracoes||[];
  const linhas=compararPgdas(apuracoes,notas,inicio,fim);
  const importadas=linhas.filter(l=>l.apuracao);
  const receita=importadas.reduce((s,l)=>s+l.apuracao!.receita,0);
  const imposto=importadas.reduce((s,l)=>s+l.apuracao!.debito,0);
  const ultimo=apuracoes.at(-1);
  const detalhe=apuracoes.find(a=>a.mes===mesDetalhe)||ultimo;
  return <section className={card}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Receita Federal · PGDAS-D</p><h3 className="mt-2 text-xl font-bold text-slate-900">Faturamento e impostos declarados</h3><p className="mt-2 text-sm text-slate-500">Conferência mensal com os demonstrativos oficiais, sem alterar a apuração.</p></div><button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-700" onClick={()=>setRevisao(v=>v+1)}>Atualizar apurações</button></div>
    {!atual?<p className="mt-5 text-sm text-slate-500">Consultando apurações privadas…</p>:atual.erro?<MensagemAdmin mensagem={atual.erro} titulo="Apurações indisponíveis" subtitulo="A consulta não foi concluída" tom="erro" aoFechar={()=>setDados({...atual,erro:undefined})} acao={()=>setRevisao(v=>v+1)} rotuloAcao="Tentar consultar novamente"/>:!apuracoes.length?<p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Nenhuma apuração PGDAS-D importada desta empresa. Isso não significa imposto zero. Para lucro presumido, PGDAS-D não se aplica.</p>:<>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">{[['Receita declarada',moeda(receita)],['Impostos apurados · principal',moeda(imposto)],['Meses com declaração no filtro',String(importadas.length)]].map(([titulo,valor])=><div key={titulo} className="rounded-xl bg-blue-50 p-4"><p className="text-xs text-blue-800">{titulo}</p><p className="mt-2 text-xl font-bold text-blue-900">{valor}</p></div>)}</div>
      {detalhe&&<div className="mt-4 rounded-xl border border-blue-100 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-sm font-bold text-slate-900">Base oficial e enquadramento declarado</h4><label className="text-xs text-slate-500">Competência da apuração<select className="ml-2 rounded-lg border border-slate-200 p-2 text-sm" value={detalhe.mes} onChange={e=>setMesDetalhe(e.target.value)}>{apuracoes.map(a=><option key={a.mes} value={a.mes}>{a.mes}</option>)}</select></label></div><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><p>RBT12 declarado: <strong>{moeda(detalhe.rbt12)}</strong>{detalhe.rbt12p!==null&&<span className="mt-1 block text-xs text-slate-500">RBT12 proporcionalizado: {moeda(detalhe.rbt12p)} · início de atividade</span>}</p><p>{detalhe.regime} · {detalhe.atividade}</p></div><p className="mt-3 text-xs text-slate-500">Fonte: declaração {detalhe.declaracao}. A alíquota exibida é a razão entre imposto principal e receita, sujeita ao arredondamento dos tributos. Este perfil é histórico, não uma configuração para futuras emissões.</p></div>}
      <p className="mt-4 text-xs leading-5 text-slate-500">Filtro pelas competências dos meses que intersectam as datas inicial/final: cada apuração abrange o mês inteiro. A busca por cliente e a seleção de notas não reduzem a receita declarada da empresa. Diferenças com notas emitidas são sinais para conferência, não prova de erro contábil. Cancelamentos e competência precisam ser conciliados.</p>
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><p className="font-bold">Imposto apurado não é imposto pago nem saldo da dívida</p><p className="mt-1">Valores originais das declarações, sem atualização de juros, multas, parcelamentos ou pagamentos. Não somamos guias reemitidas da mesma competência. {ultimo&&<>Última declaração importada: {ultimo.mes} · {ultimo.regime} · {ultimo.atividade}. O enquadramento foi declarado pela contabilidade; ainda precisa ser validado para as atividades efetivas.</>}</p><p className="mt-2">Meses futuros permanecem sem apuração oficial. Não aplicamos a última alíquota automaticamente: receita acumulada, atividades e regras do período podem mudar.</p></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Competência','Notas válidas / emissão','Receita declarada','Diferença / conferir','Impostos apurados','Alíquota efetiva','Mesmo mês / ano anterior','Fonte'].map(t=><th className="p-3" key={t}>{t}</th>)}</tr></thead><tbody>{linhas.map(l=>{
        const anterior=apuracoes.find(a=>a.mes===`${Number(l.mes.slice(0,4))-1}${l.mes.slice(4)}`);
        return <tr key={l.mes} className="border-b border-slate-100 align-top"><td className="p-3 font-semibold">{l.mes}<p className="mt-1 text-xs font-normal text-slate-500">{l.canceladas} cancelada(s)</p></td><td className="p-3 whitespace-nowrap">{moeda(l.fiscal)}</td><td className="p-3 whitespace-nowrap">{l.apuracao?moeda(l.apuracao.receita):'Não disponível'}</td><td className={`p-3 whitespace-nowrap ${l.diferenca?'text-amber-700':'text-slate-600'}`}>{l.diferenca===null?'Sem declaração':l.diferenca===0?'Valores coincidem':moeda(l.diferenca)}</td><td className="p-3 whitespace-nowrap font-semibold">{l.apuracao?moeda(l.apuracao.debito):'Não disponível'}</td><td className="p-3">{l.aliquota===null?'Não aplicável':`${l.aliquota.toLocaleString('pt-BR',{maximumFractionDigits:4})}%`}</td><td className="p-3 whitespace-nowrap">{anterior?<>Receita: {moeda(anterior.receita)}<p className="mt-1 text-xs text-slate-500">Impostos: {moeda(anterior.debito)}</p></>:'Não importado'}</td><td className="p-3">{l.apuracao&&<a className="font-semibold text-blue-700 hover:underline" href={`/api/admin/nfse?empresa=${empresa}&pgdas=1&mes=${l.mes}`}>PDF oficial</a>}</td></tr>;
      })}</tbody></table></div>
      {!linhas.length&&<p className="mt-4 text-sm text-slate-500">Nenhum mês disponível neste intervalo.</p>}
    </>}
  </section>;
}
