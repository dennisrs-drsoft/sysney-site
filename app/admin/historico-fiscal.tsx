"use client";
import { useEffect, useState } from "react";
import { dataBr, moeda } from "@/lib/cobrancas";
import { lerRespostaAdmin } from "@/lib/admin-resposta";
import { MensagemAdmin } from "./dialogos-admin";

type Nota = { numero: string; documento: string; cliente: string; emissao: string; centavos: number; situacao: string; xml: boolean; pdf: boolean; consultadoEm: string };
export function HistoricoFiscal({ empresa }: { empresa: "sysney" | "drsoft" }) {
  const [notas, setNotas] = useState<Nota[]>([]), [carregando, setCarregando] = useState(true), [erro, setErro] = useState("");
  const [inicio, setInicio] = useState(""), [fim, setFim] = useState(""), [busca, setBusca] = useState(""), [pagina, setPagina] = useState(1), [carga, setCarga] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function carregar() {
      setCarregando(true);
      try {
        const resposta = await fetch(`/api/admin/nfse?empresa=${empresa}&historico=1`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) });
        const r = await lerRespostaAdmin<{ notas: Nota[]; erro?: string }>(resposta);
        if (!resposta.ok) throw new Error(r.erro || "Falha ao consultar o arquivo fiscal.");
        if (!controller.signal.aborted) { setNotas(r.notas); setErro(""); }
      } catch (e) { if (!controller.signal.aborted) { setNotas([]); setErro(e instanceof Error ? e.message : "Falha na consulta fiscal."); } }
      finally { if (!controller.signal.aborted) setCarregando(false); }
    }
    void carregar(); return () => controller.abort();
  }, [empresa, carga]);
  const lista = notas.filter(n => (!inicio || n.emissao.slice(0,10) >= inicio) && (!fim || n.emissao.slice(0,10) <= fim) && `${n.cliente} ${n.documento} ${n.numero}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const paginas = Math.max(1, Math.ceil(lista.length / 15)), atual = Math.min(pagina, paginas);
  const link = (n: Nota, formato: string) => `/api/admin/nfse?empresa=${empresa}&historico=1&numero=${encodeURIComponent(n.numero)}&arquivo=${formato}`;
  return <section className="space-y-5">
    <header className="rounded-2xl bg-[#071b30] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Arquivo fiscal · {empresa.toUpperCase()}</p><h2 className="mt-3 text-2xl font-bold">Notas emitidas e seus arquivos</h2><p className="mt-3 text-sm text-slate-300">Documentos consultados na Prefeitura, inclusive notas emitidas antes deste sistema. Baixar não emite, cancela ou envia nada.</p></header>
    <p className="rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">XML individual extraído da resposta oficial de consulta; a resposta completa também é preservada no arquivo privado. Datas de emissão são fiscais, não competências presumidas. Notas canceladas permanecem no histórico.</p>
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-3">{[["Data inicial", inicio, setInicio], ["Data final", fim, setFim]].map(([nome, valor, alterar]) => <label key={String(nome)} className="text-xs font-semibold text-slate-600">{String(nome)}<input type="date" className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" value={String(valor)} onChange={e => { (alterar as typeof setInicio)(e.target.value); setPagina(1); }}/></label>)}<label className="text-xs font-semibold text-slate-600">Cliente, documento ou nota<input className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" value={busca} onChange={e => {setBusca(e.target.value);setPagina(1);}}/></label></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{carregando ? "Consultando arquivo fiscal…" : `${lista.length} de ${notas.length} notas importadas`}</p><button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50" disabled={carregando} onClick={() => setCarga(v=>v+1)}>Atualizar arquivo salvo</button></div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["NFS-e", "Cliente", "Emissão fiscal", "Valor", "Situação", "Arquivos"].map(v=><th className="p-4" key={v}>{v}</th>)}</tr></thead><tbody>{!carregando && lista.slice((atual-1)*15,atual*15).map(n=><tr key={n.numero} className="border-t border-slate-100 align-top"><td className="p-4 font-semibold">{n.numero}</td><td className="max-w-[320px] p-4"><p className="font-semibold text-slate-900">{n.cliente}</p><p className="mt-1 text-xs text-slate-500">{n.documento}</p></td><td className="whitespace-nowrap p-4">{dataBr(n.emissao.slice(0,10))}</td><td className="whitespace-nowrap p-4 font-semibold">{moeda(n.centavos)}</td><td className="p-4">{n.situacao === "C" ? "Cancelada" : n.situacao === "N" ? "Emitida" : n.situacao || "Não informada"}</td><td className="whitespace-nowrap p-4">{n.xml && <a className="mr-4 font-semibold text-blue-700 hover:underline" href={link(n,"xml")}>Baixar XML</a>}{n.pdf ? <a className="font-semibold text-blue-700 hover:underline" href={link(n,"pdf")}>Baixar PDF</a> : <span className="text-xs text-slate-400">PDF não disponível</span>}</td></tr>)}</tbody></table>{!carregando && !lista.length && <p className="p-8 text-center text-sm text-slate-500">{erro ? "Consulta indisponível; tente atualizar." : "Nenhuma nota importada neste filtro."}</p>}</div>
    <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Página {atual} de {paginas}</span><div className="flex gap-3"><button disabled={atual===1} className="rounded-xl border border-slate-200 bg-white px-4 py-2 disabled:opacity-40" onClick={()=>setPagina(atual-1)}>Anterior</button><button disabled={atual===paginas} className="rounded-xl border border-slate-200 bg-white px-4 py-2 disabled:opacity-40" onClick={()=>setPagina(atual+1)}>Próxima</button></div></div>
    <MensagemAdmin mensagem={erro} titulo="Arquivo fiscal indisponível" subtitulo="Não foi possível consultar os documentos salvos" tom="erro" observacao="Nenhuma nota foi emitida ou cancelada." aoFechar={()=>setErro("")} acao={()=>{setErro("");setCarga(v=>v+1);}}/>
  </section>;
}
