import type { NotaFinanceira } from './visao-financeira';
export type ApuracaoPgdas = {
  mes: string; declaracao: string; receita: number; debito: number; rbt12: number;
  rbt12p: number | null; regime: string; atividade: string; importadoEm: string;
};
export function compararPgdas(apuracoes: ApuracaoPgdas[], notas: NotaFinanceira[], inicio: string, fim: string) {
  if (inicio && fim && inicio > fim) return [];
  const meses = new Set([...apuracoes.map(a=>a.mes), ...notas.map(n=>n.emissao.slice(0,7))]);
  return [...meses].filter(m=>(!inicio||m>=inicio.slice(0,7))&&(!fim||m<=fim.slice(0,7))).sort().map(mes=>{
    const apuracao=apuracoes.find(a=>a.mes===mes);
    const ns=notas.filter(n=>n.emissao.slice(0,7)===mes);
    const fiscal=ns.filter(n=>n.situacao==='N').reduce((s,n)=>s+n.centavos,0);
    return {mes,apuracao,fiscal,canceladas:ns.filter(n=>n.situacao==='C').length,
      diferenca:apuracao?fiscal-apuracao.receita:null,
      aliquota:apuracao&&apuracao.receita>0?apuracao.debito/apuracao.receita*100:null};
  });
}
