"use client";
import { useCallback, useEffect, useState } from "react";
import { lerRespostaAdmin } from "@/lib/admin-resposta";
import { MensagemAdmin, useConfirmarAdmin } from "./dialogos-admin";
type Estado = { ativa:boolean; estado:string; intervaloMinutos?:number; ultimoSucesso?:string; ultimaTentativa?:string; erro?:string; atualizadas?:number };
const horario = (v?:string) => v ? new Date(v).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}) : "Ainda não registrada";
export function SincronizacaoInter({empresa,aoAtualizar}:{empresa:"sysney"|"drsoft";aoAtualizar?:()=>void}) {
  const [estado,setEstado]=useState<Estado|null>(null),[ocupado,setOcupado]=useState(false),[aviso,setAviso]=useState("");
  const confirmar=useConfirmarAdmin();
  const carregar=useCallback(async(signal?:AbortSignal)=>{
    try {
      const r=await fetch(`/api/admin/historico-inter?empresa=${empresa}&sync=1`,{cache:"no-store",signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)});
      const d=await lerRespostaAdmin<{sincronizacao:Estado;erro?:string}>(r);
      if(!r.ok||!d.sincronizacao)throw Error(d.erro||"Estado da sincronização indisponível.");
      if(!signal?.aborted)setEstado(d.sincronizacao);
    }catch{if(!signal?.aborted)setEstado({ativa:false,estado:"indisponivel",erro:"Não foi possível consultar a rotina bancária. Atualize a consulta."});}
  },[empresa]);
  useEffect(()=>{const abort=new AbortController();const id=requestAnimationFrame(()=>void carregar(abort.signal));const timer=setInterval(()=>void carregar(abort.signal),30000);return()=>{cancelAnimationFrame(id);abort.abort();clearInterval(timer);};},[carregar]);
  useEffect(()=>{if(!estado?.ultimoSucesso)return;const id=requestAnimationFrame(()=>aoAtualizar?.());return()=>cancelAnimationFrame(id);},[estado?.ultimoSucesso,aoAtualizar]);
  async function solicitar(){
    if(!await confirmar({titulo:"Sincronizar recebimentos com o Inter?",subtitulo:"SYSNEY · consulta bancária somente leitura",descricao:"Solicita uma atualização no servidor. A rotina consulta situações e valores dos boletos, preserva os registros manuais e não emite, cancela ou baixa documentos no banco. A solicitação normalmente começa no próximo minuto; acompanhe o estado abaixo.",confirmar:"Consultar Inter agora",observacao:"PIX avulsos exigem conciliação separada. O pagamento depende da confirmação disponível no banco."}))return;
    setOcupado(true);
    try{
      const r=await fetch("/api/admin/historico-inter?empresa=sysney",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao:"sincronizar"})});
      const d=await lerRespostaAdmin<{sincronizacao:Estado;erro?:string}>(r,true);if(!r.ok)throw Error(d.erro);
      setEstado(d.sincronizacao);
    }catch(e){setAviso(e instanceof Error?e.message:"Consulta não solicitada.");}finally{setOcupado(false);}
  }
  const pendente=estado?.estado==="solicitada"||estado?.estado==="executando";
  const nomes:Record<string,string>={aguardando:"Aguardando primeira execução",solicitada:"Consulta solicitada",executando:"Consultando o banco",concluida:"Última execução concluída",falha:"Consulta não concluída",interrompida:"Execução interrompida",indisponivel:"Rotina indisponível"};
  return <section className="rounded-2xl border border-blue-200 bg-white p-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Atualização bancária · {empresa.toUpperCase()}</p><h3 className="mt-2 font-bold">{estado?.ativa?"Automática a cada 15 minutos no servidor":"Sincronização não ativa"}</h3></div><button className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-bold text-blue-800 disabled:opacity-50" disabled={empresa!=="sysney"||!estado?.ativa||ocupado||pendente} onClick={()=>void solicitar()}>{pendente?"Atualização em andamento…":"Sincronizar com o Inter agora"}</button></div>
    <p aria-live="polite" className="text-sm text-slate-600">{estado?nomes[estado.estado]||estado.estado:"Consultando estado…"} · Último sucesso: {horario(estado?.ultimoSucesso)} (Brasília).</p>
    {estado?.ultimaTentativa&&<p className="text-xs text-slate-500">Última tentativa: {horario(estado.ultimaTentativa)} · {estado.atualizadas||0} registro(s) atualizado(s) nessa execução.</p>}
    {estado?.erro&&<button className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900" onClick={()=>setAviso(estado.erro||"")}>Ver detalhes da pendência bancária</button>}
    <p className="text-xs text-slate-500">Boletos recentes são consultados em cada execução; registros antigos são revisitados em grupos. Não é confirmação instantânea. PIX avulsos não são baixados por coincidência de nome ou valor. A tela acompanha o estado a cada 30 segundos enquanto aberta.</p>
    <button className="text-sm font-semibold text-blue-700" onClick={()=>void carregar()}>Atualizar estado da consulta</button>
    <MensagemAdmin mensagem={aviso} aoFechar={()=>setAviso("")} titulo="Consulta bancária não solicitada" subtitulo="Nenhum boleto foi emitido ou cancelado" tom="erro"/>
  </section>;
}
