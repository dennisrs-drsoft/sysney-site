"use client";
import {useEffect,useState} from "react";
import type {EmailCobranca} from "@/lib/emails-cobranca";
import type {PreviaBoleto} from "@/lib/boleto-painel";
import {dataBr,moeda} from "@/lib/cobrancas";
import {lerRespostaAdmin} from "@/lib/admin-resposta";
import {NotaFiscalCobranca} from "./nota-fiscal-cobranca";
const botao="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-800 disabled:opacity-40";
export function DocumentosCobranca({email,alterado,ocupado,onEmail}:{email:EmailCobranca;alterado:boolean;ocupado:boolean;onEmail:(e:EmailCobranca)=>void}) {
 const [config,setConfig]=useState<{boletoDisponivel:boolean;motivoNfse:string;motivoBoleto:string}|null>(null);
 const [previa,setPrevia]=useState<PreviaBoleto|null>(null),[aviso,setAviso]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let ativo=true;fetch(`/api/admin/documentos?empresa=${email.empresa}`,{cache:"no-store"}).then(async r=>{const d=await lerRespostaAdmin<{boletoDisponivel:boolean;motivoNfse:string;motivoBoleto:string;erro?:string}>(r);if(!r.ok)throw new Error(d.erro);if(ativo)setConfig(d);}).catch(()=>{if(ativo)setAviso("Não foi possível consultar as integrações. Atualize a página.");});return()=>{ativo=false;};},[email.empresa]);
 const finalizado=["aceito","enviando","incerto"].includes(email.status);
 async function executar(acao:string) {
  setBusy(true);setAviso("");
  try {
   const r=await fetch(`/api/admin/documentos?empresa=${email.empresa}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao,id:email.id,atualizadoEm:email.atualizadoEm,previaId:previa?.id,aprovado:acao==="emitir-boleto"})});
   const d=await lerRespostaAdmin<{previa?:PreviaBoleto;email?:EmailCobranca;mensagem?:string;erro?:string}>(r,true);
   if(d.email)onEmail(d.email);
   if(!r.ok)throw new Error(d.erro);
   setPrevia(d.previa || null);setAviso(d.mensagem || "Consulta concluída.");
  }catch(e){setAviso(e instanceof Error?e.message:"Resultado não confirmado. Consulte antes de repetir.");setPrevia(null);}finally{setBusy(false);}
 }
 return <section className="my-4 space-y-4 rounded-2xl border border-blue-200 bg-slate-50 p-4"><h4 className="font-bold">Gerar documentos desta cobrança</h4><p className="text-sm text-slate-600">Preparar o boleto não emite. A emissão exige uma confirmação separada e não envia e-mail. Se houver dúvida no resultado, consulte antes de repetir.</p>
 <div className="grid gap-3 sm:grid-cols-2"><NotaFiscalCobranca key={`${email.empresa}-${email.id}`} email={email} alterado={alterado} ocupado={ocupado||busy} onEmail={onEmail}/>
 <div className="rounded-xl border bg-white p-4"><button type="button" className={botao} disabled={!config?.boletoDisponivel||busy||ocupado||alterado||finalizado||email.status==="emitindo_documento"||!!email.fluxo?.boleto||email.anexos.some(a=>a.tipo==="boleto")} onClick={()=>void executar("preparar-boleto")}>Gerar boleto — revisar dados</button><p className="mt-2 text-xs text-slate-600">{config?.motivoBoleto || "Consultando disponibilidade…"}</p>{config && !config.boletoDisponivel && email.empresa==="sysney" && <p className="mt-2 text-xs text-amber-800">Emissão bancária do painel não habilitada neste ambiente.</p>}</div></div>
 <button type="button" className={botao} disabled={busy||ocupado||alterado||finalizado||email.empresa!=="sysney"|| (!!email.fluxo?.boleto && email.anexos.some(a=>a.tipo==="boleto"))} onClick={()=>void executar("consultar-boleto")}>Consultar resultado / obter PDF — sem reemitir</button>
 {alterado&&<p className="text-xs text-amber-800">Salve as alterações antes de preparar ou consultar documentos.</p>}
 {aviso&&<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{aviso}</p>}
 {previa&&!alterado&&<div className="space-y-3 rounded-xl border border-blue-300 bg-white p-4"><h5 className="font-bold">Confira antes de emitir no Inter</h5><p className="text-sm">{previa.payload.pagador.nome} · CNPJ {previa.documento}</p><p className="text-sm">{[previa.payload.pagador.endereco,previa.payload.pagador.numero,previa.payload.pagador.complemento,previa.payload.pagador.bairro,previa.payload.pagador.cidade,previa.payload.pagador.uf,previa.payload.pagador.cep].filter(Boolean).join(" · ")}</p><p className="font-bold">{moeda(Math.round(previa.payload.valorNominal*100))} · Vencimento {dataBr(previa.payload.dataVencimento)}</p><p className="text-sm">{previa.descricao} · PO {previa.po || "não informada"}</p><p className="text-sm">Multa: {previa.payload.multa.taxa}% · Juros: {previa.payload.mora.taxa}% ao mês · Recebimento por até {previa.payload.numDiasAgenda} dias após o vencimento.</p><p className="text-xs text-slate-500">Pagador e taxas recuperados do histórico bancário para sua conferência. Para condições diferentes, emita manualmente. Esta ação gera um boleto real; não gera NFS-e nem envia e-mail.</p><button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={busy||ocupado||finalizado} onClick={()=>{if(window.confirm("Aprovo os dados exibidos e autorizo emitir este boleto real no Inter, sem enviar e-mail. Continuar?"))void executar("emitir-boleto");}}>Aprovar e emitir este boleto</button></div>}
 </section>;
}
