export type RegimeFiscal="simples"|"presumido";
export type TaxasRetencao={ir:string;csll:string;cofins:string;pis:string};
// Proposta editável extraída das fórmulas da planilha fornecida pelo usuário.
export const taxasPlanilha:TaxasRetencao={ir:"1.5",csll:"1",cofins:"3",pis:"0.65"};
export function calcularRetencoes(centavos:number,taxas:TaxasRetencao){
  if(!Number.isSafeInteger(centavos)||centavos<=0||centavos>10000000000||!taxas||Object.keys(taxas).sort().join()!=="cofins,csll,ir,pis")throw Error("Base ou percentuais de retenção inválidos.");
  return Object.fromEntries(Object.entries(taxas).map(([k,t])=>{
    if(typeof t!=="string"||!/^\d{1,3}(\.\d{1,4})?$/.test(t)||Number(t)>100)throw Error("Confira os percentuais de retenção.");
    const [a,b=""]=t.split("."),unidades=BigInt(a)*BigInt(10000)+BigInt(b.padEnd(4,"0"));
    return [k,Number((BigInt(centavos)*unidades+BigInt(500000))/BigInt(1000000))];
  })) as Record<keyof TaxasRetencao,number>;
}
