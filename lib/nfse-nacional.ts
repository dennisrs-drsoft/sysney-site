// Preparação, não autorização fiscal. A data não desbloqueia a transmissão.
export const NFSE_NACIONAL_SYSNEY = {
  empresa: "SYSNEY",
  municipio: "3550308",
  obrigatoriedade: "2026-11-01",
  referencia: "2026-10",
  emissaoPrevista: "2026-11-01",
  vencimento: "2026-12-08",
  ultimaVerificacaoPortal: "2026-10-02",
  habilitacao: "nao_confirmada",
  transmissaoHabilitada: false,
  homologacaoConcluida: false,
} as const;

export function identificadorDps(municipio: string, cnpj: string, serie: string, numero: string) {
  if (!/^\d{7}$/.test(municipio) || !/^\d{14}$/.test(cnpj) ||
      !/^\d{1,5}$/.test(serie) || !/^\d{1,15}$/.test(numero) || /^0+$/.test(numero)) {
    throw new Error("Identificação de DPS inválida.");
  }
  return `DPS${municipio}2${cnpj}${serie.padStart(5, "0")}${numero.padStart(15, "0")}`;
}

export function pendenciasNacionais(empresa: string) {
  if (empresa !== "sysney") return ["DRSOFT: migração nacional não configurada. Não aplicar automaticamente as regras do Simples Nacional."];
  return [
    "Confirmar habilitação da SYSNEY para a competência correta no Emissor Nacional.",
    "Validar o código nacional do serviço e os dados da DPS; não copiar o código municipal 03158 como código nacional.",
    "Definir e reservar série e sequência próprias de DPS, sem reutilizar a numeração municipal.",
    "Concluir assinatura, validação do XML e teste de emissão no ambiente de testes.",
    "Validar consulta de retorno e download do DANFSe (PDF) antes de liberar produção.",
    "Configurar execução segura com o certificado: o certificado instalado neste Windows não está automaticamente disponível no Azure.",
  ];
}
