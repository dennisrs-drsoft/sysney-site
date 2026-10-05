import type { NotaFinanceira } from "./visao-financeira";
export function filtrarNotasFiscais(notas: NotaFinanceira[], inicio: string, fim: string, busca: string, situacao = "") {
  if (inicio && fim && inicio > fim) return [];
  const texto = busca.trim().toLocaleLowerCase("pt-BR");
  return notas.filter(n => (!inicio || n.emissao.slice(0,10) >= inicio) && (!fim || n.emissao.slice(0,10) <= fim)
    && (!situacao || n.situacao === situacao) && (!texto || `${n.cliente || ""} ${n.documento} ${n.numero}`.toLocaleLowerCase("pt-BR").includes(texto)));
}
export function resumoFiscal(notas: NotaFinanceira[]) {
  const validas = notas.filter(n => n.situacao === "N"), canceladas = notas.filter(n => n.situacao === "C");
  const campos = ["iss", "pis", "cofins", "inss", "ir", "csll"] as const;
  const tributos = campos.map(campo => ({ campo, valor: validas.reduce((s,n) => s + (n.tributos?.[campo] ?? 0), 0), informadas: validas.filter(n => n.tributos?.[campo] != null).length }));
  return { validas: validas.length, faturado: validas.reduce((s,n) => s + n.centavos, 0), canceladas: canceladas.length, valorCancelado: canceladas.reduce((s,n) => s + n.centavos, 0),
    desconhecidas: notas.length - validas.length - canceladas.length, tributos,
    issRetido: validas.reduce((s,n) => s + (n.tributos?.issRetido === true ? n.tributos.iss ?? 0 : 0), 0),
    guiasComData: validas.filter(n => !!n.tributos?.quitacaoGuia).length };
}

export function baseSimplesPorNotas(notas: NotaFinanceira[], mes: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(mes)) return null;
  const [ano,m] = mes.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano-1,m-1,1)).toISOString().slice(0,10);
  const fim = new Date(Date.UTC(ano,m-1,0)).toISOString().slice(0,10);
  const mensal = resumoFiscal(filtrarNotasFiscais(notas,`${mes}-01`,new Date(Date.UTC(ano,m,0)).toISOString().slice(0,10),""));
  const anteriores = filtrarNotasFiscais(notas,inicio,fim,"");
  return { inicio, fim, receitaMes: mensal.faturado, receita12: resumoFiscal(anteriores).faturado,
    mesesComNotas: new Set(anteriores.filter(n=>n.situacao==="N").map(n=>n.emissao.slice(0,7))).size };
}
