// Cronograma RFB/CGIBS 4/2026: itens 1.03 e 1.05 a partir de 01/12/2026.
// Escopo municipal confirmado: 02684 (1.03) e 02800 (1.05).
// Demais enquadramentos não são presumidos como dispensados.
export function leiauteSP(fiscal:{regime:string;codigoServico:string;dataEmissao:string}):1|2 {
  if(fiscal.regime==="simples")return 1;
  if(["02684","02800"].includes(fiscal.codigoServico) && /^2026-\d{2}-\d{2}$/.test(fiscal.dataEmissao) && fiscal.dataEmissao<"2026-12-01")return 1;
  return 2;
}
