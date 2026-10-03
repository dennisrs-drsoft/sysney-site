import { createHash } from "node:crypto";

export type DadosEmissao = {
  clienteNome: string; clienteDocumento: string; descricao: string;
  competencia: string; vencimento: string; centavos: number;
  codigoServico: string; aliquota: string; retencao: string; gerarCobranca: boolean;
};
export type AprovacaoEmissao = {
  id: string; empresa: "sysney" | "drsoft"; dados: DadosEmissao;
  versao: number; status: "pendente" | "aprovada"; atualizadoEm: string;
  aprovacao?: { por: string; em: string; hash: string };
  historico: { acao: string; por: string; em: string; versao: number }[];
};
export function normalizarEmissao(raw: Record<string, unknown>): DadosEmissao {
  const texto = (chave: string, limite = 500) => {
    const v = raw[chave];
    if (typeof v !== "string" || !v.trim() || v.length > limite) throw new Error(`Confira ${chave}.`);
    return v.trim();
  };
  const clienteDocumento = texto("clienteDocumento",30).replace(/\D/g,"");
  if (!/^\d{11}$|^\d{14}$/.test(clienteDocumento)) throw new Error("CPF/CNPJ inválido.");
  const competencia = texto("competencia",7), vencimento = texto("vencimento",10);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(competencia) || !/^20\d{2}-\d{2}-\d{2}$/.test(vencimento) || !Number.isFinite(Date.parse(vencimento)) || new Date(vencimento).toISOString().slice(0,10) !== vencimento) throw new Error("Competência ou vencimento inválido.");
  const centavos = raw.centavos;
  if (typeof centavos !== "number" || !Number.isSafeInteger(centavos) || centavos <= 0 || centavos > 10000000000) throw new Error("Valor inválido.");
  const retencao = texto("retencao",30), aliquota = texto("aliquota",12);
  if (!["sem-retencao","com-retencao"].includes(retencao) || !/^\d{1,2}([.,]\d{1,4})?$/.test(aliquota) || Number(aliquota.replace(",",".")) > 100) throw new Error("Confira retenção e alíquota.");
  return { clienteNome:texto("clienteNome",200), clienteDocumento, descricao:texto("descricao",2000), competencia, vencimento, centavos, codigoServico:texto("codigoServico",20), aliquota, retencao, gerarCobranca:raw.gerarCobranca === true };
}
export function hashEmissao(empresa: string, dados: DadosEmissao) {
  return createHash("sha256").update(JSON.stringify({empresa,dados:normalizarEmissao(dados)})).digest("hex");
}
