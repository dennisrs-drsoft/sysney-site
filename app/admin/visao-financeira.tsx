"use client";

import { useEffect, useState } from "react";
import { hojeBrasil, dataBr, moeda, type Cobranca, type Plano } from "@/lib/cobrancas";
import { lerRespostaAdmin } from "@/lib/admin-resposta";
import { consolidarFinanceiro, filtrarFinanceiro, resumoFinanceiro, nomesEstados, type EmailFinanceiro, type EstadoFinanceiro, type RegistroInter, type NotaFinanceira, type FiltroFinanceiro } from "@/lib/visao-financeira";
import { MensagemAdmin } from "./dialogos-admin";
import { RelatoriosFinanceiros } from "./relatorios-financeiros";
import { FaturamentoFiscal } from "./faturamento-fiscal";

type Destino = "cobrancas" | "acompanhamento" | "historico-inter" | "historico-fiscal";
type Dados = { cobrancas: Cobranca[]; planos: Plano[]; banco: RegistroInter[]; emails: EmailFinanceiro[]; notas: NotaFinanceira[] };
const campo = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
const botao = "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50";
const painel = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
const tons: Record<EstadoFinanceiro, string> = { previsto: "bg-slate-100 text-slate-600", aberto: "bg-blue-50 text-blue-700", atrasado: "bg-red-50 text-red-700", parcial: "bg-amber-50 text-amber-800", pago: "bg-emerald-50 text-emerald-700", cancelado: "bg-slate-100 text-slate-500", expirado: "bg-slate-100 text-slate-500", conferir: "bg-amber-50 text-amber-800" };

export function VisaoFinanceira({ empresa, navegar }: { empresa: "sysney" | "drsoft"; navegar: (destino: Destino) => void }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [carga, setCarga] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [erroPeriodo, setErroPeriodo] = useState("");
  const [ajuda, setAjuda] = useState(false);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [por, setPor] = useState<FiltroFinanceiro["por"]>("vencimento");
  const [aba, setAba] = useState<"carteira" | "analises" | "fiscal">("carteira");
  const [estado, setEstado] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const hoje = hojeBrasil();
  // Inclui previsão do próximo mês sem alterar ou emitir nenhuma cobrança.
  const horizonte = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 1)).toISOString().slice(0, 7);
  const mesFinal = fim.slice(0, 7);
  const ate = mesFinal > horizonte ? mesFinal : horizonte;
  useEffect(() => {
    const controller = new AbortController();
    async function ler<T>(url: string): Promise<T> {
      const resposta = await fetch(url, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) });
      const resultado = await lerRespostaAdmin<T & { erro?: string }>(resposta);
      if (!resposta.ok) throw new Error(resultado.erro || "Não foi possível carregar a visão financeira.");
      return resultado;
    }
    async function carregar() {
      setCarregando(true);
      try {
        const [carteira, historico, mensagens, fiscal] = await Promise.all([
          ler<{ cobrancas: Cobranca[]; planos: Plano[] }>(`/api/admin/cobrancas?empresa=${empresa}&mes=${ate}`),
          ler<{ cobrancas: RegistroInter[] }>(`/api/admin/historico-inter?empresa=${empresa}`),
          ler<{ emails: EmailFinanceiro[] }>(`/api/admin/emails?empresa=${empresa}&resumo=financeiro`),
          ler<{ notas: NotaFinanceira[] }>(`/api/admin/nfse?empresa=${empresa}&historico=1`),
        ]);
        if (!controller.signal.aborted) { setDados({ ...carteira, banco: historico.cobrancas, emails: mensagens.emails, notas: fiscal.notas }); setErro(""); }
      } catch (e) {
        if (!controller.signal.aborted) { setDados(null); setErro(e instanceof Error && e.name === "TimeoutError" ? "A consulta demorou mais que o esperado. Atualize o painel para tentar novamente." : e instanceof Error ? e.message : "Não foi possível carregar os dados."); }
      } finally { if (!controller.signal.aborted) setCarregando(false); }
    }
    void carregar();
    return () => controller.abort();
  }, [empresa, ate, carga]);

  const linhas = dados ? consolidarFinanceiro(dados.cobrancas, dados.planos, dados.banco, dados.emails, hoje, dados.notas) : [];
  const filtro = { inicio, fim, por, estado, busca };
  const filtradas = filtrarFinanceiro(linhas, filtro);
  const resumo = resumoFinanceiro(filtradas, hoje);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / 12));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * 12, paginaAtual * 12);
  const consultas = dados?.banco.map(b => b.consultadoEm).filter(Boolean).sort() || [];
  const ultimaConsulta = consultas.at(-1);
  const primeiraConsulta = consultas[0];
  const dataConsulta = (v: string) => Number.isFinite(Date.parse(v)) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(v)) : "não informada";
  const pendencias = carregando ? [] : filtradas.filter(r => r.origem !== "inter" && !r.envio && ["previsto", "aberto", "atrasado", "parcial"].includes(r.estado));
  const proximas = carregando ? [] : filtradas.filter(r => ["aberto", "atrasado", "parcial"].includes(r.estado) && r.vencimento >= hoje).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 4);
  function limpar() { setInicio(""); setFim(""); setEstado(""); setBusca(""); setPor("vencimento"); setPagina(1); }
  function periodoRapido(tipo: "mes" | "ano" | "completo" | "todos") {
    setPagina(1);
    if(tipo === "todos"){setInicio("");setFim("");return;}
    setInicio(tipo === "mes" ? `${hoje.slice(0, 7)}-01` : `${hoje.slice(0, 4)}-01-01`);
    setFim(tipo === "mes" ? new Date(Date.UTC(Number(hoje.slice(0,4)),Number(hoje.slice(5,7)),0)).toISOString().slice(0,10) : tipo === "completo" ? `${hoje.slice(0,4)}-12-31` : hoje);
  }

  return <div className="space-y-5">
    <section className="rounded-2xl bg-[#071b30] p-6 text-white sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Visão financeira · {empresa.toUpperCase()}</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Sua carteira, com clareza.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Acompanhe o que foi emitido, o que está previsto e os pagamentos registrados. Cada empresa mantém sua própria carteira.</p></div>
        <button className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10" onClick={() => setAjuda(true)}>Como ler este painel</button>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => navegar("cobrancas")}>Abrir fila de cobranças →</button>
        <button className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/15" onClick={() => navegar("acompanhamento")}>Gerenciar recorrências</button>
        <button className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/15" onClick={() => navegar("historico-fiscal")}>Notas antigas / XML</button>
      </div>
    </section>

    <section className={painel} aria-label="Filtros financeiros">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 text-xs font-semibold text-slate-600"><span>Data de referência</span><select className={campo} value={por} onChange={e => { setPor(e.target.value as typeof por); setPagina(1); }}><option value="vencimento">Vencimento</option><option value="competencia">Competência do serviço</option><option value="emissao">Emissão do boleto / registro de documentos</option><option value="pagamento">Baixa / pagamento registrado</option></select></label>
        <label className="space-y-2 text-xs font-semibold text-slate-600"><span>Data inicial</span><input type="date" className={campo} value={inicio} onChange={e => { setInicio(e.target.value); setPagina(1); }} onBlur={() => {if(inicio && fim && inicio > fim)setErroPeriodo("A data inicial deve ser igual ou anterior à data final. Ajuste o período para consultar e comparar.");}} /></label>
        <label className="space-y-2 text-xs font-semibold text-slate-600"><span>Data final (incluída)</span><input type="date" className={campo} value={fim} onChange={e => { setFim(e.target.value); setPagina(1); }} onBlur={() => {if(inicio && fim && inicio > fim)setErroPeriodo("A data inicial deve ser igual ou anterior à data final. Ajuste o período para consultar e comparar.");}} /></label>
        <label className="space-y-2 text-xs font-semibold text-slate-600"><span>Situação</span><select className={campo} value={estado} onChange={e => { setEstado(e.target.value); setPagina(1); }}><option value="">Todas as situações</option>{Object.entries(nomesEstados).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</select></label>
        <label className="space-y-2 text-xs font-semibold text-slate-600"><span>Cliente, documento, nota ou boleto</span><input className={campo} placeholder="Buscar na carteira…" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{[["mes","Este mês"],["ano","Ano até hoje"],["completo","Ano completo"],["todos","Todo o histórico"]].map(([tipo,nome])=><button key={tipo} className={botao} onClick={()=>periodoRapido(tipo as Parameters<typeof periodoRapido>[0])}>{nome}</button>)}</div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{inicio || fim ? `${inicio ? dataBr(inicio) : "Início do histórico"} a ${fim ? dataBr(fim) : "Fim do histórico salvo"}` : "Todo o histórico salvo"} · Previsões até {ate.split("-").reverse().join("/")} · Indicadores seguem os filtros.</p><div className="flex gap-2"><button className={botao} onClick={limpar}>Limpar filtros</button><button className={botao} disabled={carregando} onClick={() => setCarga(v => v + 1)}>{carregando ? "Carregando…" : "Atualizar painel"}</button></div></div>
      {por === "competencia" && <p className="mt-3 text-xs text-amber-800">O Inter não informa a competência do serviço. Registros exclusivamente bancários não aparecem neste filtro por período; use vencimento. A competência é mensal: todos os meses abrangidos pelo intervalo são incluídos.</p>}
      {por === "pagamento" && <p className="mt-3 text-xs text-amber-800">Este filtro exige uma data de quitação registrada. No Inter é a data da baixa, que pode diferir do dia em que o cliente pagou; parciais sem quitação completa não aparecem.</p>}
    </section>

    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
      {ultimaConsulta ? <>Inter: dados salvos entre {dataConsulta(primeiraConsulta!)} e {dataConsulta(ultimaConsulta)} (horário de Brasília). Situações bancárias podem ter mudado desde a consulta. </> : <>Nenhum histórico do Inter disponível nesta empresa. </>}
      Atualizar o painel relê a base; não consulta o banco nem emite documentos. Recebimentos usam o valor recebido informado pelo Inter quando disponível; na ausência dele, usam o nominal. O painel não substitui o extrato bancário.
    </div>
    {resumo.conferir > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{resumo.conferir} registro(s) precisam de conferência de vínculo ou situação e estão fora dos totais.</p><button className={botao} onClick={() => { setEstado("conferir"); setPagina(1); }}>Ver registros</button></div>}

    <div aria-busy={carregando} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["A receber", resumo.receber, "Saldo de cobranças emitidas em aberto", "text-blue-700"],
        ["Recebimentos registrados", resumo.recebido, "Pagamentos manuais + histórico bancário", "text-emerald-700"],
        ["Vencidas", resumo.vencido, "Parte do saldo a receber; não somar novamente", "text-red-700"],
        ["Cobranças previstas", resumo.previsto, "Projeções separadas; ainda não emitidas", "text-slate-900"],
      ].map(([titulo, valor, legenda, tom]) => <article key={titulo} className={painel}><p className="text-xs font-semibold text-slate-500">{titulo}</p><p className={`mt-3 text-2xl font-bold tracking-tight ${tom}`}>{carregando ? "…" : dados ? moeda(Number(valor)) : "—"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{legenda}</p></article>)}
    </div>

    <div role="group" aria-label="Visão do painel" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2"><button className={`${botao} ${aba==="carteira"?"bg-blue-50 ring-2 ring-blue-500/20":""}`} aria-pressed={aba==="carteira"} onClick={()=>setAba("carteira")}>Carteira e vencimentos</button><button className={`${botao} ${aba==="analises"?"bg-blue-50 ring-2 ring-blue-500/20":""}`} aria-pressed={aba==="analises"} onClick={()=>setAba("analises")}>Análises e comparativos</button><button className={`${botao} ${aba==="fiscal"?"bg-blue-50 ring-2 ring-blue-500/20":""}`} aria-pressed={aba==="fiscal"} onClick={()=>setAba("fiscal")}>Faturamento fiscal</button></div>
    {aba==="fiscal" && (dados && !carregando ? <FaturamentoFiscal notas={dados.notas} inicio={inicio} fim={fim} busca={busca} empresa={empresa}/> : <p className={painel}>{carregando?"Carregando notas fiscais…":"Notas indisponíveis. Atualize o painel."}</p>)}
    {aba==="analises" && (dados && !carregando ? <RelatoriosFinanceiros linhas={linhas} filtradas={filtradas} filtro={filtro} hoje={hoje} notas={dados.notas}/> : <p className={painel}>{carregando ? "Carregando análises…" : "Análises indisponíveis. Atualize o painel."}</p>)}
    {aba==="carteira" && <><div className="grid gap-5 xl:grid-cols-2">
      <section className={painel}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">Próximos vencimentos</h3><p className="mt-1 text-xs text-slate-500">Somente documentos emitidos · valores do filtro atual</p></div><span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">A receber</span></div>
        <div className="my-5 grid grid-cols-3 divide-x divide-slate-100">{[["Hoje", resumo.hoje], ["Até 7 dias", resumo.sete], ["Até 30 dias", resumo.trinta]].map(([nome, valor]) => <div key={nome} className="px-2 first:pl-0"><p className="text-xs text-slate-500">{nome}</p><p className="mt-2 text-sm font-bold text-slate-900">{dados && !carregando ? moeda(Number(valor)) : "—"}</p></div>)}</div>
        <p className="mb-3 text-xs text-slate-400">Janelas acumuladas; não somar entre si.</p>
        {proximas.map(r => <div key={r.id} className="flex items-center justify-between gap-3 border-t border-slate-100 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{r.cliente}</p><p className="mt-1 text-xs text-slate-500">{dataBr(r.vencimento)} · {r.origem === "inter" ? "Histórico Inter" : `NFS-e ${r.nota || "não registrada"}`}</p></div><span className="shrink-0 text-sm font-bold text-blue-800">{moeda(r.saldo)}</span></div>)}
        {!proximas.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{carregando ? "Consultando dados…" : !dados ? "Dados indisponíveis; tente atualizar." : "Nenhum vencimento futuro neste filtro."}</p>}
      </section>
      <section className={painel}><h3 className="font-bold text-slate-900">O que precisa da sua atenção</h3><p className="mt-1 text-xs text-slate-500">Revisão antes de emitir ou enviar · sem ações automáticas</p>
        <div className="my-5 flex items-center justify-between rounded-xl bg-blue-50 p-4"><div><p className="text-2xl font-bold text-blue-800">{dados && !carregando ? resumo.pendentes : "—"}</p><p className="mt-1 text-xs text-blue-800">Cobranças do sistema ainda sem envio aceito</p></div><button className={botao} onClick={() => navegar("cobrancas")}>Revisar fila</button></div>
        {pendencias.slice(0, 4).map(r => <div key={r.id} className="border-t border-slate-100 py-3"><p className="text-sm font-semibold text-slate-800">{r.cliente}</p><p className="mt-1 text-xs text-slate-500">{r.competencia.split("-").reverse().join("/")} · {r.etapa}</p></div>)}
        {!pendencias.length && <p className="text-sm text-slate-500">{carregando ? "Consultando pendências…" : !dados ? "Não foi possível verificar as pendências." : "Nenhuma pendência de envio neste filtro."}</p>}
      </section>
    </div>

    <section className={`${painel} overflow-hidden`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">Carteira de cobranças</h3><p className="mt-1 text-xs text-slate-500">{filtradas.length} registro(s) · Sistema + histórico do Inter · Competência bancária não é presumida</p></div><button className={botao} onClick={() => navegar("historico-inter")}>Histórico do Inter</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Cliente / origem", "Competência", "Vencimento", "Documentos", "Valor / saldo", "Situação / envio"].map(v => <th key={v} className="px-3 py-3 font-semibold">{v}</th>)}</tr></thead><tbody>
        {!carregando && visiveis.map(r => <tr key={r.id} className="border-b border-slate-100 align-top last:border-0"><td className="max-w-[270px] px-3 py-4"><p className="font-semibold text-slate-900">{r.cliente}</p><p className="mt-1 text-xs text-slate-500">{r.origem === "inter" ? "Histórico Inter" : r.origem === "integrado" ? "Sistema + Inter · vínculo confirmado" : "Sistema"}</p>{r.consultadoEm && <p className="mt-1 text-xs text-slate-400">Banco consultado: {dataConsulta(r.consultadoEm)}</p>}</td><td className="px-3 py-4">{r.competencia ? r.competencia.split("-").reverse().join("/") : <span className="text-xs text-slate-400">Não informada pelo banco</span>}</td><td className="whitespace-nowrap px-3 py-4">{r.vencimento ? dataBr(r.vencimento) : "Não informado"}</td><td className="px-3 py-4 text-xs leading-5">{r.nota ? `NFS-e ${r.nota}` : "NFS-e não vinculada"}<br />{r.boleto ? `Boleto / referência ${r.boleto}` : "Sem boleto registrado"}</td><td className="whitespace-nowrap px-3 py-4"><p className="font-semibold">{moeda(r.centavos)}</p><p className="mt-1 text-xs text-slate-500">{r.estado === "conferir" ? "Fora dos totais" : r.estado === "previsto" ? "Ainda não emitida" : `Saldo: ${moeda(r.saldo)}`}</p></td><td className="max-w-[280px] px-3 py-4"><span className={`inline-block rounded-lg px-2 py-1 text-xs font-semibold ${tons[r.estado]}`}>{nomesEstados[r.estado]}</span><p className="mt-2 text-xs leading-5 text-slate-500">{r.etapa}</p><button className="mt-2 text-xs font-semibold text-blue-700 hover:underline" onClick={() => navegar(r.origem === "inter" ? "historico-inter" : "cobrancas")}>{r.origem === "inter" ? "Ver histórico →" : "Abrir fila →"}</button></td></tr>)}
        {(carregando || !visiveis.length) && <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-500">{carregando ? "Reunindo cobranças e pagamentos…" : !dados ? "Dados indisponíveis. Atualize o painel para tentar novamente." : "Nenhuma cobrança neste filtro. Experimente limpar os filtros."}</td></tr>}
      </tbody></table></div>
      <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Página {paginaAtual} de {totalPaginas}</p><div className="flex gap-2"><button className={botao} disabled={paginaAtual <= 1 || carregando} onClick={() => setPagina(paginaAtual - 1)}>Anterior</button><button className={botao} disabled={paginaAtual >= totalPaginas || carregando} onClick={() => setPagina(paginaAtual + 1)}>Próxima</button></div></div>
    </section></>}
    <MensagemAdmin mensagem={erro} titulo="Não foi possível atualizar o painel" subtitulo="Os indicadores não estão disponíveis nesta consulta" observacao="Nenhuma cobrança foi emitida, cancelada ou enviada. Verifique a conexão e tente atualizar novamente." tom="erro" aoFechar={() => setErro("")} acao={() => { setErro(""); setCarga(v => v + 1); }} />
    <MensagemAdmin mensagem={erroPeriodo} titulo="Confira o período selecionado" subtitulo="As datas estão em ordem inversa" observacao="Feche esta mensagem e ajuste a data inicial ou final. Nenhum dado financeiro foi alterado." tom="erro" aoFechar={() => setErroPeriodo("")} />
    <MensagemAdmin mensagem={ajuda ? "A receber reúne saldos de documentos emitidos; previsões ficam separadas. Recebimentos são os pagamentos registrados no sistema ou no histórico importado do Inter, não o saldo da conta bancária. Envio aceito pelo SendGrid não confirma entrega, leitura ou pagamento. Vencidas já fazem parte do valor a receber. Possíveis duplicidades e situações desconhecidas ficam fora dos totais até conferência." : ""} titulo="Entenda sua visão financeira" subtitulo="Fontes diferentes, informações identificadas" observacao="O Inter é um retrato da última consulta. O sistema só une registros pelo identificador bancário e dados compatíveis; nunca apenas pelo nome ou valor. A data de registro de documentos do sistema pode diferir da data fiscal de emissão." aoFechar={() => setAjuda(false)} />
  </div>;
}
