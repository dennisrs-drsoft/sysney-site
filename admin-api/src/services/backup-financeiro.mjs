import {createHash} from "node:crypto";

export const tabelasFinanceiras=["AdminConfiguracoes","AdminDocumentos","FiscalFila"];
export function empacotarTabela(tabela,entidades){
 if(!tabelasFinanceiras.includes(tabela))throw Error("Tabela não permitida no backup financeiro.");
 const conteudo=Buffer.from(entidades.map(({etag,timestamp,...e})=>{void etag;void timestamp;return JSON.stringify(e);}).join("\n")+"\n");
 return {conteudo,registro:{tabela,arquivo:`${tabela}.jsonl`,quantidade:entidades.length,bytes:conteudo.length,sha256:createHash("sha256").update(conteudo).digest("hex")}};
}
export function verificarTabela(registro,conteudo){
 if(!tabelasFinanceiras.includes(registro.tabela)||registro.arquivo!==`${registro.tabela}.jsonl`||conteudo.length!==registro.bytes||createHash("sha256").update(conteudo).digest("hex")!==registro.sha256)throw Error("Backup incompleto ou alterado.");
 const entidades=conteudo.toString("utf8").split("\n").filter(Boolean).map(v=>JSON.parse(v));
 if(entidades.length!==registro.quantidade||entidades.some(e=>typeof e.partitionKey!=="string"||typeof e.rowKey!=="string"))throw Error("Identidade ou contagem inválida no backup.");
 const unicas=new Set(entidades.map(e=>JSON.stringify([e.partitionKey,e.rowKey])));
 if(unicas.size!==entidades.length)throw Error("Backup com entidades repetidas.");
 return entidades;
}
