"use client";
import { useEffect, useState } from "react";
import { dataBr, moeda } from "@/lib/cobrancas";
import { lerRespostaAdmin } from "@/lib/admin-resposta";
import { MensagemAdmin } from "./dialogos-admin";
import type { EmailCobranca } from "@/lib/emails-cobranca";
import { unificarNotas, filtrarNotas, type NotaHistorica, type NotaUnificada } from "@/lib/notas-unificadas";

import { useOrdenacaoTabela } from "./ordenacao-tabela";

type Nota = NotaUnificada;
export function HistoricoFiscal({ empresa }: { empresa: "sysney" | "drsoft" }) {
  const [notas, setNotas] = useState<Nota[]>([]), [carregando, setCarregando] = useState(true), [erro, setErro] = useState("");
  const [inicio, setInicio] = useState(""), [fim, setFim] = useState(""), [busca, setBusca] = useState(""), [pagina, setPagina] = useState(1), [carga, setCarga] = useState(0);
  const [semData, setSemData] = useState(true);
  const [empresaCarregada, setEmpresaCarregada] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function carregar() {
      setCarregando(true);
      try {
        async function consultar<T>(url: string) {
          const resposta = await fetch(url, {cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)])});
          const r = await lerRespostaAdmin<T & {erro?: string}>(resposta);
          if (!resposta.ok) throw Error(r.erro || "Consulta indisponível.");
          return r;
        }
        const [historico, sistema] = await Promise.allSettled([
          consultar<{notas: NotaHistorica[]}>(`/api/admin/nfse?empresa=${empresa}&historico=1`),
          consultar<{emails: EmailCobranca[]}>(`/api/admin/emails?empresa=${empresa}`),
        ]);
        if (!controller.signal.aborted) {
          setNotas(unificarNotas(historico.status === "fulfilled" ? historico.value.notas : [], sistema.status === "fulfilled" ? sistema.value.emails : [], empresa));
          setErro([historico.status === "rejected" ? "Histórico importado indisponível." : "", sistema.status === "rejected" ? "Notas das cobranças indisponíveis." : ""].filter(Boolean).join(" "));
          setPagina(1);
          setEmpresaCarregada(empresa);
        }
      } catch (e) { if (!controller.signal.aborted) { setNotas([]); setErro(e instanceof Error ? e.message : "Falha na consulta fiscal."); } }
      finally { if (!controller.signal.aborted) setCarregando(false); }
    }
    void carregar(); return () => controller.abort();
  }, [empresa, carga]);
  const visiveis = empresaCarregada === empresa ? notas : [];
  const filtradas = inicio && fim && inicio > fim ? [] : filtrarNotas(visiveis, busca, inicio, fim, semData);
  const { ordenadas: lista, cabecalhos, restaurar } = useOrdenacaoTabela(filtradas, [
    { titulo: "NFS-e", valor: n => n.numero }, { titulo: "Cliente", valor: n => n.cliente },
    { titulo: "Emissão fiscal", valor: n => n.emissao }, { titulo: "Valor", valor: n => n.centavos },
    { titulo: "Situação", valor: n => n.situacao === "N" ? "Emitida" : n.situacao === "C" ? "Cancelada" : n.situacao },
    { titulo: "Arquivos" },
  ], "Emissão fiscal", () => setPagina(1), n => n.numero);
  const paginas = Math.max(1, Math.ceil(lista.length / 15)), atual = Math.min(pagina, paginas);
  const link = (n: Nota, formato: string) => formato === "pdf" && !n.pdf && n.emailPdf ? `/api/admin/emails?empresa=${empresa}&id=${encodeURIComponent(n.emailPdf)}&anexo=nota` : `/api/admin/nfse?empresa=${empresa}&historico=1&numero=${encodeURIComponent(n.numero)}&arquivo=${formato}`;
  return <section className="space-y-5">
    <header className="rounded-2xl bg-[#071b30] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Arquivo fiscal · {empresa.toUpperCase()}</p><h2 className="mt-3 text-2xl font-bold">Notas emitidas e seus arquivos</h2><p className="mt-3 text-sm text-slate-300">Histórico importado e notas registradas nas cobranças, reunidos sem duplicar o número na mesma empresa. Baixar não emite, cancela ou envia nada.</p></header>
    <p className="rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">Data e situação fiscal vêm do histórico da Prefeitura. Nas notas disponíveis apenas na cobrança, não presumimos data de emissão nem situação fiscal atual. Competência e data do e-mail não substituem a emissão fiscal. XML disponível quando importado; notas canceladas permanecem no histórico.</p>
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-3">{[["Data inicial", inicio, setInicio], ["Data final", fim, setFim]].map(([nome, valor, alterar]) => <label key={String(nome)} className="text-xs font-semibold text-slate-600">{String(nome)}<input type="date" className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" value={String(valor)} onChange={e => { (alterar as typeof setInicio)(e.target.value); setPagina(1); }}/></label>)}<label className="text-xs font-semibold text-slate-600">Cliente, documento ou nota<input className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" value={busca} onChange={e => {setBusca(e.target.value);setPagina(1);}}/></label></div>
    <label className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700"><input type="checkbox" checked={semData} onChange={e => {setSemData(e.target.checked);setPagina(1);}}/>Incluir notas sem data fiscal informada, mesmo com período selecionado</label>
    <p className="text-xs text-slate-500">Busque por razão social, TFSeven, contato ou número da nota. {inicio && fim && inicio > fim ? "A data inicial deve ser anterior ou igual à final." : ""}</p>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{carregando ? "Consultando notas e anexos…" : `${lista.length} de ${visiveis.length} notas · histórico + sistema`}</p><div className="flex flex-wrap gap-3"><button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700" onClick={() => {setBusca("");setInicio("");setFim("");setSemData(true);setPagina(1);}}>Limpar filtros</button><button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50" disabled={carregando} onClick={() => setCarga(v=>v+1)}>Atualizar notas e arquivos</button></div></div>
    <p className="text-xs text-slate-500">Clique nos títulos para ordenar. Como notas não têm vencimento, o padrão é emissão decrescente. <button type="button" className="font-semibold text-blue-700" onClick={restaurar}>Restaurar ordem padrão</button></p>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{cabecalhos}</tr></thead><tbody>{!carregando && lista.slice((atual-1)*15,atual*15).map(n=><tr key={n.numero} className="border-t border-slate-100 align-top"><td className="p-4 font-semibold">{n.numero}</td><td className="max-w-[320px] p-4"><p className="font-semibold text-slate-900">{n.cliente}</p><p className="mt-1 text-xs text-slate-500">{n.documento}</p><p className="mt-1 text-xs text-blue-700">{n.origem === "ambos" ? "Histórico + sistema" : n.origem === "sistema" ? "Sistema · cobrança" : "Histórico importado"}</p></td><td className="whitespace-nowrap p-4">{n.emissao ? dataBr(n.emissao.slice(0,10)) : "Não informada"}</td><td className="whitespace-nowrap p-4 font-semibold">{moeda(n.centavos)}</td><td className="p-4">{n.situacao === "C" ? "Cancelada" : n.situacao === "N" ? "Emitida" : n.situacao || "Não informada"}</td><td className="whitespace-nowrap p-4">{n.xml && <a className="mr-4 font-semibold text-blue-700 hover:underline" href={link(n,"xml")}>Baixar XML</a>}{n.pdf || n.emailPdf ? <a target="_blank" rel="noreferrer" className="font-semibold text-blue-700 hover:underline" href={link(n,"pdf")}>Abrir PDF</a> : <span className="text-xs text-slate-400">PDF não disponível</span>}</td></tr>)}</tbody></table>{!carregando && !lista.length && <p className="p-8 text-center text-sm text-slate-500">{erro ? "Consulta incompleta; tente atualizar." : "Nenhuma nota neste filtro. Tente o número ou limpe os filtros."}</p>}</div>
    <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Página {atual} de {paginas}</span><div className="flex gap-3"><button disabled={atual===1} className="rounded-xl border border-slate-200 bg-white px-4 py-2 disabled:opacity-40" onClick={()=>setPagina(atual-1)}>Anterior</button><button disabled={atual===paginas} className="rounded-xl border border-slate-200 bg-white px-4 py-2 disabled:opacity-40" onClick={()=>setPagina(atual+1)}>Próxima</button></div></div>
    <MensagemAdmin mensagem={erro} titulo="Consulta de notas incompleta" subtitulo="As fontes disponíveis continuam visíveis" tom="erro" observacao="Atualizar consulta os registros salvos. Nenhuma nota é emitida ou cancelada." aoFechar={()=>setErro("")} acao={()=>{setErro("");setCarga(v=>v+1);}}/>
  </section>;
}
