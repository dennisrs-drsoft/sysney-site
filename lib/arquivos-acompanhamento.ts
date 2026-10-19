import type { Empresa } from "./cobrancas";
import type { EmailCobranca } from "./emails-cobranca";

/** Apenas vínculo explícito e empresa correta; nome, valor e pagamento não identificam um arquivo. */
export function emailsDaCobranca(emails: EmailCobranca[], empresa: Empresa, cobrancaId: string) {
  return emails.filter(e => e.empresa === empresa && e.fluxo?.cobrancaId === cobrancaId && !e.aviso);
}

export function notasDaCobranca<T extends { numero: string }>(notas: T[], numero: string) {
  const normalizar = (v: string) => v.trim().replace(/^0+(?=\d)/, "");
  return numero.trim() ? notas.filter(n => normalizar(n.numero) === normalizar(numero)) : [];
}
