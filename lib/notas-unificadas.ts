import type { Empresa } from "./cobrancas";
import type { EmailCobranca } from "./emails-cobranca";
export type NotaHistorica = { numero: string; documento: string; cliente: string; emissao: string; centavos: number; situacao: string; xml: boolean; pdf: boolean; consultadoEm: string; emissor?:string; chaveAcesso?:string };
export const identidadeNotaFiscal=(n:{numero:string;chaveAcesso?:string})=>n.chaveAcesso?`nacional:${n.chaveAcesso}`:n.numero.trim().replace(/^0+(?=\d)/, "");
export const urlArquivoFiscal=(empresa:string,n:{numero:string;chaveAcesso?:string},tipo:string)=>`/api/admin/nfse?empresa=${encodeURIComponent(empresa)}&historico=1&${n.chaveAcesso?"chave="+encodeURIComponent(n.chaveAcesso):"numero="+encodeURIComponent(n.numero)}&arquivo=${encodeURIComponent(tipo)}`;
export type NotaUnificada = NotaHistorica & { origem: "historico" | "sistema" | "ambos"; emailPdf?: string; busca: string };
const numero = (v: string) => v.trim().replace(/^0+(?=\d)/, "");
const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");
function pesquisa(v: string) { const texto = normalizar(v); return texto + (texto.includes("twentyfourseven") ? "tfseven" : ""); }
/** Projeção de leitura dentro de uma empresa; não cria emissão ou vínculo financeiro. */
export function unificarNotas(historico: NotaHistorica[], emails: EmailCobranca[], empresa: Empresa): NotaUnificada[] {
  const notas = new Map<string, NotaUnificada>();
  for (const n of historico) notas.set(identidadeNotaFiscal(n), { ...n, origem: "historico", busca: pesquisa(`${n.numero} ${n.documento} ${n.cliente} ${n.chaveAcesso||""}`) });
  for (const e of [...emails].sort((a,b) => b.atualizadoEm.localeCompare(a.atualizadoEm))) {
    if (e.empresa !== empresa || e.aviso || !e.fluxo?.nota?.trim()) continue;
    const key = identidadeNotaFiscal({numero:e.fluxo.nota,chaveAcesso:e.fluxo.notaChave}), salvo = notas.get(key), pdf = e.anexos.some(a => a.tipo === "nota");
    const texto = pesquisa(`${e.fluxo.nota} ${e.cliente} ${e.para} ${e.contato || ""}`);
    if (salvo) {
      if (salvo.origem === "historico") salvo.origem = "ambos";
      salvo.busca += texto;
      if (!salvo.emailPdf && pdf) salvo.emailPdf = e.id;
      continue;
    }
    notas.set(key, { numero: e.fluxo.nota, emissor:e.fluxo.notaEmissor,chaveAcesso:e.fluxo.notaChave, documento: "", cliente: e.cliente, emissao: "", centavos: e.centavos,
      situacao: "Registrada na cobrança", xml: false, pdf: false, consultadoEm: "", origem: "sistema", emailPdf: pdf ? e.id : undefined, busca: texto });
  }
  return [...notas.values()];
}
export function filtrarNotas(notas: NotaUnificada[], busca: string, inicio: string, fim: string, incluirSemData = true) {
  const termo = normalizar(busca);
  return notas.filter(n => {
    const data = n.emissao.slice(0,10);
    const periodo = !data ? incluirSemData || (!inicio && !fim) : (!inicio || data >= inicio) && (!fim || data <= fim);
    return periodo && (n.busca.includes(termo) || (/^\d+$/.test(busca.trim()) && numero(n.numero) === numero(busca)));
  });
}
