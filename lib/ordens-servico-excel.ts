import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { validarEntradaOS, type EntradaOS } from "./ordens-servico";

export const LIMITE_EXCEL_OS = 2 * 1024 * 1024;
type No = Record<string, unknown>;
const obj = (n: unknown): No => n && typeof n === "object" ? n as No : {};
const lista = (n: unknown): unknown[] => n === undefined ? [] : Array.isArray(n) ? n : [n];
function crc32(b: Buffer) { let c = 0xffffffff; for (const v of b) { c ^= v; for (let j=0;j<8;j++) c=(c>>>1)^((c&1)?0xedb88320:0); } return (c^0xffffffff)>>>0; }

// Leitura limitada do contêiner XLSX. Não extrai arquivos no disco, executa macros
// nem segue links. A inflação também tem limite, não apenas o tamanho declarado.
function pacote(b: Buffer) {
    if (b.length < 22 || b.length > LIMITE_EXCEL_OS) throw Error("Selecione um XLSX de até 2 MB.");
    let end=-1;
    for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--) if(b.readUInt32LE(i)===0x06054b50 && i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}
    if(end<0 || b.readUInt16LE(end+4)!==0 || b.readUInt16LE(end+6)!==0) throw Error("Arquivo XLSX inválido ou protegido.");
    const count=b.readUInt16LE(end+10), start=b.readUInt32LE(end+16), size=b.readUInt32LE(end+12);
    if(!count || count>200 || count!==b.readUInt16LE(end+8) || start+size!==end) throw Error("Estrutura do XLSX não suportada.");
    const files=new Map<string,{offset:number;compressed:number;length:number;method:number;crc:number}>();
    let p=start,total=0;
    for(let i=0;i<count;i++){
        if(p+46>end || b.readUInt32LE(p)!==0x02014b50) throw Error("Diretório XLSX inválido.");
        const flags=b.readUInt16LE(p+8),method=b.readUInt16LE(p+10),compressed=b.readUInt32LE(p+20),length=b.readUInt32LE(p+24),n=b.readUInt16LE(p+28),extra=b.readUInt16LE(p+30),comment=b.readUInt16LE(p+32),offset=b.readUInt32LE(p+42);
        if(p+46+n+extra+comment>end) throw Error("Diretório XLSX incompleto.");
        const name=b.subarray(p+46,p+46+n).toString("utf8");total+=length;
        if(flags&1 || ![0,8].includes(method) || length>4*1024*1024 || total>20*1024*1024 || offset>=start || b.readUInt16LE(p+34)!==0 || files.has(name) || /(^\/|\\|(^|\/)\.\.(\/|$)|vbaproject|externallinks)/i.test(name)) throw Error("XLSX protegido, com conteúdo externo ou acima dos limites permitidos.");
        files.set(name,{offset,compressed,length,method,crc:b.readUInt32LE(p+16)});p+=46+n+extra+comment;
    }
    if(p!==end) throw Error("Diretório XLSX inconsistente.");
    return (name:string, optional=false): string => {
        const f=files.get(name);if(!f){if(optional)return "";throw Error("A estrutura esperada não foi encontrada no XLSX.");}
        const o=f.offset;if(o+30>start || b.readUInt32LE(o)!==0x04034b50 || b.readUInt16LE(o+6)&1 || b.readUInt16LE(o+8)!==f.method) throw Error("Entrada XLSX inválida.");
        const nl=b.readUInt16LE(o+26),el=b.readUInt16LE(o+28),begin=o+30+nl+el;
        if(begin+f.compressed>start || b.subarray(o+30,o+30+nl).toString("utf8")!==name) throw Error("Entrada XLSX inconsistente.");
        const input=b.subarray(begin,begin+f.compressed),out=f.method===0?input:inflateRawSync(input,{maxOutputLength:4*1024*1024});
        if(out.length!==f.length || crc32(out)!==f.crc) throw Error("Arquivo XLSX corrompido.");
        return out.toString("utf8");
    };
}
function xml(s:string):No {
    if(!s)return {};
    if(/<!DOCTYPE|<!ENTITY/i.test(s) || XMLValidator.validate(s)!==true) throw Error("XML do arquivo inválido.");
    return new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@",parseTagValue:false,parseAttributeValue:false,trimValues:false,processEntities:true}).parse(s);
}
const texto = (v:unknown):string => {if(typeof v==="string"||typeof v==="number")return String(v);const o=obj(v);return o.t!==undefined?texto(o.t):o["#text"]!==undefined?texto(o["#text"]):lista(o.r).map(texto).join("");};
type Celula={valor:string;formula:boolean;tipo:string};
function data(v:string,date1904:boolean):string {
    if(/^\d+(?:\.0+)?$/.test(v)){
        const n=Number(v);if(n<1||n>100000)throw Error("Data fora do limite.");
        return new Date(Date.UTC(1899,11,30)+(n+(date1904?1462:0))*86400000).toISOString().slice(0,10);
    }
    if(/^\d{2}\/\d{2}\/20\d{2}$/.test(v))return v.slice(6)+"-"+v.slice(3,5)+"-"+v.slice(0,2);
    if(/^20\d{2}-\d{2}-\d{2}(T00:00:00(?:\.000)?Z?)?$/.test(v))return v.slice(0,10);
    throw Error("Data inválida. Use uma data Excel ou dd/mm/aaaa.");
}
function hora(v:string):string {
    if(/^\d{1,2}:\d{2}(?::00)?$/.test(v))return v.split(":").slice(0,2).map(x=>x.padStart(2,"0")).join(":");
    if(/^\d+(?:\.\d+)?(?:e-?\d+)?$/i.test(v)){
        const n=Number(v)*1440,m=Math.round(n);
        if(Number(v)>=0 && Number(v)<1 && m<1440 && Math.abs(n-m)<0.00001)return `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
    }
    throw Error("Horário inválido. Use hh:mm, sem segundos.");
}
export type LinhaExcelOS={linha:number;entrada?:EntradaOS;erro?:string;valorPlanilha?:number};
export function lerExcelOS(bytes:Buffer) {
    const ler=pacote(bytes),wb=obj(xml(ler("xl/workbook.xml")).workbook),sheets=lista(obj(wb.sheets).sheet).map(obj),sheet=sheets.find(s=>String(s["@name"]).toUpperCase()==="OSS");
    if(!sheet)throw Error('A planilha precisa conter a aba "OSS", no formato enviado anteriormente.');
    const rel=lista(obj(xml(ler("xl/_rels/workbook.xml.rels")).Relationships).Relationship).map(obj).find(r=>r["@Id"]===sheet["@r:id"]);
    if(!rel || rel["@TargetMode"]==="External")throw Error("Aba OSS inválida.");
    const target=String(rel["@Target"]||"").replace(/^\/xl\//,"").replace(/^xl\//,"");
    if(!/^worksheets\/sheet\d+\.xml$/.test(target))throw Error("Localização da aba OSS não suportada.");
    const strings=lista(obj(xml(ler("xl/sharedStrings.xml",true)).sst).si).map(texto);
    const rows=lista(obj(obj(xml(ler(`xl/${target}`)).worksheet).sheetData).row);
    if(rows.length>2000 || strings.length>10000)throw Error("Planilha muito extensa. Use no máximo 40 atendimentos por arquivo.");
    const cells=new Map<string,Celula>();const numeros:number[]=[];
    for(const raw of rows){const row=obj(raw),num=Number(row["@r"]);if(!Number.isInteger(num)||num<1||num>10000)throw Error("Linha Excel inválida.");numeros.push(num);
        for(const rawcell of lista(row.c)){const c=obj(rawcell),ref=String(c["@r"]||"");if(!/^[A-Z]{1,3}\d+$/.test(ref)||Number(ref.replace(/^[A-Z]+/,""))!==num||cells.has(ref))throw Error("Célula Excel inválida.");
            const t=String(c["@t"]||""),val=t==="s"?strings[Number(c.v)]:t==="inlineStr"?texto(c.is):texto(c.v);
            if(val===undefined)throw Error("Texto Excel indisponível.");
            cells.set(ref,{valor:val,formula:c.f!==undefined,tipo:t});
        }
    }
    const result: LinhaExcelOS[]=[];const date1904=["1","true"].includes(String(obj(wb.workbookPr)["@date1904"]));
    const get=(r:number,c:string)=>cells.get(c+r)||{valor:"",formula:false,tipo:""};
    for(const n of numeros.sort((a,b)=>a-b)){
        const a=get(n,"A"),b=get(n,"B"),c=get(n,"C");
        if(/^(data|dia)$/i.test(a.valor.trim()) && /in[ií]cio/i.test(b.valor))continue;
        if(/^(vencto|vencimento)\s*:?$/i.test(a.valor.trim()) && !c.valor.trim())continue;
        const temData=/^(\d{4,5}(?:\.0+)?|\d{2}\/\d{2}\/20\d{2}|20\d{2}-\d{2}-\d{2})/.test(a.valor.trim());
        if(!temData&&!b.valor.trim()&&!c.valor.trim())continue;
        if(result.length>=40)throw Error("Limite de 40 atendimentos por arquivo. Divida a planilha em arquivos menores.");
        try{
            const d=get(n+1,"A");
            if([a,b,c,d].some(x=>x.formula||x.tipo==="e"))throw Error("Data, horários e descrição devem ser preenchidos, não fórmulas.");
            if(!d.valor.trim() || /^(\d{4,5}|\d{2}\/\d{2}\/20\d{2})$/.test(d.valor.trim()))throw Error("Preencha a descrição na coluna A da linha seguinte.");
            const dt=data(a.valor.trim(),date1904),entrada=validarEntradaOS({data:dt,diaFim:dt,inicio:hora(b.valor.trim()),fim:hora(c.valor.trim()),intervaloMinutos:0,tipo:"hora",quantidadeCentesimos:100,valorFixoCentavos:0,descricao:d.valor});
            const g=get(n,"G"),v=Number(g.valor);
            result.push({linha:n,entrada,...(g.valor.trim()&&g.tipo!=="e"&&Number.isFinite(v)&&v>=0?{valorPlanilha:Math.round(v*100)}:{})});
        }catch(e){result.push({linha:n,erro:e instanceof Error?e.message:"Linha inválida."});}
    }
    if(!result.length)throw Error("Nenhum atendimento encontrado na aba OSS. Use A: data, B: início, C: término e a descrição em A na linha seguinte.");
    return {hash:createHash("sha256").update(bytes).digest("hex"),linhas:result};
}
