"use client";
import { useCallback, useEffect, useState } from "react";
import {MensagemAdmin,useConfirmarAdmin} from "./dialogos-admin";
import {SincronizacaoInter} from "./sincronizacao-inter";
import { useOrdenacaoTabela } from "./ordenacao-tabela";
import type {ConciliacaoHistorica} from "@/lib/conciliacao-historica";

type Registro = { id: string; cliente: string; documento: string; numero: string; emissao: string; vencimento: string; valor: number; situacao: string; dataSituacao: string; consultadoEm: string; conciliacao?: ConciliacaoHistorica; pdf?: boolean };
const data = (v: string) => /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0,10).split("-").reverse().join("/") : "—";
export function HistoricoInter({ empresa }: { empresa: "sysney" | "drsoft" }) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("Carregando histórico…");
  const [carga,setCarga]=useState(0);
  const [recuperando,setRecuperando]=useState("");
  const confirmar = useConfirmarAdmin();
  async function conciliar(id:string, numeros:string) {
    const notas = numeros.trim().split(/[,;\s]+/).map(n => n.replace(/^0+/, ""));
    if (notas.some(n => !/^[1-9]\d{0,14}$/.test(n))) {
      setAviso("Informe os números das notas separados por vírgula.");
      return;
    }
    if (!await confirmar({titulo:"Vincular notas ao boleto histórico",subtitulo:"Pagamento por PIX já registrado",
      descricao:"O sistema confere se as notas pertencem ao mesmo cliente e estão quitadas pelo mesmo PIX.",
      detalhes:[{rotulo:"NFS-e",valor:notas.join(", ")}],confirmar:"Confirmar vínculo"})) return;
    setRecuperando(id);
    try {
      const r=await fetch(`/api/admin/historico-inter?empresa=${empresa}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao:"conciliar-notas-pix",id,notas,confirmado:true})});
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||"Não foi possível vincular as notas.");
      setCarga(v=>v+1);
    }catch(e){setAviso(e instanceof Error?e.message:"Não foi possível vincular as notas.");}
    finally{setRecuperando("");}
  }
  async function recuperar(id:string){
    setRecuperando(id);
    try{
      const r=await fetch(`/api/admin/historico-inter?empresa=${empresa}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao:"recuperar-pdf",id})});
      const d=await r.json();if(!r.ok)throw Error(d.erro||"PDF não recuperado. Tente novamente mais tarde; nenhum boleto foi reemitido.");
      setCarga(v=>v+1);
    }catch(e){setAviso(e instanceof Error?e.message:"Não foi possível recuperar o PDF.");}finally{setRecuperando("");}
  }
  const recarregar=useCallback(()=>setCarga(v=>v+1),[]);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/admin/historico-inter?empresa=${empresa}`, { cache: "no-store", signal: abort.signal }).then(async r => {
      const d = await r.json(); if (!r.ok) throw new Error(d.erro);
      setRegistros(d.cobrancas); setAviso("");
    }).catch(e => { if (!abort.signal.aborted) setAviso(e instanceof Error ? e.message : "Falha na consulta."); });
    return () => abort.abort();
  }, [empresa,carga]);
  const filtradas = registros.filter(r => `${r.cliente} ${r.documento} ${r.numero} ${r.situacao}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const { ordenadas: lista, cabecalhos, restaurar } = useOrdenacaoTabela(filtradas, [
    { titulo: "Cliente / documento", valor: r => r.cliente }, { titulo: "Número", valor: r => r.numero },
    { titulo: "Emissão", valor: r => r.emissao }, { titulo: "Vencimento", valor: r => r.vencimento },
    { titulo: "Valor", valor: r => r.valor }, { titulo: "Situação no Inter", valor: r => r.situacao },
    { titulo: "Consultado em", valor: r => r.consultadoEm }, { titulo: "Arquivo" },
  ], "Vencimento", undefined, r => r.emissao + " " + r.numero);
  return <section className="space-y-5">
    <header className="rounded-3xl bg-[#071b30] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Banco Inter · {empresa.toUpperCase()}</p><h2 className="mt-2 text-2xl font-black">Histórico de cobranças importadas</h2><p className="mt-2 text-sm text-slate-300">Consulta dos registros bancários, sem emitir, cancelar ou dar baixa em boletos.</p></header>
    <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">As situações refletem a última importação, não uma consulta em tempo real. Este histórico não comprova envio de e-mail nem importa notas fiscais. A competência do serviço deve ser conferida na nota ou no contrato.</p>
    <SincronizacaoInter key={empresa} empresa={empresa} aoAtualizar={recarregar}/>
    <label className="block text-sm font-semibold">Buscar cliente, documento, número ou situação<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3" value={busca} onChange={e => setBusca(e.target.value)}/></label>
    {aviso==="Carregando histórico…"?<p aria-live="polite" className="text-sm text-slate-600">Carregando histórico…</p>:aviso?<MensagemAdmin mensagem={aviso} aoFechar={()=>setAviso("")} titulo="Histórico bancário indisponível" subtitulo="A consulta ao histórico não foi concluída" tom="erro" observacao="Nenhum boleto foi emitido, cancelado ou baixado por esta consulta."/>:<p className="text-sm text-slate-600">{lista.length} de {registros.length} cobranças importadas.</p>}
    <p className="text-xs text-slate-500">Clique nos títulos para ordenar. <button type="button" className="font-semibold text-blue-700" onClick={restaurar}>Restaurar vencimento decrescente</button></p>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{cabecalhos}</tr></thead><tbody>{lista.map(r => <tr key={r.id} className="border-t border-slate-100"><td className="min-w-64 p-4"><strong>{r.cliente}</strong><span className="block text-xs text-slate-500">{r.documento}</span></td><td className="p-4">{r.numero || "—"}</td><td className="p-4">{data(r.emissao)}</td><td className="p-4">{data(r.vencimento)}</td><td className="whitespace-nowrap p-4">{r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="p-4"><strong>{r.situacao}</strong><span className="block text-xs text-slate-500">{data(r.dataSituacao)}</span>{r.conciliacao && <span className="mt-1 block text-xs text-emerald-800">PIX conciliado em {data(r.conciliacao.data)} · NFS-e {r.conciliacao.notas.join(", ")}</span>}</td><td className="p-4">{data(r.consultadoEm)}</td><td className="whitespace-nowrap p-4">{r.pdf ? <a className="font-semibold text-blue-700 hover:underline" href={`/api/admin/historico-inter?empresa=${empresa}&id=${encodeURIComponent(r.id)}&arquivo=pdf`}>Baixar PDF</a> : <button type="button" disabled={!!recuperando} className="font-semibold text-blue-700 disabled:opacity-50" onClick={()=>void recuperar(r.id)}>{recuperando===r.id?"Recuperando…":"Tentar baixar PDF"}</button>}{r.situacao==="MARCADO_RECEBIDO" && !r.conciliacao && <details className="mt-2"><summary className="cursor-pointer text-blue-800">Vincular NFS-e ao PIX</summary><form className="mt-2 flex flex-wrap gap-2" onSubmit={event=>{event.preventDefault();void conciliar(r.id,String(new FormData(event.currentTarget).get("notas")||""));}}><input name="notas" aria-label="Números das NFS-e" placeholder="Ex.: 821, 831" required maxLength={320} className="border px-2"/><button type="submit" disabled={!!recuperando} className="border px-2 text-blue-800">Conferir vínculo</button></form></details>}</td></tr>)}</tbody></table></div>
    {!aviso && lista.length === 0 && <p className="text-sm text-slate-500">Nenhuma cobrança importada encontrada para este filtro e empresa.</p>}
  </section>;
}
