"use client";
import {useRef,useState} from "react";
import {MensagemAdmin,useConfirmarAdmin} from "./dialogos-admin";
import {lerRespostaAdmin} from "@/lib/admin-resposta";
import {dataBr,moeda,type Empresa} from "@/lib/cobrancas";
import type {OrdensServicoStore} from "@/lib/ordens-servico-store";
type Previa=Awaited<ReturnType<OrdensServicoStore["preverExcel"]>>;
const botao="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-blue-700 disabled:opacity-50";
export function ImportarOSExcel({empresa,clienteId,clienteNome,aoImportar}:{empresa:Empresa;clienteId:string;clienteNome:string;aoImportar:()=>Promise<void>}){
 const [arquivo,setArquivo]=useState<File|null>(null),[previa,setPrevia]=useState<Previa|null>(null),[ocupado,setOcupado]=useState(false),[aviso,setAviso]=useState("");
 const confirmar=useConfirmarAdmin(),tentativa=useRef<string|null>(null);
 async function consultar(){
  if(!arquivo)return;setOcupado(true);setPrevia(null);tentativa.current=null;
  try{
   if(!/\.xlsx$/i.test(arquivo.name)||arquivo.size>2*1024*1024)throw Error("Selecione um XLSX de até 2 MB, sem senha.");
   const r=await fetch(`/api/admin/ordens-servico?empresa=${empresa}&acao=prever-excel&clienteId=${encodeURIComponent(clienteId)}`,{method:"POST",headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},body:arquivo,signal:AbortSignal.timeout(90000)});
   const d=await lerRespostaAdmin<Previa&{erro?:string}>(r,true);if(!r.ok)throw Error(d.erro||"Não foi possível ler o Excel.");setPrevia(d);
  }catch(e){setAviso(e instanceof Error?e.message:"Falha ao consultar o arquivo.");}finally{setOcupado(false);}
 }
 async function importar(){
  if(!previa||!arquivo||previa.erros||!previa.novas)return;
  if(!await confirmar({titulo:"Importar os serviços do Excel?",subtitulo:`${empresa.toUpperCase()} · ${clienteNome}`,descricao:"Serão criados somente atendimentos em aberto. Repetições e horários já cadastrados serão ignorados. Nenhuma cobrança, nota, boleto ou mensagem será gerada. Corrija eventuais divergências antes de confirmar.",confirmar:"Confirmar importação",detalhes:[{rotulo:"Novos atendimentos",valor:String(previa.novas)},{rotulo:"Ignorados",valor:String(previa.ignoradas)},{rotulo:"Total com acréscimo",valor:moeda(previa.resumo?.total||0)}]}))return;
  setOcupado(true);tentativa.current||=crypto.randomUUID();
  try{
   const q=new URLSearchParams({empresa,acao:"importar-excel",clienteId,versao:previa.versao,operacaoId:tentativa.current,confirmado:"true"});
   const r=await fetch(`/api/admin/ordens-servico?${q}`,{method:"POST",headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},body:arquivo,signal:AbortSignal.timeout(90000)});
   const d=await lerRespostaAdmin<{resultado?:{importadas:number;ignoradas:number;repetida:boolean};erro?:string}>(r,true);
   if(!r.ok||!d.resultado)throw Error(d.erro||"Importação não confirmada.");
   setAviso(`${d.resultado.repetida?"Este arquivo já foi importado, sem repetir lançamentos.":`${d.resultado.importadas} atendimento(s) importado(s); ${d.resultado.ignoradas} ignorado(s).`} Nenhuma cobrança ou nota emitida.`);
   setPrevia(null);tentativa.current=null;await aoImportar();
  }catch(e){setAviso(`${e instanceof Error?e.message:"Resultado não confirmado."} Atualize as ordens e consulte a prévia novamente antes de repetir. A importação não sobrescreve registros existentes.`);}finally{setOcupado(false);}
 }
 return <details className="rounded-2xl border border-blue-100 bg-white p-5">
  <summary className="cursor-pointer text-lg font-black">Importar atendimentos do Excel</summary>
  <MensagemAdmin mensagem={aviso} aoFechar={()=>setAviso("")} titulo="Importação de serviços" subtitulo="Confira o resultado" observacao="A importação apenas lança serviços em aberto. Histórico já faturado não será cobrado novamente."/>
  <p className="mt-3 text-sm leading-6 text-slate-600">Use o mesmo modelo da Compuwise: aba <strong>OSS</strong>, coluna A com a data, B com o início, C com o término e a descrição em A na linha seguinte. Pode deixar uma linha vazia entre atendimentos.</p>
  <p className="mt-2 text-sm leading-6 text-slate-600">Até 40 atendimentos por arquivo XLSX de 2 MB, sem senha ou macros. Este modelo importa serviços por hora, sem intervalo descontado; ajuste intervalos, diárias ou valores fixos no lançamento manual. Fórmulas de total do Excel não são executadas: os valores usam as regras atuais do cliente.</p>
  <div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-semibold">Arquivo Excel<input type="file" accept=".xlsx" disabled={ocupado} className="mt-2 block w-full text-sm" onChange={e=>{setArquivo(e.target.files?.[0]||null);setPrevia(null);tentativa.current=null;}}/></label><button className={botao} disabled={!arquivo||ocupado} onClick={()=>void consultar()}>{ocupado?"Processando…":"Conferir prévia — sem importar"}</button></div>
  {previa&&<div className="mt-5 space-y-4">
   <p className="font-semibold">{previa.novas} novos · {previa.ignoradas} ignorados · {previa.erros} com erro</p>
   <p className="text-sm">Serviços: {moeda(previa.resumo?.subtotal||0)} · Acréscimo ({previa.regras.adicionalBps/100}%): {moeda(previa.resumo?.adicional||0)} · Total dos novos: <strong>{moeda(previa.resumo?.total||0)}</strong></p>
   <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50"><tr>{["Linha","Data / horário","Descrição","Valor do serviço","Resultado"].map(t=><th key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{previa.linhas.map(l=><tr key={l.linha} className="border-t border-slate-100 align-top"><td className="p-3">{l.linha}</td><td className="whitespace-nowrap p-3">{l.entrada?dataBr(l.entrada.data):"—"}<p>{l.entrada?`${l.entrada.inicio} — ${l.entrada.fim}`:""}</p></td><td className="max-w-sm whitespace-pre-wrap p-3">{l.entrada?.descricao||"—"}</td><td className="whitespace-nowrap p-3">{"centavos" in l?moeda(l.centavos||0):"—"}</td><td className="max-w-xs p-3"><strong>{l.situacao==="nova"?"Novo":l.situacao==="erro"?"Corrigir":"Ignorado"}</strong><p className="mt-1 text-xs leading-5">{l.erro||("observacao" in l?l.observacao:"")}</p></td></tr>)}</tbody></table></div>
   {previa.erros>0&&<p className="text-sm font-semibold text-amber-900">Corrija as linhas com erro no Excel e confira a prévia novamente. Nenhuma linha será gravada enquanto houver erros.</p>}
   <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={ocupado||previa.erros>0||previa.novas===0} onClick={()=>void importar()}>Confirmar importação dos novos serviços</button>
  </div>}
 </details>;
}
