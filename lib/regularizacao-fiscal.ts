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
