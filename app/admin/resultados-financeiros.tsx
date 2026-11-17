"use client";

import { useState } from "react";
import { moeda } from "@/lib/cobrancas";
import type { LinhaFinanceira } from "@/lib/visao-financeira";

const painel = "min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6";
const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function deslocar(data: string, meses: number) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const destino = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(dia, ultimo));
  return destino.toISOString().slice(0, 10);
}

export function ResultadosFinanceiros({ linhas, hoje }: { linhas: LinhaFinanceira[]; hoje: string }) {
  const [saidas, setSaidas] = useState("");
  const ano = Number(hoje.slice(0, 4)), mes = Number(hoje.slice(5, 7));
  const validas = linhas.filter(linha => !["conferir", "cancelado", "expirado"].includes(linha.estado));
  const movimentos = validas.flatMap(linha => linha.movimentosCaixa ??
    (linha.pagamento && !linha.recebidoNominal ? [{ data: linha.pagamento, centavos: linha.recebido }] : []));
  const recebidos = movimentos.filter(movimento => movimento.data && movimento.data <= hoje);
  const somar = (inicio: string, fim: string) => recebidos.reduce((soma, item) =>
    soma + (item.data >= inicio && item.data <= fim ? item.centavos : 0), 0);
  const primeiro = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}-01`;
  const semestre = mes <= 6 ? 1 : 7;
  const cartoes = [
    { titulo: "Recebido no mês", inicio: primeiro(ano, mes), anterior: deslocar(primeiro(ano, mes), -1), fimAnterior: deslocar(hoje, -1), comparacao: "mesmo recorte do mês anterior" },
    { titulo: "Recebido no semestre", inicio: primeiro(ano, semestre), anterior: deslocar(primeiro(ano, semestre), -6), fimAnterior: deslocar(hoje, -6), comparacao: "mesmo recorte do semestre anterior" },
    { titulo: "Recebido no ano", inicio: primeiro(ano, 1), anterior: primeiro(ano - 1, 1), fimAnterior: deslocar(hoje, -12), comparacao: "mesmo recorte do ano anterior" },
  ];
  const fimMes = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const serie = meses.map((rotulo, i) => {
    const m = i + 1;
    return {rotulo, atual:m <= mes ? somar(primeiro(ano,m),fimMes(ano,m)) : null,
      anterior:somar(primeiro(ano-1,m),m===mes ? deslocar(hoje,-12) : fimMes(ano-1,m))};
  });
  const maximo = Math.max(1, ...serie.flatMap(p => [p.atual ?? 0, p.anterior]));
  const abertas = validas.filter(linha => ["aberto", "atrasado", "parcial"].includes(linha.estado));
  const vencidas = abertas.filter(linha => linha.vencimento && linha.vencimento < hoje);
  const saldo = (lista: LinhaFinanceira[]) => lista.reduce((soma, linha) => soma + linha.saldo, 0);
  const horizonte = new Date(Date.parse(hoje + "T12:00:00Z") + 30 * 86400000).toISOString().slice(0, 10);
  const emitidas30 = saldo(abertas.filter(l => l.vencimento >= hoje && l.vencimento <= horizonte));
  const previstas30 = validas.filter(l => l.estado === "previsto" && l.vencimento >= hoje && l.vencimento <= horizonte).reduce((s, l) => s + l.centavos, 0);
  const atraso = saldo(vencidas);
  const saidasCentavos = /^\d+(?:,\d{1,2})?$/.test(saidas.trim()) ? Math.round(Number(saidas.replace(",", ".")) * 100) : null;
  const cenarios = [
    { titulo: "70% do emitido", entrada: Math.round(emitidas30 * 0.7) },
    { titulo: "100% do emitido", entrada: emitidas30 },
    { titulo: "Emitido + previsto", entrada: emitidas30 + previstas30 },
  ];
  const faixas = ["Até 30 dias", "31 a 60 dias", "Mais de 60 dias"].map((titulo, i) => ({
    titulo, valor: saldo(vencidas.filter(l => {
      const dias = (Date.parse(hoje) - Date.parse(l.vencimento)) / 86400000;
      return i === 0 ? dias <= 30 : i === 1 ? dias > 30 && dias <= 60 : dias > 60;
    })),
  }));
  const semComprovacao = validas.reduce((s, linha) => s + (linha.recebidoNominal ? linha.recebido :
    (linha.movimentosCaixa ?? []).filter(m => !m.data).reduce((v, m) => v + m.centavos, 0)), 0);

  return <section aria-label="Resultados e projeções" className="@container space-y-5">
    <div className="grid gap-3 @min-[640px]:grid-cols-3">{cartoes.map(p => {
      const atual = somar(p.inicio, hoje), anterior = somar(p.anterior, p.fimAnterior);
      const diferenca = atual - anterior;
      return <article key={p.titulo} className={painel}>
        <h3 className="text-sm font-semibold text-slate-600">{p.titulo}</h3>
        <p className="mt-2 break-words text-2xl font-bold tabular-nums text-blue-950">{moeda(atual)}</p>
        <p className={`mt-2 text-xs font-semibold ${anterior <= 0 || diferenca === 0 ? "text-slate-600" : diferenca < 0 ? "text-rose-800" : "text-emerald-800"}`}>{anterior > 0 ? `${diferenca > 0 ? "+" : ""}${((diferenca / anterior) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "Sem base para variação"}</p>
        <p className="mt-1 text-xs text-slate-600">{p.comparacao} · {moeda(anterior)}</p>
      </article>;
    })}</div>
    <article className={painel}>
      <h3 className="text-lg font-bold text-blue-950">Recebimentos mês a mês</h3>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-700"><span className="flex items-center gap-2"><i aria-hidden="true" className="size-2.5 rounded-sm bg-blue-700"/>{ano}</span><span className="flex items-center gap-2"><i aria-hidden="true" className="size-2.5 rounded-sm bg-blue-300"/>{ano-1}</span></div>
      <div className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">{serie.map(p => <div key={p.rotulo} className="min-w-0">
        <div className="mb-1 flex flex-wrap justify-between gap-x-2 text-xs"><strong>{p.rotulo}</strong><span className="tabular-nums text-slate-700">{p.atual === null ? "—" : moeda(p.atual)} / {moeda(p.anterior)}</span></div>
        <div aria-hidden="true" className="space-y-1 rounded bg-slate-50 p-1"><div className="h-1.5 rounded bg-blue-700" style={{width:`${100*(p.atual ?? 0)/maximo}%`}}/><div className="h-1.5 rounded bg-blue-300" style={{width:`${100*p.anterior/maximo}%`}}/></div>
      </div>)}</div>
      <p className="mt-4 text-xs leading-5 text-slate-600">Pagamentos registrados por data. Mês atual comparado até o mesmo dia. Meses futuros ficam sem valor realizado. {semComprovacao > 0 && `Fora do gráfico: ${moeda(semComprovacao)} sem data ou valor efetivo confirmado.`}</p>
    </article>
    <article className={painel}>
      <h3 className="text-lg font-bold text-blue-950">Previsão de entradas · próximos 30 dias</h3>
      <div className="mt-4 grid gap-3 @min-[640px]:grid-cols-3">
        {[["Emitido a vencer",emitidas30,"bg-blue-50"],["Previsto a emitir",previstas30,"bg-slate-50"],["Saldo vencido",atraso,"bg-amber-50"]].map(([nome,valor,cor])=><div key={nome} className={`min-w-0 rounded-xl p-4 ${cor}`}><p className="text-sm text-slate-700">{nome}</p><p className="mt-1 break-words text-xl font-bold tabular-nums">{moeda(Number(valor))}</p></div>)}
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 text-sm"><span>Potencial de entrada se tudo a vencer e previsto for pago no prazo</span><strong>{moeda(emitidas30 + previstas30)}</strong></div>
      <p className="mt-3 text-xs leading-5 text-slate-600">O saldo vencido representa exposição a atraso ou perda. O painel precisa de despesas, impostos e demais saídas para calcular lucro ou prejuízo.</p>
    </article>
    <div className="grid gap-4 @min-[800px]:grid-cols-2">
      <article className={painel}>
        <h3 className="text-lg font-bold text-blue-950">Atrasos por faixa</h3>
        <div className="mt-4 space-y-3">{faixas.map(p => <div key={p.titulo}>
          <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm"><span>{p.titulo}</span><strong>{moeda(p.valor)}</strong></div>
          <div aria-hidden="true" className="h-2 rounded bg-amber-50"><div className="h-full rounded bg-amber-600" style={{width:`${100*p.valor/Math.max(1,atraso)}%`}} /></div>
        </div>)}</div>
      </article>
      <article className={painel}>
        <h3 className="text-lg font-bold text-blue-950">Simulação de caixa · próximos 30 dias</h3>
        <label className="mt-3 block text-sm font-semibold text-slate-700">Saídas estimadas (R$)
          <input inputMode="decimal" maxLength={16} value={saidas} onChange={e => setSaidas(e.target.value)} placeholder="Ex.: 1500,00" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
        </label>
        {saidas.trim() && saidasCentavos === null && <p className="mt-1 text-xs text-rose-800">Use apenas números e vírgula para os centavos.</p>}
        <div className="mt-4 divide-y divide-slate-100">{cenarios.map(c => <div key={c.titulo} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{c.titulo}</span><strong className={saidasCentavos !== null && c.entrada < saidasCentavos ? "text-rose-800" : "text-blue-950"}>{moeda(c.entrada - (saidasCentavos ?? 0))}</strong></div>)}</div>
        <p className="mt-2 text-xs leading-5 text-slate-600">{saidasCentavos === null ? "Os cenários mostram entradas brutas. Informe as saídas para estimar o saldo." : "Os cenários mostram entradas menos as saídas informadas."} São hipóteses de recebimento, sem contar o saldo vencido.</p>
      </article>
    </div>
  </section>;
}