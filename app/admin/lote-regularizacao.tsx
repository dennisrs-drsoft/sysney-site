"use client";
import { useEffect, useState } from "react";
import { moeda, dataBr, type Empresa } from "@/lib/cobrancas";
import { simularRegularizacao, validarLoteRegularizacao, textoRegularizacao, type RegularizacaoFiscal, type LoteRegularizacao } from "@/lib/regularizacao-fiscal";
import { lerRespostaAdmin } from "@/lib/admin-resposta";
import { ModalAdmin, MensagemAdmin, useConfirmarAdmin } from "./dialogos-admin";
import type { ApuracaoPgdas } from "@/lib/pgdas";

const botao="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-800 disabled:opacity-50";
export function LoteRegularizacaoPainel({empresa,selecionados,lotes,aoLimpar,aoSalvar}:{empresa:Empresa;selecionados:RegularizacaoFiscal[];lotes:LoteRegularizacao[];aoLimpar:()=>void;aoSalvar:()=>Promise<void>}) {
  const [percentual,setPercentual]=useState("");
  const [origem,setOrigem]=useState("");
  const [ocupado,setOcupado]=useState(false);
  const [aviso,setAviso]=useState("");
  const [comunicado,setComunicado]=useState("");
  const [apuracoes,setApuracoes]=useState<ApuracaoPgdas[]>([]),[mesBase,setMesBase]=useState("");
  const [erroPgdas,setErroPgdas]=useState("");
  useEffect(()=>{
    const abort=new AbortController();
    fetch(`/api/admin/nfse?empresa=${empresa}&pgdas=1`,{cache:"no-store",signal:AbortSignal.any([abort.signal,AbortSignal.timeout(45000)])}).then(async r=>{
      const d=await lerRespostaAdmin<{apuracoes:ApuracaoPgdas[];erro?:string}>(r);
      if(!r.ok||!Array.isArray(d.apuracoes))throw Error(d.erro||"Apurações indisponíveis.");
      if(!abort.signal.aborted)setApuracoes(d.apuracoes.filter(a=>Number.isFinite(a.receita)&&a.receita>0&&Number.isFinite(a.debito)&&a.debito>=0).sort((a,b)=>b.mes.localeCompare(a.mes)));
    }).catch(()=>{if(!abort.signal.aborted)setErroPgdas("Não foi possível consultar as apurações oficiais; não assumimos imposto zero.");});
    return()=>abort.abort();
  },[empresa]);
  const base=apuracoes.find(a=>a.mes===mesBase);
  const confirmar=useConfirmarAdmin();
  const simulacao=simularRegularizacao(selecionados,percentual);
  let bloqueio="";
  try {validarLoteRegularizacao(selecionados,empresa);} catch(e) {bloqueio=e instanceof Error?e.message:"Confira a seleção.";}
  const reservado=selecionados.some(r=>lotes.some(l=>l.recebimentos.some(s=>s.id===r.id)));
  if(reservado)bloqueio="Há recebimento já reservado em um lote. Confira o planejamento salvo abaixo.";
  async function preparar() {
    if(bloqueio||simulacao.imposto===null||!origem.trim())return;
    if(!await confirmar({titulo:"Preparar lote de regularização?",subtitulo:"Valores já pagos · sem boleto nem cobrança ao cliente",descricao:"Salva uma preparação fiscal, com um registro por pagamento. Não emite notas nem envia e-mail. A data de preparação é atual, mas as competências reais e o PIX original ficam preservados. A transmissão depende de validação fiscal específica.",confirmar:"Salvar lote para revisão",detalhes:[{rotulo:"Recebimentos",valor:String(selecionados.length)},{rotulo:"Total documentável",valor:moeda(simulacao.total)},{rotulo:"Cenário de imposto",valor:moeda(simulacao.imposto)},{rotulo:"Alíquota informada",valor:`${percentual}%`},{rotulo:"Origem do cenário",valor:origem}],observacao:"Esta estimativa não comprova imposto devido, pago ou adicional. Não transfere receita antiga para a apuração atual."}))return;
    setOcupado(true);
    try {
      const r=await fetch(`/api/admin/cobrancas?empresa=${empresa}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao:"preparar-lote-regularizacao",recebimentos:selecionados.map(x=>({id:x.id,atualizadoEm:x.atualizadoEm})),percentual,origemCenario:origem})});
      const d=await lerRespostaAdmin<{erro?:string}>(r,true);if(!r.ok)throw Error(d.erro);
      aoLimpar();await aoSalvar();
    } catch(e) {setAviso(e instanceof Error?e.message:"Não foi possível preparar o lote.");} finally {setOcupado(false);}
  }
  function abrirComunicado(){try{setComunicado(textoRegularizacao(selecionados));}catch(e){setAviso(e instanceof Error?e.message:"Confira as notas selecionadas.");}}
  return <>
    <section className="space-y-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Seleção e cenário financeiro</p><h3 className="mt-2 text-xl font-bold">Planejar a regularização em etapas</h3></div><button className={botao} disabled={!selecionados.length||ocupado} onClick={aoLimpar}>Limpar seleção</button></div>
      <p className="text-sm text-slate-600">Marque pagamentos na tabela. O total inclui toda a seleção, mesmo os itens fora do filtro de datas.</p>
      <div className="grid gap-3 sm:grid-cols-3">{[["Recebimentos selecionados",String(selecionados.length)],["Total dos pagamentos",moeda(simulacao.total)],["Imposto estimado do cenário",simulacao.imposto===null?"Informe a alíquota":moeda(simulacao.imposto)]].map(([t,v])=><div className="rounded-xl bg-blue-50 p-4" key={t}><p className="text-xs text-blue-800">{t}</p><p className="mt-2 text-xl font-bold text-blue-950">{v}</p></div>)}</div>
      <div className="rounded-xl border border-slate-200 p-4"><label className="text-sm font-semibold">Referência oficial histórica · PGDAS-D<select className="mt-2 w-full rounded-lg border border-slate-300 p-2" value={mesBase} onChange={e=>setMesBase(e.target.value)}><option value="">Escolha uma apuração para comparar</option>{apuracoes.map(a=><option key={a.mes} value={a.mes}>{a.mes} · declaração {a.declaracao}</option>)}</select></label>{base&&<><p className="mt-3 text-xs text-slate-600">Receita {moeda(base.receita)} · imposto principal {moeda(base.debito)} · razão efetiva histórica {(base.debito/base.receita*100).toLocaleString("pt-BR",{maximumFractionDigits:4})}% · {base.regime} · {base.atividade}</p><button className={`${botao} mt-3`} onClick={()=>{setPercentual((base.debito/base.receita*100).toFixed(4).replace(".",","));setOrigem(`Cenário com razão histórica da declaração ${base.declaracao}, ${base.mes}. Não valida a apuração atual.`);}}>Usar apenas como cenário histórico</button></>}<p className="mt-3 text-xs text-slate-500">{erroPgdas||"A razão histórica permite comparação, mas não confirma anexo, alíquota atual ou imposto adicional. Não aplicamos essa referência sem sua escolha."}</p></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Alíquota efetiva do cenário (%)<input className="mt-1 w-full rounded-xl border border-slate-300 p-3" type="text" inputMode="decimal" value={percentual} onChange={e=>setPercentual(e.target.value)} placeholder="Ex.: 7,50" maxLength={7}/></label><label className="text-sm font-semibold">Fonte e premissas desta alíquota<input className="mt-1 w-full rounded-xl border border-slate-300 p-3" value={origem} onChange={e=>setOrigem(e.target.value)} placeholder="Ex.: cenário preliminar, ainda não validado" maxLength={1000}/></label></div>
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">Simulação = total selecionado × percentual informado. Não é cálculo oficial do Simples nem imposto adicional do mês atual. RBT12, atividade/anexo, regime de caixa ou competência, receitas já declaradas e possíveis retificações precisam ser conferidos. Não reutilizamos uma alíquota histórica automaticamente.</p>
      {selecionados.length>0&&<ul className="space-y-1 text-xs text-slate-600">{selecionados.map(r=><li key={r.id}>PIX {dataBr(r.recebimento)} · {moeda(r.centavos)} · referência {r.competencia||"a confirmar"} · {r.nota?`NFS-e ${r.nota}`:"nota pendente"}</li>)}</ul>}
      <div className="flex flex-wrap gap-3"><button className={botao} disabled={ocupado||!!bloqueio||simulacao.imposto===null||!origem.trim()} onClick={()=>void preparar()}>Preparar lote pago — sem emitir</button><button className={botao} disabled={!selecionados.length||ocupado} onClick={abrirComunicado}>Prévia do comunicado de regularização</button></div>
      <p className="text-xs text-slate-500">{bloqueio||"Competências revisadas. A preparação fica pendente da validação fiscal antes de transmitir notas."}</p>
    </section>
    {!!lotes.length&&<section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-bold">Lotes preparados · sem transmissão</h3>{lotes.map(l=><article key={l.id} className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm"><p className="font-bold">{dataBr(l.dataPreparacao)} · {l.recebimentos.length} registro(s) já pago(s) · {moeda(l.total)}</p><p className="mt-2">Cenário {l.percentualCenario}%: {moeda(l.impostoEstimado)}. Fonte: {l.origemCenario}</p><p className="mt-2 text-amber-900">Aguardando validação fiscal. Nenhuma nota emitida ou mensagem enviada por este lote.</p><details className="mt-3"><summary className="cursor-pointer font-semibold">Conferir referências e descrições</summary>{l.recebimentos.map(r=><p key={r.id} className="mt-2 text-xs">{r.descricao} · {moeda(r.centavos)}</p>)}</details></article>)}</section>}
    <ModalAdmin aberto={!!comunicado} titulo="Comunicado de regularização" subtitulo="Prévia informativa · não é cobrança e não será enviada" descricao={`Para: ${selecionados[0]?.email||""}\n\n${comunicado}`} confirmar="Fechar prévia" aoFechar={()=>setComunicado("")} observacao="Prévia baseada somente em notas vinculadas. Ainda não prepara envio, não anexa PDFs e não envia e-mail."/>
    <MensagemAdmin mensagem={aviso} aoFechar={()=>setAviso("")} titulo="Confira o planejamento" subtitulo="Regularização de pagamentos já recebidos" tom="atencao"/>
  </>;
}
