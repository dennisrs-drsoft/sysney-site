"use client";
import { useState } from "react";
import { ordenarTabela, type DirecaoOrdenacao, type ValorOrdenacao } from "@/lib/ordenacao-tabela";
export type ColunaOrdenavel<T> = { titulo: string; valor?: (linha: T) => ValorOrdenacao };
export function useOrdenacaoTabela<T>(linhas: T[], colunas: ColunaOrdenavel<T>[], padrao: string, aoOrdenar?: () => void, desempate?: (linha: T) => ValorOrdenacao) {
  const [selecao, setSelecao] = useState<{ coluna: string; direcao: DirecaoOrdenacao } | null>(null);
  const atual = selecao || { coluna: padrao, direcao: "desc" as const };
  const valor = colunas.find(c => c.titulo === atual.coluna)?.valor;
  const ordenadas = valor ? ordenarTabela(linhas, valor, atual.direcao, desempate) : linhas;
  const cabecalhos = colunas.map(c => <th key={c.titulo} scope="col" className="whitespace-nowrap px-3 py-3 font-semibold" aria-sort={c.valor ? atual.coluna === c.titulo ? atual.direcao === "asc" ? "ascending" : "descending" : "none" : undefined}>
    {c.valor ? <button type="button" className={`inline-flex items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-blue-100 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-500 ${atual.coluna === c.titulo ? "text-blue-800" : ""}`} aria-label={`Ordenar por ${c.titulo}, ${atual.coluna === c.titulo && atual.direcao === "asc" ? "decrescente" : "crescente"}`} onClick={() => { setSelecao({ coluna: c.titulo, direcao: atual.coluna === c.titulo && atual.direcao === "asc" ? "desc" : "asc" }); aoOrdenar?.(); }}>
      {c.titulo}<span aria-hidden="true" className={atual.coluna === c.titulo ? "text-blue-600" : "text-slate-400"}>{atual.coluna === c.titulo ? atual.direcao === "asc" ? "↑" : "↓" : "↕"}</span>
    </button> : c.titulo}
  </th>);
  const restaurar = () => { setSelecao(null); aoOrdenar?.(); };
  return { ordenadas, cabecalhos, restaurar };
}
