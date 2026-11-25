import type { Empresa, Cobranca } from "./cobrancas";
import type { EmailCobranca } from "./emails-cobranca";

/** A preparação fiscal é isolada; só notas confirmadas originam histórico pago e rascunho na fila. */
export type ContextoFiscal = {
  email: EmailCobranca; cobranca: Cobranca; documento: string; idNota: string;
  row: { etag?: string; json?: string }; cr: { etag?: string } | null;
  origem?: "regularizacao";
};
export function particaoDocumentoFiscal(empresa: Empresa, ctx: Pick<ContextoFiscal, "origem">) {
  return ctx.origem === "regularizacao" ? `regularizacao-documentos-${empresa}` : `emails-${empresa}`;
}
export function particaoControleFiscal(empresa: Empresa, ctx: Pick<ContextoFiscal, "origem">) {
  return ctx.origem === "regularizacao" ? `regularizacao-controles-${empresa}` : `cobrancas-${empresa}`;
}
