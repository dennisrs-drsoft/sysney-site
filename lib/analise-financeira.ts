import { dataValida } from "./cobrancas";
import { filtrarFinanceiro, resumoFinanceiro, type FiltroFinanceiro, type LinhaFinanceira, type NotaFinanceira } from "./visao-financeira";

export function compararNotas(notas: NotaFinanceira[], inicio: string, fim: string, busca = "") {
  const periodo = periodoAnoAnterior(inicio, fim);
  if (!periodo) return null;
  const texto = busca.trim().toLocaleLowerCase("pt-BR");
  const resumir = (a: string, b: string) => {
    const rs = notas.filter(n => n.emissao.slice(0, 10) >= a && n.emissao.slice(0, 10) <= b && (!texto || `${n.cliente || ""} ${n.documento} ${n.numero}`.toLocaleLowerCase("pt-BR").includes(texto)));
    const emitidas = rs.filter(n => n.situacao === "N");
    return { quantidade: emitidas.length, valor: emitidas.reduce((s, n) => s + n.centavos, 0), canceladas: rs.filter(n => n.situacao === "C").length, desconhecidas: rs.filter(n => !["N", "C"].includes(n.situacao || "")).length };
  };
  return { atual: resumir(inicio, fim), anterior: resumir(periodo.inicio, periodo.fim) };
}

export function serieMensalNotas(notas: NotaFinanceira[], inicio: string, fim: string, busca = "") {
  if (!periodoAnoAnterior(inicio, fim)) return [];
  const [ano, mes] = inicio.split("-").map(Number);
  const resultado = [];
  for(let i=0;i<240;i++) {
    const primeiro = new Date(Date.UTC(ano, mes-1+i, 1)).toISOString().slice(0,10);
    if(primeiro>fim)break;
    const ultimo = new Date(Date.UTC(ano, mes+i, 0)).toISOString().slice(0,10);
    const a = primeiro < inicio ? inicio : primeiro, b = ultimo > fim ? fim : ultimo;
    const r = compararNotas(notas,a,b,busca)!;
    resultado.push({ mes:primeiro.slice(0,7), inicio:a, fim:b, ...r });
  }
  return resultado;
}

export function periodoAnoAnterior(inicio: string, fim: string) {
  if (!dataValida(inicio) || !dataValida(fim) || inicio > fim) return null;
  const anterior = (v: string) => {
    const [ano, mes, dia] = v.split("-").map(Number);
    const ultimo = new Date(Date.UTC(ano - 1, mes, 0)).getUTCDate();
    return `${ano - 1}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
  };
  return { inicio: anterior(inicio), fim: anterior(fim) };
}
export function variacaoPercentual(atual: number, anterior: number) {
  return anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
}
export function compararFinanceiro(linhas: LinhaFinanceira[], filtro: FiltroFinanceiro, hoje: string) {
  const periodo = periodoAnoAnterior(filtro.inicio || "", filtro.fim || "");
  if (!periodo) return null;
  const atuais = filtrarFinanceiro(linhas, filtro);
  const anteriores = filtrarFinanceiro(linhas, { ...filtro, mes: "", ...periodo });
  const resumo = (rs: LinhaFinanceira[]) => {
    const r = resumoFinanceiro(rs, hoje);
    const emitidas = rs.filter(r => !["previsto", "cancelado", "expirado", "conferir"].includes(r.estado));
    return { registros: rs.length, emitidos: emitidas.reduce((s, r) => s + r.centavos, 0), recebido: r.recebido,
      pagos: rs.filter(r => r.estado === "pago").length, previstos: r.previsto, conferir: r.conferir };
  };
  return { periodo, atual: resumo(atuais), anterior: resumo(anteriores) };
}
export function diasEntre(inicio: string, fim: string) {
  return dataValida(inicio) && dataValida(fim) ? Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000) : null;
}
export type AnaliseCliente = {
  id: string; nome: string; documento: string; liquidadas: number; comData: number;
  noPrazo: number; aposVencimento: number; atrasoMaximo: number; atrasoMedio: number;
  mesesRecebidos: number; recebido: number; semData: number; baixasBancarias: number;
};
export function analisarClientes(linhas: LinhaFinanceira[]): AnaliseCliente[] {
  const grupos = new Map<string, { linhas: LinhaFinanceira[]; nome: string; documento: string }>();
  for (const r of linhas) {
    if (["conferir", "cancelado", "expirado", "previsto"].includes(r.estado)) continue;
    const id = r.documento.replace(/\D/g, "") || `nome:${r.cliente.trim().toLocaleLowerCase("pt-BR")}`;
    const g = grupos.get(id) || { linhas: [], nome: r.cliente, documento: r.documento };
    g.linhas.push(r); grupos.set(id, g);
  }
  return [...grupos.entries()].map(([id, g]) => {
    const liquidadas = g.linhas.filter(r => r.estado === "pago");
    const dias = liquidadas.map(r => diasEntre(r.vencimento, r.pagamento)).filter((d): d is number => d !== null);
    return { id, nome: g.nome, documento: g.documento, liquidadas: liquidadas.length, comData: dias.length,
      noPrazo: dias.filter(d => d <= 0).length, aposVencimento: dias.filter(d => d > 0).length,
      atrasoMaximo: Math.max(0, ...dias), atrasoMedio: dias.length ? dias.reduce((s, d) => s + Math.max(0, d), 0) / dias.length : 0,
      mesesRecebidos: new Set(liquidadas.map(r => r.pagamento.slice(0, 7)).filter(Boolean)).size,
      recebido: g.linhas.reduce((s, r) => s + r.recebido, 0), semData: liquidadas.length - dias.length,
      baixasBancarias: liquidadas.filter(r => r.fontePagamento === "banco").length };
  });
}
export type OrdemClientes = "pontualidade" | "atraso" | "regularidade" | "valor";
export function ordenarClientes(clientes: AnaliseCliente[], ordem: OrdemClientes) {
  const taxa = (c: AnaliseCliente) => c.comData ? c.noPrazo / c.comData : -1;
  return [...clientes].sort((a, b) =>
    (ordem === "atraso" ? b.atrasoMaximo - a.atrasoMaximo || b.atrasoMedio - a.atrasoMedio
      : ordem === "regularidade" ? b.mesesRecebidos - a.mesesRecebidos || taxa(b) - taxa(a)
      : ordem === "valor" ? b.recebido - a.recebido : taxa(b) - taxa(a) || b.comData - a.comData)
    || a.nome.localeCompare(b.nome, "pt-BR"));
}
export function auditarEmissoes(linhas: LinhaFinanceira[], hoje: string) {
  const pendentes = linhas.filter(r => r.origem !== "inter" && r.emissaoPrevista && r.emissaoPrevista <= hoje && !r.nota && !["cancelado", "expirado", "conferir"].includes(r.estado));
  const tardias = linhas.filter(r => r.origem !== "inter" && r.nota && r.emissaoNota && r.emissaoPrevista && r.emissaoNota > r.emissaoPrevista);
  const semDataFiscal = linhas.filter(r => r.origem !== "inter" && r.nota && !r.emissaoNota);
  return { pendentes, tardias, semDataFiscal };
}
