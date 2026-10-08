import { XMLParser, XMLValidator } from "fast-xml-parser";

export type TributosXml = {
  iss: number | null; pis: number | null; cofins: number | null;
  inss: number | null; ir: number | null; csll: number | null;
  issRetido: boolean | null; opcaoSimples: string;
  guia: string; quitacaoGuia: string; cancelamento: string;
};
// Apenas XML individual municipal já arquivado. Não calcula DAS nem comprova recolhimentos.
export function extrairTributosXml(xml: string, numero: string, inscricao: string): TributosXml {
  if (Buffer.byteLength(xml, "utf8") > 100000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw Error("XML fiscal inválido.");
  const doc = new XMLParser({ removeNSPrefix: true, parseTagValue: false, ignoreAttributes: true, processEntities: false }).parse(xml);
  const n = doc.NFe;
  if (!n || Array.isArray(n) || String(n.ChaveNFe?.NumeroNFe) !== numero || String(n.ChaveNFe?.InscricaoPrestador) !== inscricao) throw Error("Identificação fiscal divergente.");
  const texto = (campo: string) => {
    if (n[campo] === undefined) return "";
    if (typeof n[campo] !== "string") throw Error("Campo fiscal duplicado ou inválido.");
    return n[campo];
  };
  const valor = (campo: string) => {
    const v = texto(campo);
    if (!v) return null;
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(v)) throw Error("Valor fiscal inválido.");
    const [inteiro, fracao = ""] = v.split(".");
    const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
    if (!Number.isSafeInteger(centavos)) throw Error("Valor fiscal fora da faixa.");
    return centavos;
  };
  const data = (campo: string) => {
    const v = texto(campo).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v ? v : "";
  };
  return { iss: valor("ValorISS"), pis: valor("ValorPIS"), cofins: valor("ValorCOFINS"), inss: valor("ValorINSS"), ir: valor("ValorIR"), csll: valor("ValorCSLL"),
    issRetido: ["true", "1"].includes(texto("ISSRetido")) ? true : ["false", "0"].includes(texto("ISSRetido")) ? false : null,
    opcaoSimples: texto("OpcaoSimples"), guia: texto("NumeroGuia"), quitacaoGuia: data("DataQuitacaoGuia"), cancelamento: data("DataCancelamento") };
}
