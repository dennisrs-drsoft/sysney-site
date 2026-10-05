export type Empresa = "drsoft" | "sysney";
export type Plano = {
  id: string; clienteId: string; clienteNome: string; documento: string;
  email: string; descricao: string; centavos: number; inicio: string;
  fim: string; diaEnvio: number; mesEnvio: number; diaVencimento: number;
  mesVencimento: number; criadoEm: string;
};
export type Evento = {
  id: string; tipo: "documentos" | "envio" | "recebimento" | "pagamento" | "estorno" | "alteracao";
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

export function validarAlteracaoVencimento(c:Cobranca,e:{status:string;tentativas:unknown[];anexos:unknown[];fluxo?:{cobrancaId:string;nota:string;boleto:string}},v:unknown,hoje=hojeBrasil()) {
  if(!e.fluxo || e.fluxo.cobrancaId!==c.id || !["rascunho","revisado"].includes(e.status) || e.tentativas.length)throw new Error("A cobrança já está em processamento ou possui tentativa de envio. Consulte o resultado antes de alterar.");
  if(!dataValida(v) || v<c.envioPrevisto || v<hoje)throw new Error("Informe um vencimento válido, igual ou posterior a hoje e ao envio previsto.");
  if(c.nota || c.boleto || e.fluxo.nota || e.fluxo.boleto || e.anexos.length || c.eventos.some(x=>x.tipo!=="alteracao"))throw new Error("Há documentos ou movimentações registrados. Não é possível alterar o vencimento por esta ação; confira os documentos existentes primeiro.");
  if(c.eventos.length>=100)throw new Error("Limite de histórico atingido.");
}

// Projeção dos envios confirmados pelo provedor; não dispara nem repete envios.
export function integrarEnvios(cobrancas: Cobranca[], emails: {empresa:string; competencia:string; centavos:number; vencimento:string; fluxo?:{cobrancaId:string}; tentativas:{id:string;data:string;status:string;messageId?:string}[]}[], empresa: Empresa) {
  return cobrancas.map(c => {
    const eventos = [...c.eventos];
    for (const e of emails) {
      if (e.empresa !== empresa || e.fluxo?.cobrancaId !== c.id || e.competencia !== c.competencia || e.centavos !== c.centavos || e.vencimento !== c.vencimento) continue;
      for (const t of e.tentativas) {
        if (t.status !== "aceito" || !Number.isFinite(Date.parse(t.data)) || eventos.some(v=>v.id === t.id)) continue;
        eventos.push({id:t.id,tipo:"envio",data:new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(t.data)),registradoEm:t.data,responsavel:"Sistema — SendGrid",detalhe:`E-mail aceito pelo SendGrid. Entrega, leitura e pagamento não confirmados. Protocolo: ${t.messageId || "não informado"}.`});
      }
    }
    return {...c,eventos};
  });
}
