export type PreferenciasCobrancaOS = {
    email: string;
    cc: string;
    pixChave: string;
    pixBeneficiario: string;
};
export type RegrasOS = {
    horaCentavos: number | null;
    diariaCentavos: number | null;
    minimoMinutos: number;
    arredondamentoMinutos: number;
    adicionalBps: number;
};
export function valorMonetarioOS(texto:string):number|null {
    const s=texto.replace(/\s/g,"");if(!s)return null;
    let normal:string;
    if(s.includes(",")){if(!/^\d+(?:\.\d{3})*(?:,\d{0,2})$/.test(s))return NaN;normal=s.replace(/\./g,"").replace(",",".");}
    else if(/^\d{1,3}(?:\.\d{3})+$/.test(s))normal=s.replace(/\./g,"");
    else if(/^\d+(?:\.\d{0,2})?$/.test(s))normal=s;
    else return NaN;
    const centavos=Math.round(Number(normal)*100);return Number.isSafeInteger(centavos)?centavos:NaN;
}
export type EntradaOS = {
    data: string;
    inicio: string;
    fim: string;
    diaFim: string;
    intervaloMinutos: number;
    tipo: "hora" | "diaria" | "fixo";
    quantidadeCentesimos: number;
    valorFixoCentavos: number;
    descricao: string;
};
export type OrdemServico = EntradaOS & {
    id: string;
    clienteId: string;
    clienteNome: string;
    documento: string;
    regras: RegrasOS;
    estado: "aberta" | "reservada" | "cobrada" | "historico" | "cancelada";
    nota?: string;
    loteId?: string;
    cobrancaId?: string;
    criadoEm: string;
    atualizadoEm: string;
    por: string;
    origem?: string;
    observacao?: string;
};
export type LoteOS = {
    id: string;
    tipo: "lote";
    estado: "reservado" | "concluido";
    ids: string[];
    clienteId: string;
    competencia: string;
    vencimento: string;
    email: string;
    cc?: string;
    formaPagamento: "pix" | "boleto";
    pixChave: string;
    pixBeneficiario: string;
    cobrancaId: string;
    planoId: string;
    emailId: string;
    criadoEm: string;
    por: string;
    hash: string;
};
export const regrasVazias: RegrasOS = { horaCentavos: null, diariaCentavos: null, minimoMinutos: 0, arredondamentoMinutos: 1, adicionalBps: 0 };
export function inteiroOS(v: unknown, min: number, max: number) { if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max)
    throw Error("Valor numérico inválido."); return v; }
export function textoOS(v: unknown, max = 4000) { if (typeof v !== "string" || !v.trim() || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))
    throw Error("Preencha o texto dentro do limite permitido."); return v.trim(); }
export function dataOS(v: unknown): v is string { return typeof v === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v; }
export function validarRegrasOS(raw: unknown): RegrasOS {
    if (!raw || typeof raw !== "object")
        throw Error("Configure as regras do cliente.");
    const r = raw as RegrasOS;
    return { horaCentavos: r.horaCentavos === null ? null : inteiroOS(r.horaCentavos, 1, 100000000), diariaCentavos: r.diariaCentavos === null ? null : inteiroOS(r.diariaCentavos, 1, 100000000), minimoMinutos: inteiroOS(r.minimoMinutos, 0, 1440), arredondamentoMinutos: inteiroOS(r.arredondamentoMinutos, 1, 1440), adicionalBps: inteiroOS(r.adicionalBps, 0, 10000) };
}
export function validarEntradaOS(raw: unknown): EntradaOS {
    if (!raw || typeof raw !== "object")
        throw Error("Lançamento inválido.");
    const r = raw as EntradaOS;
    if (!dataOS(r.data) || !dataOS(r.diaFim) || r.diaFim < r.data)
        throw Error("Confira as datas do atendimento.");
    if (!["hora", "diaria", "fixo"].includes(r.tipo))
        throw Error("Tipo de cobrança inválido.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.inicio) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.fim))
        throw Error("Informe horários válidos.");
    const duracao = (Date.parse(`${r.diaFim}T${r.fim}:00Z`) - Date.parse(`${r.data}T${r.inicio}:00Z`)) / 60000;
    if (duracao <= 0 || duracao > 10080)
        throw Error("O fim deve ser posterior ao início, até sete dias. Para virar a meia-noite, informe a data final.");
    const intervalo = inteiroOS(r.intervaloMinutos, 0, 10079);
    if (intervalo >= duracao)
        throw Error("O intervalo deve ser menor que a duração.");
    return { data: r.data, diaFim: r.diaFim, inicio: r.inicio, fim: r.fim, intervaloMinutos: intervalo, tipo: r.tipo, quantidadeCentesimos: inteiroOS(r.quantidadeCentesimos, 1, 10000), valorFixoCentavos: inteiroOS(r.valorFixoCentavos, 0, 100000000), descricao: textoOS(r.descricao) };
}
const arredondar = (n: bigint, d: bigint) => Number((n + d / BigInt(2)) / d);
export function calcularOS(raw: EntradaOS, regras: RegrasOS) {
    const e = validarEntradaOS(raw), r = validarRegrasOS(regras);
    const minutos = (Date.parse(`${e.diaFim}T${e.fim}:00Z`) - Date.parse(`${e.data}T${e.inicio}:00Z`)) / 60000 - e.intervaloMinutos;
    const faturaveis = Math.ceil(Math.max(minutos, r.minimoMinutos) / r.arredondamentoMinutos) * r.arredondamentoMinutos;
    let base300: bigint;
    if (e.tipo === "hora") {
        if (r.horaCentavos === null)
            throw Error("Valor da hora não configurado para este cliente.");
        base300 = BigInt(r.horaCentavos) * BigInt(faturaveis) * BigInt(5);
    }
    else if (e.tipo === "diaria") {
        if (r.diariaCentavos === null)
            throw Error("Valor da diária não configurado para este cliente.");
        base300 = BigInt(r.diariaCentavos) * BigInt(e.quantidadeCentesimos) * BigInt(3);
    }
    else {
        if (e.valorFixoCentavos <= 0)
            throw Error("Informe o valor fixo.");
        base300 = BigInt(e.valorFixoCentavos) * BigInt(300);
    }
    return { minutos, faturaveis, base300: base300.toString(), centavos: arredondar(base300, BigInt(300)) };
}
export function resumirOS(ordens: OrdemServico[], limite = 40) {
    if (!Number.isInteger(limite) || limite < 1 || limite > 1000 || !ordens.length || ordens.length > limite)
        throw Error(`Selecione de 1 a ${limite} atendimentos.`);
    if (new Set(ordens.map(o => o.id)).size !== ordens.length)
        throw Error("Atendimento repetido na seleção.");
    const primeira = ordens[0];
    let base = BigInt(0), minutos = 0;
    for (const o of ordens) {
        if (o.clienteId !== primeira.clienteId || o.documento !== primeira.documento)
            throw Error("Selecione atendimentos do mesmo cliente.");
        if (JSON.stringify(validarRegrasOS(o.regras)) !== JSON.stringify(validarRegrasOS(primeira.regras)))
            throw Error("As regras dos atendimentos são diferentes. Gere relatórios e cobranças separados.");
        const c = calcularOS(o, o.regras);
        base += BigInt(c.base300);
        minutos += c.minutos;
    }
    const subtotal = arredondar(base, BigInt(300)), total = arredondar(base * BigInt(10000 + primeira.regras.adicionalBps), BigInt(3000000));
    if (!Number.isSafeInteger(total) || total > 10000000000)
        throw Error("Total excede o limite permitido.");
    return { minutos, subtotal, adicional: total - subtotal, total, adicionalBps: primeira.regras.adicionalBps };
}
export function selecionarParaCobrancaOS(ordens: OrdemServico[], ids: string[]) {
    if (new Set(ids).size !== ids.length)
        throw Error("Seleção repetida.");
    const lista = ids.map(id => { const o = ordens.find(o => o.id === id); if (!o || o.estado !== "aberta")
        throw Error("Há atendimento já cobrado, histórico, reservado ou indisponível. Atualize a lista."); return o; });
    if (resumirOS(lista).total <= 0)
        throw Error("O total da cobrança deve ser maior que zero.");
    return lista;
}
