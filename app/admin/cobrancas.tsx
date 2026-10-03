"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { dataBr, hojeBrasil, moeda, pago, situacao, type Cobranca, type Empresa, type Plano } from "@/lib/cobrancas";

type Cliente = { id: string; nome: string; email: string; origem?: string };
type Dados = { planos: Plano[]; cobrancas: Cobranca[]; hoje: string };
const input = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950";
const button = "rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait";
const secondary = "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const label = "block text-sm font-semibold text-slate-700";
function cents(v: FormDataEntryValue | null) { return Math.round(Number(String(v).replace(",", ".")) * 100); }
function primeiroEvento(c: Cobranca, tipo: string) { return c.eventos.find(e => e.tipo === tipo); }

export function Cobrancas({ empresa, clientes }: { empresa: Empresa; clientes: Cliente[] }) {
  const [mes, setMes] = useState(() => hojeBrasil().slice(0, 7));
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("mes");
  const [clienteId, setClienteId] = useState("");
  const tentativa = useRef<{ conteudo: string; id: string } | null>(null);
  const carregar = useCallback(async () => {
    setLoading(true); setErro("");
    try {
      const res = await fetch(`/api/admin/cobrancas?empresa=${empresa}&mes=${mes}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Não foi possível carregar as cobranças.");
      setDados(json);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha na consulta."); }
    finally { setLoading(false); }
  }, [empresa, mes]);
  useEffect(() => {
    const id = requestAnimationFrame(() => void carregar());
    const timer = setInterval(() => void carregar(), 60000);
    return () => { cancelAnimationFrame(id); clearInterval(timer); };
  }, [carregar]);

  async function salvar(body: Record<string, unknown>) {
    setOcupado(true); setErro(""); setAviso("");
    const conteudo = JSON.stringify(body);
    if (tentativa.current?.conteudo !== conteudo) tentativa.current = { conteudo, id: crypto.randomUUID() };
    try {
      const res = await fetch(`/api/admin/cobrancas?empresa=${empresa}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, operacaoId: tentativa.current.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Não foi possível salvar.");
      tentativa.current = null;
      setAviso("Registro salvo no histórico da empresa."); setNovo(false);
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setOcupado(false); }
  }
  function criarPlano(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void salvar({ acao: "plano", clienteId: f.get("clienteId"), email: f.get("email"), descricao: f.get("descricao"),
      centavos: cents(f.get("valor")), inicio: f.get("inicio"), fim: f.get("fim"), diaEnvio: Number(f.get("diaEnvio")),
      mesEnvio: Number(f.get("mesEnvio")), diaVencimento: Number(f.get("diaVencimento")), mesVencimento: Number(f.get("mesVencimento")) });
  }
  const hoje = dados?.hoje || hojeBrasil();
  const todas = dados?.cobrancas || [];
  const atrasadas = todas.filter(c => situacao(c, hoje) === "Atrasado");
  const enviar = todas.filter(c => c.envioPrevisto <= hoje && pago(c) < c.centavos && !primeiroEvento(c, "envio"));
  const confirmar = todas.filter(c => primeiroEvento(c, "envio") && !primeiroEvento(c, "recebimento") && pago(c) < c.centavos);
  const visiveis = filtro === "atraso" ? atrasadas : filtro === "envio" ? enviar : filtro === "recebimento" ? confirmar : todas.filter(c => c.competencia === mes);
  const selecionado = todas.find(c => c.id === selecionada);
  const remotos = clientes.filter(c => c.origem === "inter-cobrancas" || c.origem === "azure");
  const planos = dados?.planos || [];

  return <div className="space-y-5">
    <section className="rounded-3xl bg-[#071b30] p-6 text-white sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Cobranças mensais · {empresa.toUpperCase()}</p>
          <h2 className="mt-2 text-2xl font-black">Cada mensalidade, do preparo ao pagamento</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Acompanhe os prazos e mantenha o histórico de envio, confirmação e pagamento por competência.</p></div>
        <button className={button} onClick={() => setNovo(!novo)}>{novo ? "Fechar cadastro" : "Cadastrar mensalidade"}</button>
      </div>
    </section>
    <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Controle manual com alertas neste painel. Registrar envio não envia e-mail; registrar pagamento não consulta o banco. Confirmações automáticas e anexos ainda não estão conectados.</p>
    {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{erro} <button className="underline" onClick={() => void carregar()}>Tentar carregar novamente</button></p>}
    {aviso && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{aviso}</p>}
    {novo && <form onSubmit={criarPlano} className="rounded-3xl border border-slate-200 bg-white p-6">
      <h3 className="text-xl font-black">Configurar recorrência mensal</h3>
      <p className="mt-2 text-sm text-slate-600">Uma mensalidade consolidada por cliente. Cada competência terá seu próprio controle. O valor e os prazos devem ser conferidos no contrato.</p>
      {remotos.length === 0 && <p className="mt-3 text-amber-800">Carregue os clientes sincronizados para cadastrar a mensalidade desta empresa.</p>}
      <fieldset disabled={ocupado || loading} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={label}>Cliente<select required name="clienteId" className={input} value={clienteId} onChange={e => setClienteId(e.target.value)}><option value="">Selecione</option>{remotos.filter(c => !planos.some(p => p.clienteId === c.id)).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label className={label}>E-mail para cobrança<input key={clienteId} name="email" type="email" required maxLength={254} defaultValue={clientes.find(c => c.id === clienteId)?.email || ""} className={input}/></label>
        <label className={label}>Mensalidade (R$)<input name="valor" type="number" min="0.01" max="100000000" step="0.01" required className={input}/></label>
        <label className={`${label} sm:col-span-2 lg:col-span-3`}>Descrição do serviço<input name="descricao" required maxLength={500} defaultValue="Suporte e locação do sistema SISBlink" className={input}/></label>
        <label className={label}>Primeira competência<input name="inicio" type="month" required defaultValue={mes} className={input}/></label>
        <label className={label}>Última competência (opcional)<input name="fim" type="month" className={input}/></label>
        <p className="self-center text-sm text-slate-500">Em meses curtos, dias 29, 30 ou 31 são ajustados para o último dia do mês.</p>
        <label className={label}>Dia previsto para envio<input name="diaEnvio" type="number" min="1" max="31" required defaultValue="1" className={input}/></label>
        <label className={label}>Mês do envio<select name="mesEnvio" className={input} defaultValue="1">{[0, 1, 2, 3].map(n => <option key={n} value={n}>{n === 0 ? "Na competência" : `${n} mês(es) após a competência`}</option>)}</select></label>
        <span/>
        <label className={label}>Dia do vencimento<input name="diaVencimento" type="number" min="1" max="31" required defaultValue="10" className={input}/></label>
        <label className={label}>Mês do vencimento<select name="mesVencimento" className={input} defaultValue="1">{[0, 1, 2, 3].map(n => <option key={n} value={n}>{n === 0 ? "Na competência" : `${n} mês(es) após a competência`}</option>)}</select></label>
        <button className={`${button} self-end`} disabled={!remotos.length}>{ocupado ? "Salvando..." : "Salvar mensalidade"}</button>
      </fieldset>
    </form>}
    <div className="grid gap-3 sm:grid-cols-3">
      {[{ titulo: "Pendentes de envio", lista: enviar, tipo: "envio", texto: "Prazo de envio já chegou" }, { titulo: "Atrasadas", lista: atrasadas, tipo: "atraso", texto: moeda(atrasadas.reduce((s,c) => s + c.centavos - pago(c), 0)) + " em aberto" }, { titulo: "Sem confirmação", lista: confirmar, tipo: "recebimento", texto: "Recebimento ainda não registrado" }].map(card => <button key={card.tipo} onClick={() => setFiltro(card.tipo)} className={`rounded-2xl border p-5 text-left ${filtro === card.tipo ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}><span className="text-sm font-semibold text-slate-600">{card.titulo}</span><strong className="mt-2 block text-3xl text-slate-950">{loading && !dados ? "…" : card.lista.length}</strong><span className="mt-2 block text-xs text-slate-500">{card.texto} · todas as competências</span></button>)}
    </div>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-xl font-black">Agenda de cobranças</h3><p className="mt-1 text-sm text-slate-500">{planos.length} mensalidade(s) cadastrada(s) · alertas atualizados a cada minuto enquanto o painel está aberto.</p></div>
        <div className="flex flex-wrap items-end gap-2"><label className={label}>Competência<input type="month" className={input} value={mes} onChange={e => { if (e.target.value) { setMes(e.target.value); setFiltro("mes"); } }}/></label><button className={secondary} onClick={() => setFiltro("mes")}>Ver mês</button><button className={secondary} disabled={loading} onClick={() => void carregar()}>{loading ? "Carregando..." : "Atualizar"}</button></div>
      </div>
      {visiveis.length === 0 ? <p className="my-8 rounded-xl bg-slate-50 p-6 text-center text-slate-600">{loading ? "Carregando cobranças..." : planos.length ? "Nenhuma cobrança neste filtro." : "Cadastre a primeira mensalidade para gerar a agenda por competência."}</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr>{["Cliente / competência", "Envio previsto / realizado", "Vencimento", "Saldo", "Situação", ""].map((h,i) => <th key={i} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{visiveis.map(c => <tr key={c.id} className="border-b border-slate-100"><td className="px-3 py-4"><strong>{c.clienteNome}</strong><p className="mt-1 text-slate-500">{c.competencia.split("-").reverse().join("/")}</p></td><td className="px-3 py-4">{dataBr(c.envioPrevisto)}<p className="mt-1 text-xs text-slate-500">{primeiroEvento(c, "envio") ? `Enviado: ${dataBr(primeiroEvento(c, "envio")!.data)}` : "Envio não registrado"}</p></td><td className="px-3 py-4">{dataBr(c.vencimento)}</td><td className="px-3 py-4 font-bold">{moeda(c.centavos - pago(c))}<p className="mt-1 text-xs font-normal text-slate-500">Total: {moeda(c.centavos)}</p></td><td className="px-3 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${situacao(c,hoje) === "Atrasado" ? "bg-red-50 text-red-700" : situacao(c,hoje) === "Pago" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{situacao(c,hoje)}</span></td><td className="px-3 py-4"><button className={secondary} onClick={() => { setSelecionada(c.id); setAviso(""); }}>Acompanhar</button></td></tr>)}</tbody></table></div>}
    </section>
    {selecionado && <Detalhe key={selecionado.id} c={selecionado} ocupado={ocupado || loading} hoje={hoje} salvar={salvar} fechar={() => setSelecionada(null)}/>}
  </div>;
}

function Detalhe({ c, ocupado, hoje, salvar, fechar }: { c: Cobranca; ocupado: boolean; hoje: string; salvar: (body: Record<string, unknown>) => Promise<void>; fechar: () => void }) {
  const [acao, setAcao] = useState("documentos");
  const [copiado, setCopiado] = useState("");
  const texto = `Olá,\n\nSegue o demonstrativo de cobrança referente a ${c.descricao}.\nCompetência: ${c.competencia.split("-").reverse().join("/")}\nValor: ${moeda(c.centavos)}\nVencimento: ${dataBr(c.vencimento)}\n\nFavor confirmar o recebimento.\n\nFinanceiro`;
  async function copiar() { try { await navigator.clipboard.writeText(texto); setCopiado("Texto copiado. Confira e anexe a nota e o boleto antes de enviar."); } catch { setCopiado("Selecione e copie o texto abaixo."); } }
  function registrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void salvar({ id: c.id, acao, data: f.get("data"), nota: f.get("nota"), boleto: f.get("boleto"), demonstrativo: f.get("demonstrativo") === "on", detalhe: f.get("detalhe"), centavos: cents(f.get("valor")), referencia: f.get("referencia") });
  }
  const pagamentos = c.eventos.filter(e => e.tipo === "pagamento" && !c.eventos.some(x => x.tipo === "estorno" && x.referencia === e.id));
  return <section className="rounded-3xl border-2 border-blue-200 bg-white p-6">
    <div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase text-blue-700">Acompanhamento · {c.competencia}</p><h3 className="mt-2 text-xl font-black">{c.clienteNome}</h3><p className="mt-2 text-sm text-slate-600">{c.email} · saldo {moeda(c.centavos - pago(c))}</p></div><button onClick={fechar} className={`${secondary} self-start`}>Fechar</button></div>
    <div className="mt-5 grid gap-6 lg:grid-cols-2">
      <div><h4 className="font-bold">Registrar uma etapa</h4><p className="mt-1 text-xs leading-5 text-slate-500">Os registros são manuais e ficam com data e responsável. Use as datas reais dos documentos e comprovantes.</p>
        <form onSubmit={registrar} className="mt-4"><fieldset disabled={ocupado} className="space-y-4">
          <label className={label}>Etapa<select className={input} value={acao} onChange={e => setAcao(e.target.value)}><option value="documentos">Conferir documentos preparados</option><option value="envio">Registrar envio realizado</option><option value="recebimento">Confirmar recebimento pelo cliente</option><option value="pagamento">Registrar pagamento manual</option><option value="estorno">Corrigir pagamento registrado</option></select></label>
          <label className={label}>Data real<input type="date" name="data" required max={hoje} defaultValue={hoje} className={input}/></label>
          {acao === "documentos" ? <div key={`${c.nota}-${c.boleto}`} className="space-y-3"><label className={label}>Número da NFS-e<input className={input} name="nota" maxLength={120} required defaultValue={c.nota}/></label><label className={label}>Identificação do boleto / nosso número<input className={input} name="boleto" maxLength={120} required defaultValue={c.boleto}/></label><label className="flex gap-2 text-sm"><input name="demonstrativo" type="checkbox" required defaultChecked={c.demonstrativo}/>Demonstrativo, nota e boleto conferidos para esta competência</label><p className="text-xs text-slate-500">São referências de documentos já emitidos. Os arquivos ainda não são armazenados neste módulo.</p></div> : <>
            {acao === "pagamento" && <label className={label}>Valor recebido (R$)<input name="valor" type="number" step="0.01" min="0.01" max={(c.centavos - pago(c))/100} required className={input}/></label>}
            {acao === "estorno" && <label className={label}>Registro a corrigir<select name="referencia" required className={input}><option value="">Selecione</option>{pagamentos.map(e => <option key={e.id} value={e.id}>{dataBr(e.data)} · {moeda(e.centavos || 0)}</option>)}</select></label>}
            <label className={label}>{acao === "envio" ? "Destinatário, canal e referência do envio" : acao === "recebimento" ? "Quem confirmou e por qual canal" : "Comprovante ou motivo do registro"}<textarea name="detalhe" required maxLength={500} className={input} rows={3}/></label>
          </>}
          <button className={button}>{ocupado ? "Salvando..." : "Salvar registro manual"}</button>
        </fieldset></form>
      </div>
      <div><h4 className="font-bold">Demonstrativo para revisão</h4><textarea aria-label="Texto do demonstrativo" className={`${input} font-mono text-xs`} readOnly rows={12} value={texto}/><button className={`${secondary} mt-2`} onClick={() => void copiar()}>Copiar texto</button>{copiado && <p role="status" className="mt-2 text-sm text-blue-700">{copiado}</p>}
        <h4 className="mt-6 font-bold">Histórico</h4>{c.eventos.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nenhum evento registrado. A cobrança está prevista pela recorrência.</p> : <ol className="mt-3 space-y-3">{[...c.eventos].reverse().map(e => <li key={e.id} className="rounded-xl border border-slate-200 p-3 text-sm"><p className="font-bold">{dataBr(e.data)} · {e.tipo}{e.centavos ? ` · ${moeda(e.centavos)}` : ""}</p><p className="mt-1 break-words text-slate-600">{e.detalhe}</p><p className="mt-2 text-xs text-slate-500">Registrado por {e.responsavel} em {new Date(e.registradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></li>)}</ol>}
      </div>
    </div>
  </section>;
}
