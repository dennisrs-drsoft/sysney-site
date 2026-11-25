import type {LoteEmissaoFiscal} from "./regularizacao-emissao-modelo";

/** Azure Table: cada propriedade de texto tem limite próprio de 64 KiB. */
export function entidadeLoteFiscal(l:LoteEmissaoFiscal){
  const json=JSON.stringify(l),base={partitionKey:`regularizacao-${l.empresa}`,rowKey:l.id};
  if(Buffer.byteLength(json,"utf16le")<=60000)return {...base,json};
  if(Buffer.byteLength(json,"utf8")>800000)throw Error("Lote muito extenso. Divida os pagamentos em lotes menores.");
  const partes:Record<string,string>={};for(let i=0;i<json.length;i+=20000)partes[`json${i/20000}`]=json.slice(i,i+20000);
  if(Object.keys(partes).length>16)throw Error("Lote muito extenso. Divida os pagamentos em lotes menores.");
  return {...base,json:JSON.stringify({id:l.id,tipo:l.tipo,empresa:l.empresa,partes:Object.keys(partes).length}),...partes};
}
export function lerLoteFiscal(row:{json:string}){
  const parsed=JSON.parse(row.json);
  if(parsed.tipo!=="emissao-regularizacao")throw Error("Registro não é um lote de emissão.");
  if(!parsed.partes)return parsed as LoteEmissaoFiscal;
  if(!Number.isInteger(parsed.partes)||parsed.partes<1||parsed.partes>16)throw Error("Lote incompleto. Atualize a consulta.");
  const fields=row as unknown as Record<string,unknown>;let json="";
  for(let i=0;i<parsed.partes;i++){const part=fields[`json${i}`];if(typeof part!=="string")throw Error("Lote incompleto. Atualize a consulta.");json+=part;}
  const lote=JSON.parse(json) as LoteEmissaoFiscal;
  if(lote.id!==parsed.id||lote.empresa!==parsed.empresa||lote.tipo!==parsed.tipo)throw Error("Partes do lote divergentes.");
  return lote;
}
