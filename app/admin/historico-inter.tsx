"use client";
import { useEffect, useState } from "react";
import {MensagemAdmin} from "./dialogos-admin";
type Registro = { id: string; cliente: string; documento: string; numero: string; emissao: string; vencimento: string; valor: number; situacao: string; dataSituacao: string; consultadoEm: string; pdf?: boolean };
const data = (v: string) => /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0,10).split("-").reverse().join("/") : "—";
export function HistoricoInter({ empresa }: { empresa: "sysney" | "drsoft" }) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("Carregando histórico…");
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/admin/historico-inter?empresa=${empresa}`, { cache: "no-store", signal: abort.signal }).then(async r => {
      const d = await r.json(); if (!r.ok) throw new Error(d.erro);
      setRegistros(d.cobrancas); setAviso("");
    }).catch(e => { if (!abort.signal.aborted) setAviso(e instanceof Error ? e.message : "Falha na consulta."); });
    return () => abort.abort();
  }, [empresa]);
  const lista = registros.filter(r => `${r.cliente} ${r.documento} ${r.numero} ${r.situacao}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  return <section className="space-y-5">
    <header className="rounded-3xl bg-[#071b30] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Banco Inter · {empresa.toUpperCase()}</p><h2 className="mt-2 text-2xl font-black">Histórico de cobranças importadas</h2><p className="mt-2 text-sm text-slate-300">Consulta dos registros bancários, sem emitir, cancelar ou dar baixa em boletos.</p></header>
    <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">As situações refletem a última importação, não uma consulta em tempo real. Este histórico não comprova envio de e-mail nem importa notas fiscais. A competência do serviço deve ser conferida na nota ou no contrato.</p>
    <label className="block text-sm font-semibold">Buscar cliente, documento, número ou situação<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3" value={busca} onChange={e => setBusca(e.target.value)}/></label>
    {aviso==="Carregando histórico…"?<p aria-live="polite" className="text-sm text-slate-600">Carregando histórico…</p>:aviso?<MensagemAdmin mensagem={aviso} aoFechar={()=>setAviso("")} titulo="Histórico bancário indisponível" subtitulo="A consulta ao histórico não foi concluída" tom="erro" observacao="Nenhum boleto foi emitido, cancelado ou baixado por esta consulta."/>:<p className="text-sm text-slate-600">{lista.length} de {registros.length} cobranças importadas.</p>}
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Cliente / documento", "Número", "Emissão", "Vencimento", "Valor", "Situação no Inter", "Consultado em", "Arquivo"].map(t => <th className="whitespace-nowrap p-4" key={t}>{t}</th>)}</tr></thead><tbody>{lista.map(r => <tr key={r.id} className="border-t border-slate-100"><td className="min-w-64 p-4"><strong>{r.cliente}</strong><span className="block text-xs text-slate-500">{r.documento}</span></td><td className="p-4">{r.numero || "—"}</td><td className="p-4">{data(r.emissao)}</td><td className="p-4">{data(r.vencimento)}</td><td className="whitespace-nowrap p-4">{r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="p-4"><strong>{r.situacao}</strong><span className="block text-xs text-slate-500">{data(r.dataSituacao)}</span></td><td className="p-4">{data(r.consultadoEm)}</td><td className="whitespace-nowrap p-4">{r.pdf ? <a className="font-semibold text-blue-700 hover:underline" href={`/api/admin/historico-inter?empresa=${empresa}&id=${encodeURIComponent(r.id)}&arquivo=pdf`}>Baixar PDF</a> : <span className="text-xs text-slate-400">Não disponível</span>}</td></tr>)}</tbody></table></div>
    {!aviso && lista.length === 0 && <p className="text-sm text-slate-500">Nenhuma cobrança importada encontrada para este filtro e empresa.</p>}
  </section>;
}
