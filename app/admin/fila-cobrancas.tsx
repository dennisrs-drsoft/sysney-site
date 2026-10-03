"use client";
import {useCallback,useEffect,useState} from "react";
import {LaboratorioEmails,type EditorEmailProps} from "./laboratorio-emails";
import type {EmailCobranca} from "@/lib/emails-cobranca";
import {dataBr,hojeBrasil,moeda,type Cobranca} from "@/lib/cobrancas";
import {lerRespostaAdmin} from "@/lib/admin-resposta";
import {MensagemAdmin,useConfirmarAdmin} from "./dialogos-admin";
const button="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-800 disabled:opacity-40";
export function FilaCobrancas(props:EditorEmailProps) {
 const confirmar=useConfirmarAdmin();
 const [cobrancas,setCobrancas]=useState<Cobranca[]>([]),[emails,setEmails]=useState<EmailCobranca[]>([]);
 const [aberta,setAberta]=useState<EmailCobranca|null>(null),[aviso,setAviso]=useState(""),[ocupado,setOcupado]=useState(false);
 const [carregada,setCarregada]=useState(false);
 const carregar=useCallback(async()=>{
  setOcupado(true);setAviso("");setCarregada(false);
  try {
   const [a,b]=await Promise.all([fetch(`/api/admin/cobrancas?empresa=${props.empresa}`,{cache:"no-store"}),fetch(`/api/admin/emails?empresa=${props.empresa}`,{cache:"no-store"})]);
   const c=await lerRespostaAdmin<{cobrancas:Cobranca[];erro?:string}>(a),e=await lerRespostaAdmin<{emails:EmailCobranca[];erro?:string}>(b);
   if(!a.ok||!b.ok)throw new Error(c.erro||e.erro||"Falha ao carregar a fila.");setCobrancas(c.cobrancas);setEmails(e.emails);setCarregada(true);
  }catch(e){setAviso(e instanceof TypeError?"Não foi possível conectar ao painel local. Verifique se o servidor está ativo e clique em Atualizar fila. A consulta não foi concluída; isso não significa que suas cobranças foram apagadas.":e instanceof Error?e.message:"Falha ao carregar.");}finally{setOcupado(false);}
 },[props.empresa]);
 useEffect(()=>{const id=requestAnimationFrame(()=>void carregar());return()=>cancelAnimationFrame(id);},[carregar]);
 async function preparar(c:Cobranca,emailId?:string){
  setOcupado(true);setAviso("");
  try{const r=await fetch(`/api/admin/emails?empresa=${props.empresa}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao:"preparar-cobranca",cobrancaId:c.id,emailId})});const d=await lerRespostaAdmin<{email:EmailCobranca;erro?:string}>(r,true);if(!r.ok)throw new Error(d.erro);setAberta(d.email);}catch(e){setAviso(e instanceof Error?e.message:"Falha ao preparar.");}finally{setOcupado(false);}
 }
 if(aberta)return <section className="space-y-4"><button className={button} onClick={async()=>{if(await confirmar({titulo:"Voltar à fila de cobranças?",subtitulo:"Confira se salvou as alterações da mensagem",descricao:"As alterações não salvas não serão mantidas ao sair do editor. Os documentos já emitidos e os dados salvos da cobrança serão preservados.",confirmar:"Voltar à fila",cancelar:"Continuar revisando",detalhes:[{rotulo:"Cliente",valor:aberta.cliente},{rotulo:"Referência",valor:aberta.competencia.split("-").reverse().join("/")}]})){setAberta(null);void carregar();}}}>← Voltar à fila</button><LaboratorioEmails {...props} inicial={aberta} key={aberta.id}/></section>;
 return <section className="space-y-5"><header className="rounded-3xl bg-[#071b30] p-6 text-white"><p className="text-xs font-bold uppercase text-cyan-300">Operação mensal · {props.empresa.toUpperCase()}</p><h2 className="mt-2 text-2xl font-black">Fila de cobranças</h2><p className="mt-3 text-sm text-slate-200">Previsão → documentos → revisão do e-mail → aprovação → envio. Abrir ou preparar uma cobrança não emite documentos e não envia mensagens.</p></header><p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">As mensalidades são calculadas pela recorrência cadastrada. A preparação por agendamento ainda não está ativa. Abra a cobrança para gerar boleto quando disponível, preparar e testar a NFS-e municipal no painel local, consultar uma tentativa ou registrar documentos manuais. A emissão real depende da integração habilitada para a empresa e de sua aprovação. Após confirmar os documentos, os PDFs oficiais são recuperados automaticamente; se falhar, use Tentar baixar ou o anexo manual, sem reemitir.</p><button className={button} disabled={ocupado} onClick={()=>void carregar()}>{ocupado?"Carregando...":"Atualizar fila"}</button><MensagemAdmin mensagem={aviso} aoFechar={()=>setAviso("")} titulo="Não foi possível atualizar a fila" subtitulo="Suas cobranças salvas serão preservadas" tom="erro" acao={()=>void carregar()} rotuloAcao="Atualizar fila"/>
 {carregada&&!ocupado&&!aviso&&cobrancas.length===0&&<p>Nenhuma cobrança prevista. Cadastre a recorrência em Acompanhamento.</p>}
 <div className="grid gap-4 xl:grid-cols-2">{cobrancas.map(c=>{
  const e=emails.find(e=>e.fluxo?.cobrancaId===c.id);
  const candidatos=emails.filter(e=>!e.fluxo&&["rascunho","revisado"].includes(e.status)&&e.competencia===c.competencia&&e.centavos===c.centavos&&e.vencimento===c.vencimento);
  const status=e?(e.status==="aceito"?"Aceito pelo provedor":e.status==="incerto"||e.status==="enviando"?"Conferir resultado do envio":e.status==="revisado"?"Aprovada para envio":e.fluxo?.documentos?"Aguardando aprovação do e-mail":"Conferir documentos existentes"):c.envioPrevisto>hojeBrasil()?"Programada":"Aguardando preparação";
  return <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase text-blue-700">{status}</p><h3 className="mt-2 font-bold text-slate-900">{c.clienteNome}</h3><p className="mt-3 text-sm">Referência {c.competencia.split("-").reverse().join("/")} · {moeda(c.centavos)}</p><p className="mt-1 text-sm text-slate-600">Preparação prevista: {dataBr(c.envioPrevisto)} · Vencimento: {dataBr(c.vencimento)}</p><p className="mt-2 text-xs">NFS-e {c.nota||"pendente"} · Boleto {c.boleto||"pendente"}</p>{e?<button className={`${button} mt-4`} disabled={ocupado} onClick={()=>setAberta(e)}>Abrir cobrança, documentos e e-mail</button>:<div className="mt-4 space-y-2">{candidatos.map(d=><button key={d.id} className={button} disabled={ocupado} onClick={async()=>{if(await confirmar({titulo:"Vincular rascunho à cobrança?",subtitulo:"Confirme que o rascunho pertence ao cliente correto",descricao:"Datas e valor coincidem, mas você deve conferir a identidade do cliente. Ao vincular, a aprovação anterior será revogada e a mensagem voltará para revisão.",confirmar:"Vincular e revisar",tom:"atencao",detalhes:[{rotulo:"Cobrança",valor:c.clienteNome},{rotulo:"Rascunho",valor:d.cliente},{rotulo:"Referência",valor:c.competencia.split("-").reverse().join("/")},{rotulo:"Valor",valor:moeda(c.centavos)}],observacao:"Nenhuma nota ou boleto será emitido e nenhum e-mail será enviado."}))void preparar(c,d.id);}}>Usar rascunho existente: {d.cliente}</button>)}{candidatos.length===0&&<button className={button} disabled={ocupado} onClick={()=>void preparar(c)}>Preparar para revisão — sem emitir</button>}</div>}</article>;
 })}</div></section>;
}
