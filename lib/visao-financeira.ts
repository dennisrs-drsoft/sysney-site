import { pago, type Cobranca, type Plano } from "./cobrancas";
import type { EmailCobranca } from "./emails-cobranca";

export type EmailFinanceiro = Pick<EmailCobranca, "id" | "competencia" | "centavos" | "vencimento" | "fluxo" | "status"> & { aprovacaoEnvio?: { em: string }; tentativas: { status: string }[] };

export type RegistroInter = {
  id: string; cliente: string; documento: string; numero: string; nossoNumero?: string;
  emissao: string; vencimento: string; valor: number; situacao: string;
  dataSituacao: string; consultadoEm: string;
};
export type EstadoFinanceiro = "previsto" | "aberto" | "atrasado" | "parcial" | "pago" | "cancelado" | "expirado" | "conferir";
export type LinhaFinanceira = {
  id: string; cliente: string; documento: string; competencia: string; emissao: string;
  vencimento: string; centavos: number; recebido: number; saldo: number;
  estado: EstadoFinanceiro; origem: "sistema" | "inter" | "integrado";
  nota: string; boleto: string; envio: boolean; etapa: string; consultadoEm: string;
};
export const nomesEstados: Record<EstadoFinanceiro, string> = {
  previsto: "Prevista", aberto: "Em aberto", atrasado: "Vencida", parcial: "Pagamento parcial",
  pago: "Pagamento registrado", cancelado: "Cancelada", expirado: "Expirada", conferir: "Conferir vínculo / situação",
};
const digitos = (v: string) => v.replace(/\D/g, "");
const numeroBoleto = (v: string) => digitos(v).replace(/^0+/, "");
const data = (v: string) => /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "";
const aberto = (r: LinhaFinanceira) => ["aberto", "atrasado", "parcial"].includes(r.estado);

function estadoBanco(r: RegistroInter, hoje: string): EstadoFinanceiro {
  if (r.situacao === "RECEBIDO") return "pago";
  if (r.situacao === "CANCELADO") return "cancelado";
  if (r.situacao === "EXPIRADO") return "expirado";
  if (r.situacao === "A_RECEBER" && data(r.vencimento)) return data(r.vencimento) < hoje ? "atrasado" : "aberto";
  return "conferir";
}

/** Consulta somente dados já salvos. Nome/valor/data não provam identidade bancária. */
export function consolidarFinanceiro(cobrancas: Cobranca[], planos: Plano[], banco: RegistroInter[], emails: EmailFinanceiro[], hoje: string): LinhaFinanceira[] {
  const bancarias: LinhaFinanceira[] = banco.map(b => {
    const centavos = Math.round(b.valor * 100);
    const estado = Number.isSafeInteger(centavos) && centavos > 0 ? estadoBanco(b, hoje) : "conferir";
    return { id: `inter:${b.id}`, cliente: b.cliente, documento: b.documento, competencia: "", emissao: data(b.emissao),
      vencimento: data(b.vencimento), centavos: Number.isSafeInteger(centavos) ? centavos : 0,
      recebido: estado === "pago" ? centavos : 0, saldo: ["aberto", "atrasado"].includes(estado) ? centavos : 0,
      estado, origem: "inter", nota: "", boleto: b.nossoNumero || b.numero, envio: false,
      etapa: "Histórico bancário; envio de e-mail desconhecido", consultadoEm: b.consultadoEm };
  });
  const usadas = new Set<number>();
  // Uma identificação repetida no sistema também exige conferência, nunca fusão arbitrária.
  const contagem = new Map<string, number>();
  for (const c of cobrancas) {
    const e = emails.find(e => e.fluxo?.cobrancaId === c.id && e.competencia === c.competencia && e.centavos === c.centavos && e.vencimento === c.vencimento);
    const numero = numeroBoleto(c.boleto || e?.fluxo?.boleto || "");
    if (numero) contagem.set(numero, (contagem.get(numero) || 0) + 1);
  }
  const locais = cobrancas.map(c => {
    const e = emails.find(e => e.fluxo?.cobrancaId === c.id && e.competencia === c.competencia && e.centavos === c.centavos && e.vencimento === c.vencimento);
    const nota = c.nota || e?.fluxo?.nota || "", boleto = c.boleto || e?.fluxo?.boleto || "";
    const recebido = Math.max(0, pago(c)), saldo = Math.max(0, c.centavos - recebido);
    const envio = c.eventos.some(v => v.tipo === "envio") || !!e?.tentativas.some(t => t.status === "aceito");
    const emitida = !!(nota || boleto || recebido || envio);
    const estado: EstadoFinanceiro = !emitida ? "previsto" : !saldo ? "pago" : c.vencimento < hoje ? "atrasado" : recebido ? "parcial" : "aberto";
    const linha: LinhaFinanceira = { id: c.id, cliente: c.clienteNome, documento: planos.find(p => p.id === c.planoId)?.documento || "",
      competencia: c.competencia, emissao: c.eventos.filter(v => v.tipo === "documentos").map(v => data(v.data)).filter(Boolean).sort()[0] || "",
      vencimento: c.vencimento, centavos: c.centavos, recebido, saldo: emitida ? saldo : 0, estado, origem: "sistema", nota, boleto, envio,
      etapa: envio ? "Aceito pelo provedor; entrega não confirmada" : e?.status === "incerto" ? "Envio incerto: consultar provedor" : e?.status === "enviando" ? "Envio em processamento" : e?.aprovacaoEnvio ? "E-mail aprovado; falta enviar" : e?.fluxo?.documentos ? "Documentos conferidos; revisar e-mail" : emitida ? "Conferir documentos e e-mail" : "Preparar / aprovar documentos", consultadoEm: "" };
    const candidatos = banco.map((b, i) => ({ b, i })).filter(({ b }) => !!numeroBoleto(boleto) && numeroBoleto(b.nossoNumero || "") === numeroBoleto(boleto));
    const exato = candidatos.length === 1 && (contagem.get(numeroBoleto(boleto)) || 0) <= 1 ? candidatos[0] : undefined;
    if (exato && !usadas.has(exato.i) && Math.round(exato.b.valor * 100) === c.centavos && data(exato.b.vencimento) === c.vencimento && (!linha.documento || digitos(exato.b.documento) === digitos(linha.documento))) {
      usadas.add(exato.i);
      const b = bancarias[exato.i];
      // Snapshot antigo não apaga um pagamento/estorno registrado depois no sistema.
      const movimentoPosterior = c.eventos.some(v => ["pagamento", "estorno"].includes(v.tipo) && v.registradoEm > b.consultadoEm);
      return { ...linha, origem: "integrado" as const, consultadoEm: b.consultadoEm,
        ...(movimentoPosterior ? {} : { estado: b.estado, recebido: b.recebido, saldo: b.saldo }) };
    }
    const suspeitos = emitida ? banco.map((b, i) => ({ b, i })).filter(({ b, i }) => !usadas.has(i) && !["CANCELADO", "EXPIRADO"].includes(b.situacao) && digitos(linha.documento) && digitos(b.documento) === digitos(linha.documento) && Math.round(b.valor * 100) === c.centavos && data(b.vencimento) === c.vencimento) : [];
    if (candidatos.length || suspeitos.length) {
      linha.estado = "conferir";
      linha.etapa = "Possível duplicidade: validar identificação do boleto";
      for (const { i } of [...candidatos, ...suspeitos]) bancarias[i].estado = "conferir";
    }
    return linha;
  });
  return [...locais, ...bancarias.filter((_, i) => !usadas.has(i))].sort((a, b) => (b.vencimento || "").localeCompare(a.vencimento || ""));
}

export function resumoFinanceiro(linhas: LinhaFinanceira[], hoje: string) {
  const soma = (lista: LinhaFinanceira[], campo: "centavos" | "saldo" | "recebido") => lista.reduce((s, r) => s + r[campo], 0);
  const validas = linhas.filter(r => r.estado !== "conferir");
  const emAberto = validas.filter(aberto);
  const dias = (n: number) => new Date(Date.parse(`${hoje}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  return { receber: soma(emAberto, "saldo"), recebido: soma(validas, "recebido"), vencido: soma(emAberto.filter(r => r.vencimento < hoje), "saldo"),
    previsto: soma(validas.filter(r => r.estado === "previsto"), "centavos"), conferir: linhas.filter(r => r.estado === "conferir").length,
    hoje: soma(emAberto.filter(r => r.vencimento === hoje), "saldo"), sete: soma(emAberto.filter(r => r.vencimento >= hoje && r.vencimento <= dias(7)), "saldo"),
    trinta: soma(emAberto.filter(r => r.vencimento >= hoje && r.vencimento <= dias(30)), "saldo"),
    pendentes: validas.filter(r => r.origem !== "inter" && !r.envio && r.estado !== "pago" && !["cancelado", "expirado"].includes(r.estado)).length };
}

export function filtrarFinanceiro(linhas: LinhaFinanceira[], filtro: { mes: string; por: "vencimento" | "competencia" | "emissao"; estado: string; busca: string }) {
  const busca = filtro.busca.trim().toLocaleLowerCase("pt-BR");
  return linhas.filter(r => (!filtro.mes || r[filtro.por].startsWith(filtro.mes)) && (!filtro.estado || r.estado === filtro.estado) && (!busca || `${r.cliente} ${r.documento} ${digitos(r.documento)} ${r.nota} ${r.boleto}`.toLocaleLowerCase("pt-BR").includes(busca)));
}
