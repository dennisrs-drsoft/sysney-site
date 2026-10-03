"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { novoEmail, htmlEmail, type EmailCobranca } from "@/lib/emails-cobranca";
import type { Empresa } from "@/lib/cobrancas";
import { lerRespostaAdmin } from "@/lib/admin-resposta";
import styles from "./laboratorio-emails.module.css";
const campo = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-950";
const botao = "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40";
const destaque = "rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40";
const nomes = { rascunho: "Rascunho", revisado: "Revisado", enviando: "Envio em processamento — não repetir", aceito: "Aceito pelo provedor", incerto: "Resultado incerto — conferir provedor" };

export type EditorEmailProps = { empresa: Empresa; clientes: { id: string; nome: string; email: string }[]; carregandoClientes: boolean; erroClientes: string; atualizarClientes: () => Promise<void>; inicial?: EmailCobranca };
export function LaboratorioEmails({ empresa, clientes, carregandoClientes, erroClientes, atualizarClientes, inicial }: EditorEmailProps) {
  const [lista, setLista] = useState<EmailCobranca[]>([]);
  const [email, setEmail] = useState<EmailCobranca>(() => inicial || novoEmail(empresa));
  const [remetente, setRemetente] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [compacto, setCompacto] = useState(false);
  const [envioAberto, setEnvioAberto] = useState(false);
  const bloqueado = !["rascunho", "revisado"].includes(email.status);
  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/emails?empresa=${empresa}`, { cache: "no-store" });
      const d = await lerRespostaAdmin<{emails: EmailCobranca[]; remetente: string; erro?: string}>(r); if (!r.ok) throw new Error(d.erro);
      setLista(d.emails); setRemetente(d.remetente);
    } catch (e) { setAviso(e instanceof Error ? e.message : "Falha na consulta."); }
  }, [empresa]);
  useEffect(() => { const id = requestAnimationFrame(() => void carregar()); return () => cancelAnimationFrame(id); }, [carregar]);
  function mudar<K extends keyof EmailCobranca>(chave: K, valor: EmailCobranca[K]) {
    setEmail(e => ({ ...e, [chave]: valor, status: "rascunho" })); setAlterado(true); setEnvioAberto(false);
  }
  async function executar(acao: string, tipo?: "nota" | "boleto") {
    setOcupado(true); setAviso("");
    try {
      const res = await fetch(`/api/admin/emails?empresa=${empresa}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao, tipo, email, id: email.id, atualizadoEm: email.atualizadoEm, remetente }) });
      const d = await lerRespostaAdmin<{email?: EmailCobranca; mensagem?: string; erro?: string}>(res, true);
      if (d.email) { setEmail(d.email); setAlterado(false); }
      if (!res.ok) throw new Error(d.erro);
      setAviso(d.mensagem || (acao === "salvar" ? "Rascunho salvo." : "Mensagem revisada com os documentos anexos.")); setEnvioAberto(false);
      await carregar();
    } catch(e) { setAviso(e instanceof Error ? e.message : "Falha na operação."); }
    finally { setOcupado(false); }
  }
  async function anexar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setOcupado(true); setAviso("");
    try {
      const data = new FormData(e.currentTarget); data.set("id", email.id);
      const r = await fetch(`/api/admin/emails?empresa=${empresa}`, { method: "POST", body: data });
      const d = await lerRespostaAdmin<{email: EmailCobranca; erro?: string}>(r, true); if (!r.ok) throw new Error(d.erro);
      setEmail(d.email); setAlterado(false); setAviso("PDF anexado. Confira o documento antes de revisar o envio."); await carregar();
    } catch(e) { setAviso(e instanceof Error ? e.message : "Falha ao anexar."); }
    finally { setOcupado(false); }
  }
  function texto(chave: "para" | "cc" | "cliente" | "assunto" | "saudacao" | "introducao" | "descricao" | "observacoes" | "assinatura", nome: string, longo = false) {
    return <label className="block text-sm font-semibold text-slate-700">{nome}{longo ? <textarea className={campo} rows={3} maxLength={2000} value={email[chave]} onChange={e => mudar(chave,e.target.value)}/> : <input disabled={!!email.fluxo && chave === "cliente"} className={campo} maxLength={2000} value={email[chave]} onChange={e => mudar(chave,e.target.value)}/>}</label>;
  }
  return <div className="space-y-5">
    <div className={styles.intro}><div><h2>Revise cada cobrança antes de enviar</h2><p>Ajuste a mensagem, confira os documentos e aprove o envio.</p></div><details><summary>Remetente <strong>{remetente || "configuração pendente"}</strong></summary><p>A prévia é um rascunho; nenhuma mensagem sai ao editar ou salvar. A emissão automática de nota e boleto ainda não está habilitada: anexe documentos já emitidos e conferidos.</p></details></div>
    {aviso && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{aviso}</p>}
    {email.fluxo && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><h3 className="font-bold text-blue-950">{email.fluxo.documentos ? "1. Documentos conferidos → 2. Revisar e aprovar o envio" : "1. Conferir documentos existentes → 2. Revisar e aprovar o envio"}</h3><p className="mt-2 text-sm">NFS-e: {email.fluxo.nota || "Pendente"} · Boleto: {email.fluxo.boleto || "Pendente"}. Esta fila não emite novos documentos. Abra os dois PDFs abaixo e confira cliente, valor, referência e vencimento.</p>{email.fluxo.documentos ? <p className="mt-2 text-xs">Conferência registrada por {email.fluxo.documentos.por} em {new Date(email.fluxo.documentos.em).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}.</p> : <button className={`${destaque} mt-3`} disabled={ocupado || alterado || bloqueado || email.anexos.length < 2} onClick={()=>{if(window.confirm("Conferi os dois PDFs e confirmo que pertencem a esta cobrança. Reutilizar os documentos existentes, sem emitir novamente?"))void executar("conferir-documentos");}}>Confirmar documentos já emitidos</button>}</section>}
    {!inicial && <>
    <div className="flex flex-wrap gap-3"><button className={botao} disabled={ocupado || alterado} onClick={() => { setEmail(novoEmail(empresa)); setEnvioAberto(false); }}>Nova mensagem</button><button className={botao} disabled={ocupado} onClick={() => void carregar()}>Atualizar histórico</button><span className="self-center text-sm text-slate-500">{lista.length} mensagem(ns) salva(s){alterado ? " · salve suas alterações antes de trocar de mensagem" : ""}</span></div>
    {lista.length > 0 && <div className="flex gap-3 overflow-x-auto pb-2">{lista.map(e => <button disabled={alterado || ocupado} key={e.id} className={`${botao} min-w-56 text-left ${e.id === email.id ? "border-blue-600 bg-blue-50" : ""}`} onClick={() => { setEmail(e); setEnvioAberto(false); }}><strong className="block">{e.cliente || "Cliente a confirmar"}</strong><span className="mt-1 block text-xs">{e.competencia || "Competência pendente"} · {nomes[e.status]}</span></button>)}</div>}
    </>}
    <div className={styles.editorGrid}>
      <section className={`${styles.editor} rounded-3xl border border-slate-200 bg-white p-5`}><div className={styles.cardHeading}><div><p>CONFIGURAR MENSAGEM</p><h3 className="font-black">Conteúdo e documentos</h3></div><span className={styles.badge}>{nomes[email.status]}</span></div>
        <fieldset disabled={ocupado || bloqueado} className="mt-5 space-y-4">
          <details open className={styles.group}><summary><span>01</span> Cliente e destinatários</summary><div className={styles.fields}>
          {!email.fluxo && <label className="block text-sm font-semibold">Preencher cliente · {empresa.toUpperCase()}<select className={campo} disabled={carregandoClientes} value={clientes.find(c => c.nome === email.cliente)?.id || ""} onChange={e => { const c = clientes.find(c => c.id === e.target.value); if (c) { setEmail(x => ({ ...x, cliente:c.nome, para:c.email, status:"rascunho" })); setAlterado(true); setEnvioAberto(false); } }}><option value="">{carregandoClientes ? "Carregando clientes..." : "Selecione um cliente"}</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>}
          {erroClientes && <p role="alert" className="text-sm text-amber-800">{erroClientes}</p>}
          {!carregandoClientes && clientes.length === 0 && <p className="text-sm text-slate-600">Nenhum cliente disponível para {empresa.toUpperCase()}. Confira a empresa no menu. Você também pode preencher os dados abaixo manualmente.</p>}
          <button className={botao} disabled={carregandoClientes} onClick={() => void atualizarClientes()}>Atualizar clientes</button>
          {texto("cliente","Cliente")}{texto("para","Para (separe e-mails por ponto e vírgula)")}{texto("cc","Cópia (opcional)")}
          <label className="block text-sm font-semibold">Receber respostas em<input type="email" className={campo} maxLength={254} value={email.responderPara || ""} onChange={e => mudar("responderPara",e.target.value)}/></label>
          </div></details>
          <details open className={styles.group}><summary><span>02</span> Dados da cobrança</summary><div className={styles.fields}>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Competência<input disabled={!!email.fluxo} type="month" className={campo} value={email.competencia} onChange={e => mudar("competencia",e.target.value)}/></label><label className="text-sm font-semibold">Valor (R$)<input disabled={!!email.fluxo} type="number" min="0" step="0.01" className={campo} value={email.centavos/100 || ""} onChange={e => mudar("centavos",Math.round(Number(e.target.value)*100))}/></label></div>
          <label className="block text-sm font-semibold">Vencimento<input disabled={!!email.fluxo} type="date" className={campo} value={email.vencimento} onChange={e => mudar("vencimento",e.target.value)}/></label>
          {texto("descricao","Descrição do serviço")}
          </div></details>
          <details className={styles.group}><summary><span>03</span> Texto e apresentação</summary><div className={styles.fields}>
          {texto("assunto","Assunto")}{texto("saudacao","Saudação")}{texto("introducao","Introdução",true)}{texto("observacoes","Observações",true)}{texto("assinatura","Assinatura",true)}
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={email.detalhado} onChange={e => mudar("detalhado",e.target.checked)}/>Mostrar cliente e descrição detalhada</label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={email.confirmarRecebimento} onChange={e => mudar("confirmarRecebimento",e.target.checked)}/>Destacar pedido de confirmação de recebimento</label>
          </div></details>
          <button className={`${destaque} w-full`} onClick={() => void executar("salvar")}>Salvar rascunho</button>
        </fieldset>
        {email.id && !email.fluxo && <button className={`${botao} mt-4`} disabled={ocupado || alterado || email.status === "incerto" || email.status === "enviando"} onClick={() => void executar("duplicar")}>Duplicar para revisar ou reenviar</button>}
        <div className={styles.documents}><h3 className="font-black">04 · Documentos e aprovação</h3><p className="mt-1 text-xs text-slate-500">Confira empresa, cliente, competência, valor e vencimento nos dois PDFs.</p>
        {email.anexos.map(a => <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" key={a.tipo}><a target="_blank" rel="noreferrer" className="break-words text-blue-700 underline" href={`/api/admin/emails?empresa=${empresa}&id=${email.id}&anexo=${a.tipo}`}>{a.tipo === "nota" ? "NFS-e" : "Boleto"}: {a.nome}</a><button className={botao} disabled={alterado || ocupado || bloqueado} onClick={() => { if (window.confirm(`Remover ${a.nome} desta mensagem? Será necessário anexar o documento correto e aprovar novamente.`)) void executar("remover-anexo", a.tipo); }}>Remover {a.tipo === "nota" ? "nota" : "boleto"}</button></div>)}
        <p className="mt-3 text-xs text-slate-500">Para substituir, selecione o mesmo tipo e anexe o PDF correto. Isso substitui apenas o anexo desta mensagem; não cancela a nota ou o boleto emitido.</p>
        <form onSubmit={anexar} className="mt-4"><fieldset disabled={!email.id || alterado || ocupado || bloqueado} className="space-y-3"><label className="block text-sm">Documento<select name="tipo" className={campo}><option value="nota">Nota fiscal (PDF)</option><option value="boleto">Boleto (PDF)</option></select></label><input aria-label="PDF do documento" name="arquivo" type="file" accept="application/pdf" required className="w-full text-sm"/><button className={botao}>Anexar PDF</button></fieldset></form>
        <p className="mt-5 text-sm text-slate-600">Etapa 2: confira o remetente, destinatários e abra os dois PDFs antes de aprovar. Alterações exigem nova aprovação. Esta aprovação não emite documentos.</p>
        {email.aprovacaoEnvio && !alterado && <p className="mt-2 text-xs text-blue-800">Última aprovação: {email.aprovacaoEnvio.por} · {new Date(email.aprovacaoEnvio.em).toLocaleString("pt-BR")} · remetente {email.aprovacaoEnvio.remetente}</p>}
        <button className={`${destaque} mt-5`} disabled={!email.id || alterado || ocupado || bloqueado || !remetente || (!!email.fluxo && !email.fluxo.documentos)} onClick={() => void executar("revisar")}>Aprovar e-mail e PDFs para envio</button>
        <button className={`${botao} mt-3`} disabled={email.status !== "revisado" || alterado || ocupado || !remetente} onClick={() => setEnvioAberto(true)}>Preparar envio real</button>
        {envioAberto && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm"><p>Enviar agora de <strong>{remetente}</strong> para <strong>{email.para}</strong>{email.cc ? `, com cópia para ${email.cc}` : ""}, com nota, boleto e logo?</p><button className={`${destaque} mt-3`} disabled={ocupado} onClick={() => void executar("enviar")}>Enviar este e-mail agora</button></div>}
        </div>
      </section>
      <section className={`${styles.preview} rounded-3xl border border-slate-200 bg-white p-4`}><div className={styles.cardHeading}><div><p>VISUALIZAÇÃO AO VIVO</p><h3 className="font-black">Assim o cliente vai receber</h3></div><button className={botao} onClick={() => setCompacto(!compacto)}>{compacto ? "Ver computador" : "Ver celular"}</button></div><div className={styles.previewCanvas}><iframe title="Prévia do e-mail de cobrança" sandbox="" srcDoc={htmlEmail(email,"/logo.png")} className={`mx-auto h-[780px] max-w-full rounded-xl border border-slate-200 ${compacto ? "w-[375px]" : "w-full"}`}/></div>
        <h3 className="mt-5 font-black">Envios desta mensagem</h3>{email.tentativas.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nenhum envio realizado.</p> : email.tentativas.map(t => <details key={t.id} className="mt-3 rounded-xl border p-3"><summary className="cursor-pointer text-sm">{new Date(t.data).toLocaleString("pt-BR")} · {t.status} · {t.destino}</summary><p className="my-2 text-xs">{t.assunto} · {t.messageId || "Sem confirmação do provedor"}</p><iframe sandbox="" title={`Mensagem enviada ${t.id}`} className="h-[750px] w-full" srcDoc={t.html}/></details>)}
      </section>
    </div>
  </div>;
}
