export type RegularizacaoFiscal = {
  id: string; empresa: "sysney" | "drsoft"; documento: string; cliente: string;
  contato: string; email: string; descricao: string; formaPagamento: "pix";
  transacao: string; endToEndId: string; recebimento: string; inclusaoBanco: string;
  centavos: number; vencimentoReferencia: string; competencia: string;
  evidenciaCompetencia: string; emissaoPlanejada: string; nota: string;
  notasCandidatas: { numero: string; emissao: string; descricao: string; centavos: number; situacao: string }[];
  importadoEm: string; atualizadoEm: string;
  revisoes?: { data: string; responsavel: string; competencia: string; evidenciaCompetencia: string; emissaoPlanejada: string; nota: string }[];
};
export function centavosExtrato(v: unknown) {
  if (typeof v !== "string" || !/^\d{1,8}(\.\d{1,2})?$/.test(v)) throw new Error("Valor bancário inválido.");
  const [inteiro, decimais = ""] = v.split(".");
  const n = Number(inteiro) * 100 + Number(decimais.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error("Recebimento sem valor positivo.");
  return n;
}
function dataValida(v: unknown): v is string {
  return typeof v === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
}
export function validarPlanejamentoFiscal(r: RegularizacaoFiscal, b: { competencia: unknown; evidenciaCompetencia: unknown; emissaoPlanejada: unknown; nota: unknown }, hoje: string) {
  if (typeof b.competencia !== "string" || (b.competencia && (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(b.competencia) || b.competencia > hoje.slice(0,7)))) throw new Error("Informe a competência real do serviço, até o mês atual.");
  if (typeof b.evidenciaCompetencia !== "string" || b.evidenciaCompetencia.length > 1000 || (b.competencia && !b.evidenciaCompetencia.trim())) throw new Error("Registre a origem da competência: e-mail, memória de cálculo, contrato ou nota existente.");
  if (typeof b.emissaoPlanejada !== "string" || (b.emissaoPlanejada && (!dataValida(b.emissaoPlanejada) || b.emissaoPlanejada < hoje || !b.competencia))) throw new Error("Para planejar a emissão, confirme a competência e escolha uma data a partir de hoje.");
  if (typeof b.nota !== "string" || (b.nota && !/^\d{1,12}$/.test(b.nota))) throw new Error("Número de nota inválido.");
  if (r.nota && b.nota !== r.nota) throw new Error("A nota já foi vinculada. Não desvincule ou substitua sem revisar a emissão fiscal.");
  if (b.nota && (!b.competencia || b.emissaoPlanejada)) throw new Error("Nota existente: confirme a competência e retire o planejamento de nova emissão.");
  return { competencia:b.competencia, evidenciaCompetencia:b.evidenciaCompetencia.trim(), emissaoPlanejada:b.emissaoPlanejada, nota:b.nota };
}
export function resumoRegularizacao(lista: RegularizacaoFiscal[]) {
  return { recebimentos:lista.length, recebido:lista.reduce((s,r)=>s+r.centavos,0),
    conferir:lista.filter(r=>!r.competencia || (!r.nota && r.notasCandidatas.length)).length,
    vinculado:lista.filter(r=>r.nota).reduce((s,r)=>s+r.centavos,0),
    semNotaVinculada:lista.filter(r=>!r.nota).reduce((s,r)=>s+r.centavos,0) };
}

// Planejamento documental, independente do mês do serviço e da apuração tributária.
export function cronogramaRegularizacao(lista: RegularizacaoFiscal[]) {
  const meses = new Map<string, { mes: string; quantidade: number; total: number }>();
  for (const r of lista) {
    if (r.nota) continue;
    const mes = r.emissaoPlanejada ? r.emissaoPlanejada.slice(0, 7) : "";
    const grupo = meses.get(mes) || { mes, quantidade: 0, total: 0 };
    grupo.quantidade++;
    grupo.total += r.centavos;
    meses.set(mes, grupo);
  }
  return [...meses.values()].sort((a, b) => (a.mes || "9999").localeCompare(b.mes || "9999"));
}

// Cenário financeiro informado pelo administrador; não é apuração nem dívida.
export function simularRegularizacao(lista: RegularizacaoFiscal[], percentual: string) {
  const total = lista.reduce((s,r)=>s+r.centavos,0);
  if (!/^\d{1,2}([,.]\d{1,4})?$/.test(percentual)) return {total, imposto:null};
  const taxa = Number(percentual.replace(",", "."));
  if (!Number.isFinite(taxa) || taxa < 0 || taxa > 40) return {total, imposto:null};
  return {total, imposto:Math.round(total*taxa/100)};
}
export type LoteRegularizacao = {
  id:string; tipo:"lote-regularizacao"; empresa:"sysney"|"drsoft";
  estado:"aguardando-validacao-fiscal"; criadoEm:string; responsavel:string;
  dataPreparacao:string; percentualCenario:string; origemCenario:string; total:number; impostoEstimado:number;
  recebimentos: {id:string;recebimento:string;competencia:string;centavos:number;vencimentoReferencia:string;descricao:string;status:"pago"}[];
};
export function validarLoteRegularizacao(lista:RegularizacaoFiscal[], empresa:string) {
  if (!lista.length || lista.length>40 || new Set(lista.map(r=>r.id)).size!==lista.length) throw Error("Selecione de 1 a 40 recebimentos distintos.");
  for (const r of lista) {
    if (r.empresa!==empresa || !Number.isSafeInteger(r.centavos) || r.centavos<=0) throw Error("Recebimento inválido ou de outra empresa.");
    if (r.nota || r.notasCandidatas.length) throw Error("Confira e vincule as notas existentes antes de preparar nova emissão.");
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(r.competencia) || !r.evidenciaCompetencia.trim()) throw Error("Revise a competência real e sua evidência em cada recebimento.");
  }
  if (new Set(lista.map(r=>r.documento)).size!==1) throw Error("Prepare um cliente por lote.");
}
export function textoRegularizacao(lista:RegularizacaoFiscal[]) {
  if (!lista.length || lista.some(r=>!r.nota||!r.competencia)) throw Error("Selecione apenas recebimentos com nota e competência já confirmadas.");
  if (new Set(lista.map(r=>r.documento)).size!==1) throw Error("Selecione um cliente por comunicado.");
  const valor=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n/100);
  return `Olá, ${lista[0].contato}, tudo bem?\n\nInformamos a emissão e regularização das seguintes notas fiscais, referentes a serviços já pagos:\n\n${lista.map(r=>`NFS-e ${r.nota} — referência ${r.competencia.split("-").reverse().join("/")} — PIX recebido em ${r.recebimento.split("-").reverse().join("/")} — ${valor(r.centavos)}`).join("\n")}\n\nTotal documentado: ${valor(lista.reduce((s,r)=>s+r.centavos,0))}.\nNão há novo valor a pagar. Este comunicado é apenas para registro e conferência fiscal.\n\nAtenciosamente,\nFinanceiro · ${lista[0].empresa.toUpperCase()}`;
}
