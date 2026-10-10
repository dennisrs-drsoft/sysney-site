export type ValorOrdenacao = string | number | null | undefined;
export type DirecaoOrdenacao = "asc" | "desc";
const texto = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
const ausente = (v: ValorOrdenacao) => v == null || v === "" || (typeof v === "number" && !Number.isFinite(v));
function comparar(a: ValorOrdenacao, b: ValorOrdenacao, direcao: DirecaoOrdenacao) {
  if (ausente(a) || ausente(b)) return ausente(a) === ausente(b) ? 0 : ausente(a) ? 1 : -1;
  const valor = typeof a === "number" && typeof b === "number" ? a - b : texto.compare(String(a), String(b));
  return direcao === "asc" ? valor : -valor;
}
// Cópia ordenada: valores desconhecidos ficam ao final nas duas direções.
export function ordenarTabela<T>(linhas: readonly T[], valor: (linha: T) => ValorOrdenacao, direcao: DirecaoOrdenacao = "desc", desempate?: (linha: T) => ValorOrdenacao): T[] {
  return [...linhas].sort((a, b) => comparar(valor(a), valor(b), direcao) || (desempate ? comparar(desempate(a), desempate(b), "desc") : 0));
}
