"use client";
import { useEffect, useState } from "react";
import type { Cobranca, Empresa } from "@/lib/cobrancas";
import { nomesAnexos, type EmailCobranca } from "@/lib/emails-cobranca";
import { lerRespostaAdmin } from "@/lib/admin-resposta";
import { emailsDaCobranca, notasDaCobranca } from "@/lib/arquivos-acompanhamento";

const botao = "inline-flex rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600";
type Nota = { numero: string; pdf: boolean; xml: boolean };
type Estado = { chave: string; emails: EmailCobranca[]; notas: Nota[]; erros: string[] };

export function ArquivosAcompanhamento({ empresa, c }: { empresa: Empresa; c: Cobranca }) {
  const [carga, setCarga] = useState(0), [estado, setEstado] = useState<Estado | null>(null);
  const chave = `${empresa}:${c.id}:${c.nota}:${carga}`;
  useEffect(() => {
    const controller = new AbortController();
    async function consultar<T>(url: string): Promise<T> {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) });
      const d = await lerRespostaAdmin<T & { erro?: string }>(r);
      if (!r.ok) throw new Error(d.erro || "Consulta indisponível.");
      return d;
    }
    void Promise.allSettled([
      consultar<{ emails: EmailCobranca[] }>(`/api/admin/emails?empresa=${empresa}`),
      c.nota ? consultar<{ notas: Nota[] }>(`/api/admin/nfse?empresa=${empresa}&historico=1`) : Promise.resolve({ notas: [] as Nota[] }),
    ]).then(([emails, fiscal]) => {
      if (controller.signal.aborted) return;
      setEstado({ chave,
        emails: emails.status === "fulfilled" ? emailsDaCobranca(emails.value.emails, empresa, c.id) : [],
        notas: fiscal.status === "fulfilled" ? notasDaCobranca(fiscal.value.notas, c.nota) : [],
        erros: [emails.status === "rejected" ? "Não foi possível consultar os anexos da cobrança." : "", fiscal.status === "rejected" ? "Não foi possível consultar o arquivo fiscal." : ""].filter(Boolean),
      });
    });
    return () => controller.abort();
  }, [empresa, c.id, c.nota, chave]);
  const atual = estado?.chave === chave ? estado : null;
  const anexos = atual?.emails.flatMap(e => e.anexos.map(a => ({ ...a, emailId: e.id }))) || [];
  const nota = atual?.notas.length === 1 ? atual.notas[0] : undefined;
  return <section aria-labelledby="arquivos-cobranca-titulo" aria-busy={!atual} className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
    <h4 id="arquivos-cobranca-titulo" className="text-lg font-black">Documentos da cobrança</h4>
    <p className="mt-2 text-sm leading-6 text-slate-600">Abra a cópia para salvar ou compartilhar com o cliente. Consultar e baixar não emite documentos, não altera o pagamento e não reenvia e-mail.</p>
    {!atual ? <p className="mt-4 text-sm" role="status">Consultando documentos vinculados…</p> : <>
      {anexos.map(a => <div key={`${a.emailId}-${a.tipo}`} className="mt-3 rounded-xl border border-blue-100 bg-white p-4"><p className="font-bold">{nomesAnexos[a.tipo]}</p><p className="mt-1 break-words text-xs text-slate-500">{a.nome} · anexo salvo na cobrança</p><a target="_blank" rel="noreferrer" className={`${botao} mt-3`} href={`/api/admin/emails?empresa=${empresa}&id=${encodeURIComponent(a.emailId)}&anexo=${a.tipo}`}>Abrir PDF — {nomesAnexos[a.tipo]}</a></div>)}
      {nota && <div className="mt-3 rounded-xl border border-blue-100 bg-white p-4"><p className="font-bold">NFS-e {nota.numero} · arquivo fiscal</p><div className="mt-3 flex flex-wrap gap-3">{nota.pdf && <a target="_blank" rel="noreferrer" className={botao} href={`/api/admin/nfse?empresa=${empresa}&historico=1&numero=${encodeURIComponent(nota.numero)}&arquivo=pdf`}>Abrir PDF da nota fiscal</a>}{nota.xml && <a className={botao} href={`/api/admin/nfse?empresa=${empresa}&historico=1&numero=${encodeURIComponent(nota.numero)}&arquivo=xml`}>Baixar XML da nota fiscal</a>}</div></div>}
      {!anexos.some(a => a.tipo === "nota") && !nota?.pdf && <p className="mt-4 text-sm text-slate-600">{c.nota ? `Nota ${c.nota} registrada, mas sem PDF disponível nesta consulta.` : "Nenhuma nota fiscal vinculada a esta cobrança."} Confira também a seção Notas antigas e XML.</p>}
      {!anexos.some(a => a.tipo === "boleto") && <p className="mt-3 text-sm text-slate-600">{c.boleto ? `Boleto ${c.boleto}: PDF não localizado entre os anexos. Consulte o Histórico do Inter para recuperar a cópia, sem reemitir.` : "Sem boleto registrado. Cobranças pagas via PIX não precisam de boleto."}</p>}
      {atual.erros.length > 0 && <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{atual.erros.join(" ")} Isso não significa que os documentos foram apagados. Tente atualizar a consulta.</div>}
    </>}
    <button type="button" disabled={!atual} onClick={() => setCarga(v => v + 1)} className={`${botao} mt-4 disabled:opacity-50`}>Atualizar documentos</button>
  </section>;
}
