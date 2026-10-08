"use client";
import { useCallback, useEffect, useState } from "react";
import { moeda, dataBr, pago, type Cobranca } from "@/lib/cobrancas";
import { lerRespostaAdmin } from "@/lib/admin-resposta";
import { MensagemAdmin, useConfirmarAdmin } from "./dialogos-admin";
type Dados={documento:string;consulta:string;regra:{inicio:string;fim:string;automatica:boolean}|null;vinculo:{data:string;pixId:string;modo:string}|null;recebimentos:{id:string;data:string;horario:string;cliente:string;centavos:number;compativel:boolean}[]};
const campo="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm";
const botao="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50";
export function ConciliacaoPix({c,aoAtualizar}:{c:Cobranca;aoAtualizar:()=>void}){
  const [dados,setDados]=useState<Dados|null>(null),[inicio,setInicio]=useState(`${c.vencimento.slice(0,7)}-01`),[fim,setFim]=useState(()=>new Date(Date.UTC(Number(c.vencimento.slice(0,4)),Number(c.vencimento.slice(5,7)),0)).toISOString().slice(0,10)),[automatica,setAutomatica]=useState(false),[ocupado,setOcupado]=useState(false),[erro,setErro]=useState(""),[aviso,setAviso]=useState("");
  const confirmar=useConfirmarAdmin();
  const carregar=useCallback(async()=>{
    try{
      const r=await fetch(`/api/admin/historico-inter?empresa=sysney&pix=1&id=${encodeURIComponent(c.id)}`,{cache:"no-store",signal:AbortSignal.timeout(45000)});
      const d=await lerRespostaAdmin<Dados&{erro?:string}>(r);if(!r.ok||!Array.isArray(d.recebimentos)||typeof d.documento!=="string")throw Error(d.erro||"A conciliação PIX ainda não está disponível nesta versão do servidor. Atualize após a publicação.");
      setDados(d);if(d.regra){setInicio(d.regra.inicio);setFim(d.regra.fim);setAutomatica(d.regra.automatica);}
    }catch(e){setErro(e instanceof Error?e.message:"Consulta indisponível.");}
  },[c.id]);
  useEffect(()=>{const id=requestAnimationFrame(()=>void carregar());return()=>cancelAnimationFrame(id);},[carregar]);
  async function executar(acao:string,pixId?:string){
    if(ocupado)return;
    const ok=await confirmar({titulo:acao==="regra-pix"?"Salvar conciliação desta cobrança":"Confirmar recebimento por PIX",subtitulo:"Vínculo com o extrato do Banco Inter",descricao:acao==="regra-pix"?"A baixa automática exige um único PIX do CNPJ do cliente, com valor integral e data dentro do período autorizado. Mais de uma possibilidade fica para revisão. Esta regra vale somente para esta cobrança.":"Este recebimento será reservado para esta cobrança. Não será criado boleto, nota ou novo envio de e-mail.",detalhes:[{rotulo:"Cliente",valor:c.clienteNome},{rotulo:"CNPJ / CPF do pagador",valor:dados?.documento||"A confirmar"},{rotulo:"Valor",valor:moeda(c.centavos)},{rotulo:"Período",valor:`${dataBr(inicio)} a ${dataBr(fim)}`},{rotulo:"Baixa automática",valor:automatica?"Autorizada nesta cobrança":"Desativada"}],confirmar:"Confirmar vínculo / regra",observacao:"Pagamento por outra pessoa, valor parcial ou fora do período exige conferência. A regra não se aplica automaticamente a futuras mensalidades."});
    if(!ok)return;
    setOcupado(true);setErro("");
    try{
      const r=await fetch("/api/admin/historico-inter?empresa=sysney",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao,id:c.id,inicio,fim,automatica,pixId}),signal:AbortSignal.timeout(45000)});
      const d=await lerRespostaAdmin<{erro?:string}>(r);if(!r.ok)throw Error(d.erro||"Não foi possível salvar a conciliação.");
      setAviso(acao==="regra-pix"?"Regra salva. A próxima consulta automática ao Inter tentará conciliar os PIX recebidos, sem emitir ou enviar documentos.":"Recebimento vinculado. Atualize o acompanhamento para conferir a baixa.");await carregar();aoAtualizar();
    }catch(e){setErro(e instanceof Error?e.message:"Conciliação não concluída. Consulte antes de repetir.");}finally{setOcupado(false);}
  }
  const quitada=pago(c)>0||!!dados?.vinculo;
  return <section className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/40 p-5">
    <h4 className="font-bold text-slate-900">Conciliação PIX · Banco Inter</h4><p className="mt-2 text-sm text-slate-600">PIX direto à chave CNPJ pode ser reconhecido pelo extrato. Configure o período esperado e autorize a regra; não é necessário gerar boleto.</p>
    {dados?.vinculo?<p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Recebimento vinculado em {dataBr(dados.vinculo.data)} · {dados.vinculo.modo}<br/><span className="break-all text-xs">{dados.vinculo.pixId}</span></p>:<>
    <p className="mt-3 text-xs text-slate-500">Pagador esperado: {dados?.documento||"Carregando…"} · {moeda(c.centavos)}. O e-mail da cobrança deve estar configurado para PIX.</p>
    <fieldset disabled={ocupado||quitada||!dados} className="mt-4 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Data inicial<input type="date" className={campo} value={inicio} onChange={e=>setInicio(e.target.value)}/></label><label className="text-sm">Data final<input type="date" className={campo} value={fim} onChange={e=>setFim(e.target.value)}/></label></div>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={automatica} onChange={e=>setAutomatica(e.target.checked)}/>Autorizar baixa automática quando o recebimento for único e compatível</label>
    <button className={botao} onClick={()=>void executar("regra-pix")}>Salvar regra de conciliação</button></fieldset>
    <h5 className="mt-5 text-sm font-bold">Recebimentos encontrados do mesmo pagador e valor</h5>
    {dados?.recebimentos.map(p=><div key={p.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-100 bg-white p-3"><div><p className="text-sm">{dataBr(p.data)} · {moeda(p.centavos)} · {p.cliente}</p><p className="mt-1 break-all text-xs text-slate-500">{p.id}</p></div><button className={botao} disabled={ocupado||quitada||!p.compativel} onClick={()=>void executar("vincular-pix",p.id)}>Confirmar vínculo</button></div>)}
    {!!dados&&!dados.recebimentos.length&&<p className="mt-3 text-sm text-slate-500">Nenhum PIX livre do mesmo pagador e valor na última consulta. Isso não comprova falta de pagamento: confira o período consultado e o extrato.</p>}
    <p className="mt-3 text-xs text-slate-500">Para confirmar um vínculo, salve primeiro o período. Pagamentos manuais existentes são preservados e não somados novamente.</p></>}
    <p className="mt-3 text-xs text-slate-500">Extrato consultado: {dados?.consulta?new Date(dados.consulta).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"Ainda não consultado por esta rotina"}. Consulta cobre os últimos 90 dias.</p>
    <button className={`${botao} mt-3`} disabled={ocupado} onClick={()=>void carregar()}>Atualizar recebimentos salvos</button>
    <MensagemAdmin mensagem={erro} titulo="Confira a conciliação PIX" subtitulo="A baixa não foi confirmada por esta ação" tom="erro" aoFechar={()=>setErro("")}/><MensagemAdmin mensagem={aviso} titulo="Conciliação PIX atualizada" subtitulo="Nenhuma emissão ou envio realizado" aoFechar={()=>setAviso("")}/>
  </section>;
}
