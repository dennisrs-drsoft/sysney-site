"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { hojeBrasil, moeda, dataBr, type Empresa } from "@/lib/cobrancas";
import { calcularOS, resumirOS, valorMonetarioOS, type OrdemServico, type EntradaOS, type RegrasOS, type LoteOS } from "@/lib/ordens-servico";
import { lerRespostaAdmin } from "@/lib/admin-resposta";
import { MensagemAdmin, useConfirmarAdmin } from "./dialogos-admin";
import { useOrdenacaoTabela } from "./ordenacao-tabela";
type Cliente = {
    id: string;
    nome: string;
    documento: string;
    email: string;
};
type Salva = OrdemServico & {
    versao: string;
};
type Dados = {
    ordens: Salva[];
    regras: {
        clienteId: string;
        regras: RegrasOS;
        versao: string;
    }[];
    lotes: LoteOS[];
};
const campo = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950";
const botao = "rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-blue-700 disabled:opacity-50";
const primario = "rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50";
function dinheiro(raw: FormDataEntryValue | null) { return valorMonetarioOS(String(raw||"")); }
function Dinheiro({ name, valor, obrigatorio = false }: {
    name: string;
    valor: number | null;
    obrigatorio?: boolean;
}) { const [v, setV] = useState(valor === null ? "" : (valor / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })); return <input className={campo} name={name} inputMode="decimal" required={obrigatorio} value={v} onChange={e => { if (/^[\d., ]*$/.test(e.target.value))
    setV(e.target.value); }} onBlur={() => { const n = dinheiro(v); if (n !== null && Number.isSafeInteger(n))
    setV((n / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }}/>; }
const entradaNova = (): EntradaOS => ({ data: hojeBrasil(), diaFim: hojeBrasil(), inicio: "08:00", fim: "09:00", intervaloMinutos: 0, tipo: "hora", quantidadeCentesimos: 100, valorFixoCentavos: 0, descricao: "" });
const estados = { aberta: "Em aberto", reservada: "Preparação em andamento", cobrada: "Vinculada à cobrança", historico: "Histórico já faturado", cancelada: "Cancelada" };
export function OrdensServicoPainel({ empresa, clientes, abrirFila }: {
    empresa: Empresa;
    clientes: Cliente[];
    abrirFila: () => void;
}) {
    const confirmar = useConfirmarAdmin(), [dados, setDados] = useState<Dados>({ ordens: [], regras: [], lotes: [] }), [loading, setLoading] = useState(true), [ocupado, setOcupado] = useState(false), [aviso, setAviso] = useState("");
    const [clienteId, setClienteId] = useState(""), [ids, setIds] = useState<string[]>([]), [editando, setEditando] = useState<Salva | null>(null), [entrada, setEntrada] = useState<EntradaOS>(entradaNova), [modelo, setModelo] = useState(false);
    const [busca, setBusca] = useState(""), [inicio, setInicio] = useState(""), [fim, setFim] = useState(""), [situacao, setSituacao] = useState("todas"), [pagina, setPagina] = useState(1);
    const tentativa = useRef<{
        json: string;
        op: string;
    } | null>(null);
    const cliente = clientes.find(c => c.id === clienteId), regra = dados.regras.find(r => r.clienteId === clienteId);
    const carregar = useCallback(async () => { setLoading(true); try {
        const r = await fetch(`/api/admin/ordens-servico?empresa=${empresa}`, { cache: "no-store", signal: AbortSignal.timeout(60000) });
        const d = await lerRespostaAdmin<Dados & {
            erro?: string;
        }>(r);
        if (!r.ok)
            throw Error(d.erro || "Consulta indisponível.");
        setDados(d);
    }
    catch (e) {
        setAviso(e instanceof Error ? e.message : "Não foi possível consultar as ordens.");
    }
    finally {
        setLoading(false);
    } }, [empresa]);
    useEffect(() => { const id = requestAnimationFrame(() => void carregar()); return () => cancelAnimationFrame(id); }, [carregar]);
    async function executar(body: Record<string, unknown>, mensagem: string) { setOcupado(true); const json = JSON.stringify(body); if (tentativa.current?.json !== json)
        tentativa.current = { json, op: crypto.randomUUID() }; try {
        const r = await fetch(`/api/admin/ordens-servico?empresa=${empresa}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, operacaoId: tentativa.current.op }), signal: AbortSignal.timeout(90000) });
        const d = await lerRespostaAdmin<{
            erro?: string;
        }>(r, true);
        if (!r.ok)
            throw Error(d.erro || "Operação não concluída.");
        tentativa.current = null;
        setAviso(mensagem);
        setIds([]);
        setEditando(null);
        setEntrada(entradaNova());
        setModelo(false);
        await carregar();
    }
    catch (e) {
        setAviso(`${e instanceof Error ? e.message : "Resultado não confirmado."} Atualize a lista antes de repetir. Para cobrança em preparação, use Retomar lote.`);
        await carregar();
    }
    finally {
        setOcupado(false);
    } }
    const filtradas = dados.ordens.filter(o => (!clienteId || o.clienteId === clienteId) && (!inicio || o.data >= inicio) && (!fim || o.data <= fim) && (situacao === "todas" || o.estado === situacao) && `${o.clienteNome} ${o.descricao} ${o.nota || ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
    const { ordenadas, cabecalhos } = useOrdenacaoTabela(filtradas, [{ titulo: "Selecionar" }, { titulo: "Data", valor: o => o.data + o.inicio }, { titulo: "Cliente / serviço", valor: o => o.clienteNome }, { titulo: "Tempo / tipo", valor: o => calcularOS(o, o.regras).minutos }, { titulo: "Serviços", valor: o => calcularOS(o, o.regras).centavos }, { titulo: "Situação", valor: o => estados[o.estado] }, { titulo: "Ações" }], "Data", () => setPagina(1), o => o.id);
    const paginas = Math.max(1, Math.ceil(ordenadas.length / 10)), atual = Math.min(pagina, paginas), selecionadas = dados.ordens.filter(o => ids.includes(o.id));
    let resumo: ReturnType<typeof resumirOS> | null = null, erroResumo = "";
    if (selecionadas.length)
        try {
            resumo = resumirOS(selecionadas);
        }
        catch (e) {
            erroResumo = e instanceof Error ? e.message : "Seleção inválida.";
        }
    async function salvarRegra(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); await executar({ acao: "regras", clienteId, regras: { horaCentavos: dinheiro(f.get("hora")), diariaCentavos: dinheiro(f.get("diaria")), minimoMinutos: Number(f.get("minimo")), arredondamentoMinutos: Number(f.get("incremento")), adicionalBps: Math.round(Number(String(f.get("adicional")).replace(",", ".")) * 100) }, versao: regra?.versao || "" }, "Regras salvas. Atendimentos existentes mantêm a regra original."); }
    async function salvarOrdem(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const nova = { ...entrada, quantidadeCentesimos: entrada.tipo === "diaria" ? Math.round(Number(String(f.get("diarias")).replace(",", "."))*100) : entrada.quantidadeCentesimos, valorFixoCentavos: dinheiro(f.get("fixo")) || 0 }; const id = editando?.id || crypto.randomUUID(); await executar({ acao: "salvar", id, clienteId, entrada: nova, versao: editando?.versao || "" }, "Atendimento salvo. Nenhuma cobrança ou nota foi emitida."); }
    async function cobrar(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!resumo)
        return; const f = new FormData(e.currentTarget); if (!await confirmar({ titulo: "Preparar cobrança dos serviços?", subtitulo: "Criar cobrança e relatório para revisão", descricao: "Os atendimentos serão reservados para impedir cobrança em duplicidade. O relatório será anexado a um rascunho. Nota e boleto exigirão aprovação separada; nenhum e-mail será enviado.", confirmar: "Preparar cobrança", detalhes: [{ rotulo: "Atendimentos", valor: String(ids.length) }, { rotulo: "Total", valor: moeda(resumo.total) }, { rotulo: "Competência", valor: String(f.get("competencia")) }, { rotulo: "Vencimento", valor: String(f.get("vencimento")) }] }))
        return; await executar({ acao: "cobrar", itens: selecionadas.map(o => ({ id: o.id, versao: o.versao })), competencia: f.get("competencia"), vencimento: f.get("vencimento"), email: f.get("email"), formaPagamento: f.get("pagamento"), pixChave: f.get("chave"), pixBeneficiario: f.get("beneficiario"), confirmado: true }, "Cobrança preparada com o relatório. Abra a Fila de cobranças para conferir, emitir os documentos e revisar o envio."); }
    return <section className="space-y-5">
    <header className="rounded-3xl bg-[#071b30] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">{empresa.toUpperCase()} · Serviços prestados</p><h2 className="mt-3 text-3xl font-black">Ordens de serviço</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Lance atendimentos, confira horas e valores, gere o relatório e prepare a cobrança. Histórico vinculado a uma nota não pode ser cobrado novamente.</p></header>
    <MensagemAdmin mensagem={aviso} aoFechar={() => setAviso("")} titulo="Ordens de serviço" subtitulo="Confira o resultado da operação" observacao="Nenhuma nota, boleto ou mensagem é emitida por esta tela. Em resultado incerto, atualize e retome o lote existente."/>
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5"><label className="min-w-0 flex-1 text-sm font-semibold">Cliente<select className={campo} value={clienteId} onChange={e => { setClienteId(e.target.value); setIds([]); setEditando(null); setEntrada(entradaNova()); setModelo(false); setPagina(1); }}><option value="">Selecione para lançar e configurar</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><button className={botao} disabled={loading || ocupado} onClick={() => void carregar()}>{loading ? "Consultando…" : "Atualizar ordens"}</button><button className={botao} onClick={abrirFila}>Abrir fila de cobranças</button></div>
    {cliente && <details key={`${clienteId}-${regra?.versao || "nova"}`} className="rounded-2xl border border-blue-100 bg-white p-5" open={!regra}><summary className="cursor-pointer text-lg font-black">Regras de valores · {cliente.nome}</summary><p className="mt-3 text-sm text-slate-600">Hora e diária podem ficar em branco quando não contratadas. Mínimo e arredondamento são em minutos; o acréscimo é comercial, não apuração de imposto. Alterações valem para novos lançamentos.</p><form onSubmit={salvarRegra}><fieldset disabled={ocupado || loading} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-semibold">Hora (R$)<Dinheiro name="hora" valor={regra?.regras.horaCentavos ?? null}/></label><label className="text-sm font-semibold">Diária (R$)<Dinheiro name="diaria" valor={regra?.regras.diariaCentavos ?? null}/></label><label className="text-sm font-semibold">Mínimo por atendimento (min)<input name="minimo" inputMode="numeric" pattern="[0-9]+" required className={campo} defaultValue={regra?.regras.minimoMinutos ?? 0}/></label><label className="text-sm font-semibold">Arredondar para blocos de (min)<input name="incremento" inputMode="numeric" pattern="[0-9]+" required className={campo} defaultValue={regra?.regras.arredondamentoMinutos ?? 1}/></label><label className="text-sm font-semibold">Acréscimo comercial (%)<input name="adicional" inputMode="decimal" required className={campo} defaultValue={String((regra?.regras.adicionalBps ?? 0) / 100).replace(".", ",")}/></label><button className={`${primario} self-end`}>Salvar regras do cliente</button></fieldset></form></details>}
    {cliente && regra && <form onSubmit={salvarOrdem} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-xl font-black">{editando ? "Editar atendimento aberto" : modelo ? "Novo atendimento a partir de modelo" : "Lançar atendimento"}</h3>
      <p className="mt-2 text-sm text-slate-500">{editando ? "A regra de valores original será preservada." : modelo ? "Revise as datas e o serviço antes de salvar. O atendimento histórico não será alterado." : "Os valores serão calculados com as regras salvas acima."}</p>
      <fieldset disabled={ocupado || loading} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold">Data inicial<input type="date" required className={campo} value={entrada.data} onChange={e => setEntrada(v => ({ ...v, data: e.target.value, diaFim: v.diaFim === v.data ? e.target.value : v.diaFim }))}/></label>
        <label className="text-sm font-semibold">Início<input type="time" required className={campo} value={entrada.inicio} onChange={e => setEntrada(v => ({ ...v, inicio: e.target.value }))}/></label>
        <label className="text-sm font-semibold">Data final<input type="date" required className={campo} value={entrada.diaFim} onChange={e => setEntrada(v => ({ ...v, diaFim: e.target.value }))}/></label>
        <label className="text-sm font-semibold">Término<input type="time" required className={campo} value={entrada.fim} onChange={e => setEntrada(v => ({ ...v, fim: e.target.value }))}/></label>
        <label className="text-sm font-semibold">Intervalo não cobrado (min)<input inputMode="numeric" pattern="[0-9]+" required className={campo} value={entrada.intervaloMinutos} onChange={e => setEntrada(v => ({ ...v, intervaloMinutos: Number(e.target.value) }))}/></label>
        <label className="text-sm font-semibold">Tipo<select className={campo} value={entrada.tipo} onChange={e => setEntrada(v => ({ ...v, tipo: e.target.value as EntradaOS["tipo"] }))}><option value="hora">Por hora</option><option value="diaria">Por diária</option><option value="fixo">Valor fixo</option></select></label>
        {entrada.tipo === "diaria" && <label key={`diarias-${editando?.id||"nova"}-${entrada.quantidadeCentesimos}-${modelo}`} className="text-sm font-semibold">Quantidade de diárias<input name="diarias" inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" className={campo} required defaultValue={String(entrada.quantidadeCentesimos / 100).replace(".", ",")}/></label>}
        {entrada.tipo === "fixo" && <label key={`fixo-${editando?.id||"novo"}-${entrada.valorFixoCentavos}-${modelo}`} className="text-sm font-semibold">Valor fixo (R$)<Dinheiro name="fixo" valor={entrada.valorFixoCentavos} obrigatorio/></label>}
        <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">Descrição do serviço<textarea className={campo} required maxLength={4000} rows={4} value={entrada.descricao} onChange={e => setEntrada(v => ({ ...v, descricao: e.target.value }))}/></label>
        <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3"><button className={primario}>Salvar atendimento</button><button type="button" className={botao} onClick={() => { setEditando(null); setEntrada(entradaNova()); setModelo(false); }}>Limpar / novo atendimento</button></div>
      </fieldset>
    </form>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-xl font-black">Atendimentos lançados</h3><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">Buscar serviço, cliente ou nota<input className={campo} value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }}/></label><label className="text-sm">Data inicial<input type="date" className={campo} value={inicio} onChange={e => { setInicio(e.target.value); setPagina(1); }}/></label><label className="text-sm">Data final<input type="date" className={campo} value={fim} onChange={e => { setFim(e.target.value); setPagina(1); }}/></label><label className="text-sm">Situação<select className={campo} value={situacao} onChange={e => { setSituacao(e.target.value); setPagina(1); }}><option value="todas">Todas</option>{Object.entries(estados).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label></div><p className="mt-4 text-xs text-slate-500">{filtradas.length} atendimento(s). Clique nos títulos para ordenar. Valores por linha não incluem o acréscimo; o total é calculado pela seleção.</p>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs"><tr>{cabecalhos}</tr></thead><tbody>{ordenadas.slice((atual - 1) * 10, atual * 10).map(o => { const c = calcularOS(o, o.regras); return <tr key={o.id} className="border-t border-slate-100 align-top"><td className="p-3"><input type="checkbox" aria-label={`Selecionar serviço de ${dataBr(o.data)} ${o.inicio}`} checked={ids.includes(o.id)} disabled={o.estado === "cancelada" || o.estado === "reservada" || ocupado} onChange={e => setIds(v => e.target.checked ? [...v, o.id] : v.filter(id => id !== o.id))}/></td><td className="whitespace-nowrap p-3">{dataBr(o.data)}<p className="mt-1 text-xs text-slate-500">{o.inicio} — {o.fim}</p></td><td className="max-w-80 p-3"><strong>{o.clienteNome}</strong><details className="mt-2"><summary className="cursor-pointer text-blue-700">Ver descrição</summary><p className="mt-2 whitespace-pre-wrap break-words leading-6">{o.descricao}</p>{o.observacao && <p className="mt-3 text-xs text-amber-800">{o.observacao}</p>}</details></td><td className="p-3">{Math.floor(c.minutos / 60)}h{String(c.minutos % 60).padStart(2, "0")}<p className="mt-1 text-xs text-slate-500">{o.tipo === "hora" ? `${c.faturaveis} min faturáveis` : o.tipo === "diaria" ? `${o.quantidadeCentesimos / 100} diária(s)` : "Valor fixo"}</p></td><td className="whitespace-nowrap p-3 font-semibold">{moeda(c.centavos)}</td><td className="p-3"><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-800">{estados[o.estado]}</span>{o.nota && <p className="mt-2 text-xs">NFS-e {o.nota} · não cobrar novamente</p>}</td><td className="p-3"><div className="flex flex-col gap-2">{o.estado === "aberta" && <button className={botao} onClick={() => { setClienteId(o.clienteId); setEditando(o); setEntrada(o); setModelo(false); }}>Editar</button>}<button className={botao} onClick={() => { setClienteId(o.clienteId); setEditando(null); setEntrada({ ...o, data: hojeBrasil(), diaFim: hojeBrasil() }); setModelo(true); }}>Usar como modelo</button>{o.estado === "aberta" && <button disabled={ocupado} className={botao} onClick={async () => { if (await confirmar({ titulo: "Cancelar atendimento?", subtitulo: "Manter o histórico sem cobrar", descricao: "O lançamento ficará cancelado e não poderá entrar em nova cobrança. Não será apagado e nenhum documento fiscal será cancelado.", confirmar: "Cancelar atendimento" }))
        void executar({ acao: "cancelar", id: o.id, versao: o.versao }, "Atendimento cancelado; histórico preservado."); }}>Cancelar</button>}</div></td></tr>; })}</tbody></table>{!filtradas.length && <p className="p-6 text-center text-slate-500">{loading ? "Consultando…" : "Nenhum atendimento neste filtro."}</p>}</div><div className="mt-4 flex items-center justify-between gap-3 text-sm"><span>Página {atual} de {paginas}</span><div className="flex gap-3"><button disabled={atual === 1} className={botao} onClick={() => setPagina(atual - 1)}>Anterior</button><button disabled={atual === paginas} className={botao} onClick={() => setPagina(atual + 1)}>Próxima</button></div></div></section>
    {ids.length > 0 && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><h3 className="text-xl font-black">Conferência da seleção · {ids.length} atendimento(s)</h3>{erroResumo ? <p className="mt-3 text-sm text-amber-900">{erroResumo}</p> : resumo && <><div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Serviços", resumo.subtotal], [`Acréscimo comercial (${resumo.adicionalBps / 100}%)`, resumo.adicional], ["Total", resumo.total]].map(([nome, v]) => <div key={nome} className="rounded-xl bg-white p-4"><p className="text-xs text-slate-500">{nome}</p><p className="mt-2 text-xl font-black">{moeda(Number(v))}</p></div>)}</div><p className="mt-3 text-xs leading-6 text-slate-600">Acréscimo contratual, não apuração de DAS. O total preserva as frações de hora e arredonda ao final em centavos.</p><a className={`${botao} mt-4 inline-flex`} target="_blank" rel="noreferrer" href={`/api/admin/ordens-servico?empresa=${empresa}&arquivo=pdf&ids=${encodeURIComponent(ids.join(","))}`}>Abrir relatório PDF</a>{selecionadas.every(o => o.estado === "aberta") ? <form onSubmit={cobrar} className="mt-5"><fieldset disabled={ocupado || loading} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm font-semibold">Competência da cobrança<input type="month" name="competencia" required className={campo} defaultValue={hojeBrasil().slice(0, 7)}/></label><label className="text-sm font-semibold">Vencimento<input type="date" name="vencimento" required className={campo}/></label><label className="text-sm font-semibold">E-mail do cliente<input type="email" name="email" required className={campo} defaultValue={clientes.find(c => c.id === selecionadas[0].clienteId)?.email || ""}/></label><label className="text-sm font-semibold">Pagamento<select name="pagamento" defaultValue="pix" className={campo}><option value="pix">PIX</option><option value="boleto">Boleto (geração posterior na fila)</option></select></label><label className="text-sm font-semibold">Chave PIX (se PIX)<input name="chave" maxLength={150} className={campo}/></label><label className="text-sm font-semibold">Beneficiário PIX (se PIX)<input name="beneficiario" maxLength={150} className={campo}/></label><button className={`${primario} sm:col-span-2 lg:col-span-3`}>{ocupado ? "Preparando…" : "Preparar cobrança para revisão — sem emitir"}</button></fieldset></form> : <p className="mt-4 font-semibold text-blue-900">A seleção contém serviços históricos ou já vinculados. O relatório pode ser consultado, mas não pode gerar nova cobrança.</p>}</>}<button className={`${botao} ml-3 mt-4`} onClick={() => setIds([])}>Limpar seleção</button></section>}
    {dados.lotes.filter(l => l.estado === "reservado").map(l => <section key={l.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-black">Preparação pendente · {l.competencia}</h3><p className="mt-2 text-sm">Os atendimentos estão reservados. Retome este lote, sem criar outra cobrança.</p><button disabled={ocupado} className={`${botao} mt-4`} onClick={async () => { if (await confirmar({ titulo: "Retomar lote reservado?", subtitulo: "Continuar a mesma operação", descricao: "O sistema verificará os registros existentes e concluirá somente as etapas faltantes. Não haverá emissão ou envio de e-mail.", confirmar: "Retomar lote" }))
        void executar({ acao: "retomar", id: l.id, confirmado: true }, "Lote concluído. Confira na Fila de cobranças."); }}>Retomar lote</button></section>)}
  </section>;
}
