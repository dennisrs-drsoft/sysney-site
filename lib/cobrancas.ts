export type Empresa = "drsoft" | "sysney";
export type Plano = {
  id: string; clienteId: string; clienteNome: string; documento: string;
  email: string; descricao: string; centavos: number; inicio: string;
  fim: string; diaEnvio: number; mesEnvio: number; diaVencimento: number;
  mesVencimento: number; criadoEm: string;
};
export type Evento = {
  id: string; tipo: "documentos" | "envio" | "recebimento" | "pagamento" | "estorno";
  data: string; registradoEm: string; responsavel: string; detalhe: string;
  centavos?: number; referencia?: string;
};
export type Cobranca = {
  id: string; planoId: string; competencia: string; clienteNome: string;
  email: string; descricao: string; centavos: number; envioPrevisto: string;
  vencimento: string; nota: string; boleto: string; demonstrativo: boolean;
  eventos: Evento[]; persistida: boolean;
};
export function hojeBrasil() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function mesValido(v: unknown): v is string {
  return typeof v === "string" && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(v);
}
export function dataValida(v: unknown): v is string {
  return typeof v === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
}
export function dataMensal(mes: string, deslocamento: number, dia: number) {
  const [ano, numero] = mes.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, numero + deslocamento, 0)).getUTCDate();
  return new Date(Date.UTC(ano, numero - 1 + deslocamento, Math.min(dia, ultimoDia))).toISOString().slice(0, 10);
}
export function prevista(plano: Plano, competencia: string): Cobranca {
  return { id: `${plano.id}_${competencia}`, planoId: plano.id, competencia,
    clienteNome: plano.clienteNome, email: plano.email, descricao: plano.descricao,
    centavos: plano.centavos, envioPrevisto: dataMensal(competencia, plano.mesEnvio, plano.diaEnvio),
    vencimento: dataMensal(competencia, plano.mesVencimento, plano.diaVencimento),
    nota: "", boleto: "", demonstrativo: false, eventos: [], persistida: false };
}
export function pago(c: Cobranca) {
  const estornados = new Set(c.eventos.filter(e => e.tipo === "estorno").map(e => e.referencia));
  return c.eventos.filter(e => e.tipo === "pagamento" && !estornados.has(e.id)).reduce((s, e) => s + (e.centavos || 0), 0);
}
export function situacao(c: Cobranca, hoje = hojeBrasil()) {
  const saldo = c.centavos - pago(c);
  if (saldo <= 0) return "Pago";
  if (c.vencimento < hoje) return "Atrasado";
  if (pago(c) > 0) return "Pagamento parcial";
  if (c.eventos.some(e => e.tipo === "envio")) return "Aguardando pagamento";
  return c.envioPrevisto <= hoje ? "Enviar cobrança" : "Programado";
}
export function carteira(planos: Plano[], salvas: Cobranca[], ate: string) {
  const mapa = new Map(salvas.map(c => [c.id, c]));
  for (const p of planos) {
    let mes = p.inicio;
    for (let i = 0; i < 1200 && mes <= ate && (!p.fim || mes <= p.fim); i++) {
      const c = prevista(p, mes);
      if (!mapa.has(c.id)) mapa.set(c.id, c);
      mes = dataMensal(mes, 1, 1).slice(0, 7);
    }
  }
  return [...mapa.values()].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}
export function moeda(v: number) {
  return (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function dataBr(v: string) { return v ? v.split("-").reverse().join("/") : "—"; }
