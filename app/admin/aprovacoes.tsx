"use client";
import { useCallback, useEffect, useState } from "react";
import type { AprovacaoEmissao, DadosEmissao } from "@/lib/aprovacoes-emissao";
type Rascunho = Omit<DadosEmissao,"centavos"> & {id:string;valor:number};
const button = "rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40";
export function Aprovacoes({empresa,rascunhos}:{empresa:"sysney"|"drsoft";rascunhos:Rascunho[]}) {
  const [lista,setLista] = useState<AprovacaoEmissao[]>([]);
  const [aviso,setAviso] = useState(""); const [ocupado,setOcupado] = useState(false);
  const [revisao,setRevisao] = useState<AprovacaoEmissao|null>(null);
  const [conferido,setConferido] = useState(false);
  const carregar = useCallback(async () => {
    const r = await fetch(`/api/admin/aprovacoes?empresa=${empresa}`,{cache:"no-store"});
    const d = await r.json(); if (!r.ok) throw new Error(d.erro); setLista(d.aprovacoes);
  },[empresa]);
  useEffect(() => { const id = requestAnimationFrame(() => void carregar().catch(e=>setAviso(e.message))); return ()=>cancelAnimationFrame(id); },[carregar]);
  async function acao(acao:string,registro?:AprovacaoEmissao,dados?:DadosEmissao) {
    setOcupado(true);setAviso("");
    try {
      const r = await fetch(`/api/admin/aprovacoes?empresa=${empresa}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao,id:registro?.id,versao:registro?.versao,atualizadoEm:registro?.atualizadoEm,dados})});
      const d = await r.json();if(!r.ok)throw new Error(d.erro);
      setRevisao(null);setConferido(false);await carregar();
      setAviso(acao === "aprovar" ? "Aprovação registrada. Nenhum documento foi emitido. Integração fiscal ainda bloqueada; envio de e-mail exige outra aprovação." : "Fila atualizada. Nenhuma emissão ou envio realizado.");
    } catch(e) {setAviso(e instanceof Error?e.message:"Falha na operação.");} finally {setOcupado(false);}
  }
  return <section className="space-y-5">
    <header className="rounded-3xl bg-[#07111f] p-7 text-white"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Etapa 1 · {empresa.toUpperCase()}</p><h2 className="mt-2 text-2xl font-black">Aprovação da emissão</h2><p className="mt-3 text-sm leading-6 text-slate-300">Preparar → aprovar emissão → emitir documentos → aprovar e-mail e PDFs → enviar. A emissão permanece indisponível enquanto a integração fiscal não estiver validada.</p></header>
    {aviso && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{aviso}</p>}
    <div className="rounded-3xl border bg-white p-6"><h3 className="font-black">Preparar a partir de um rascunho</h3><p className="mt-2 text-sm text-slate-600">Cadastre e confira os dados em “Nova emissão”. Importar não significa aprovar.</p>
      {rascunhos.length === 0 && <p className="mt-3 text-sm">Nenhum rascunho local disponível. As notas já emitidas não precisam de aprovação retroativa.</p>}
      {rascunhos.map(r => {
        const existente = lista.find(item => item.dados.clienteDocumento === r.clienteDocumento.replace(/\D/g, "") && item.dados.competencia === r.competencia);
        return <div key={r.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3"><span>{r.clienteNome} · {r.competencia} · {r.valor.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span><button disabled={ocupado} className={button} onClick={()=> {const {id,valor,...dados}=r;void id;void acao(existente ? "alterar" : "criar",existente,{...dados,centavos:Math.round(valor*100)});}}>{existente ? "Atualizar dados e revogar aprovação" : "Colocar na fila de revisão"}</button></div>;
      })}
    </div>
    <div className="rounded-3xl border bg-white p-6"><div className="flex justify-between gap-3"><h3 className="font-black">Fila da empresa</h3><button className={button} disabled={ocupado} onClick={()=>void carregar().catch(e=>setAviso(e.message))}>Atualizar fila</button></div>
      {lista.length === 0 && <p className="mt-4 text-sm text-slate-600">Nenhuma emissão aguardando aprovação.</p>}
      {lista.map(r=><div key={r.id} className="mt-4 border-t pt-4"><strong>{r.dados.clienteNome} · {r.dados.competencia}</strong><p className="my-2 text-sm">Versão {r.versao} · {r.status === "aprovada" ? "Aprovada — aguardando integração" : "Aguardando sua revisão"}</p><button className={button} disabled={ocupado} onClick={()=>{setRevisao(r);setConferido(false);}}>Conferir dados e histórico</button></div>)}
    </div>
    {revisao && <div className="rounded-3xl border-2 border-blue-300 bg-white p-6"><h3 className="text-xl font-black">Conferência antes da emissão</h3><p className="mt-2 text-sm">Empresa: {empresa.toUpperCase()} · versão {revisao.versao}</p><dl className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(revisao.dados).map(([key,value])=><div key={key}><dt className="text-xs text-slate-500">{{clienteNome:"Cliente",clienteDocumento:"CPF/CNPJ",descricao:"Descrição",competencia:"Referência",vencimento:"Vencimento",centavos:"Valor",codigoServico:"Código informado do serviço",aliquota:"Alíquota informada (%)",retencao:"Retenção",gerarCobranca:"Gerar boleto"}[key] || key}</dt><dd className="break-words text-sm font-semibold">{key === "centavos" ? (Number(value)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : typeof value === "boolean" ? value?"Sim":"Não" : String(value)}</dd></div>)}</dl>
      <p className="mt-4 text-sm text-amber-900">Esta revisão não substitui a validação fiscal da DPS. Alterar os dados revoga a aprovação. Nota e boleto atuais não serão substituídos por esta ação.</p>
      {revisao.status === "pendente" ? <><label className="my-4 flex gap-2 text-sm"><input type="checkbox" checked={conferido} onChange={e=>setConferido(e.target.checked)}/>Conferi empresa, cliente, referência, valor, vencimento e dados fiscais desta versão.</label><button className={button} disabled={!conferido || ocupado} onClick={()=>void acao("aprovar",revisao)}>Aprovar esta versão para emissão</button></> : <button className={`${button} mt-4`} disabled={ocupado} onClick={()=>void acao("revogar",revisao)}>Revogar aprovação</button>}
      <details className="mt-5"><summary>Histórico de decisões</summary>{revisao.historico.map((h,i)=><p className="mt-2 text-xs" key={i}>{h.acao} · versão {h.versao} · {h.por} · {new Date(h.em).toLocaleString("pt-BR")}</p>)}</details>
    </div>}
  </section>;
}
