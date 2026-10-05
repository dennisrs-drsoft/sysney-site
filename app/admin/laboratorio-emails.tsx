"use client";
import {MensagemAdmin,ModalAdmin,useConfirmarAdmin} from "./dialogos-admin";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { novoEmail, htmlEmail, resolverTextoEmail, documentosCompletos, nomesAnexos, type AnexoEmail, valorFormatado, valorDigitado, type EmailCobranca } from "@/lib/emails-cobranca";
import type { Empresa } from "@/lib/cobrancas";
import { lerRespostaAdmin } from "@/lib/admin-resposta";
import styles from "./laboratorio-emails.module.css";
import {DocumentosCobranca} from "./documentos-cobranca";
const campo = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-950";
const botao = "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40";
const destaque = "rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40";
const nomes = { rascunho: "Rascunho", revisado: "Revisado", enviando: "Envio em processamento — não repetir", aceito: "Aceito pelo provedor", incerto: "Resultado incerto — conferir provedor", emitindo_documento:"Emissão em andamento — consultar resultado" };

export type EditorEmailProps = { empresa: Empresa; clientes: { id: string; nome: string; email: string }[]; carregandoClientes: boolean; erroClientes: string; atualizarClientes: () => Promise<void>; inicial?: EmailCobranca };
export function LaboratorioEmails({ empresa, clientes, carregandoClientes, erroClientes, atualizarClientes, inicial }: EditorEmailProps) {
  const confirmar=useConfirmarAdmin();
  const [lista, setLista] = useState<EmailCobranca[]>([]);
  const [email, setEmail] = useState<EmailCobranca>(() => inicial || novoEmail(empresa));
  const [remetente, setRemetente] = useState("");
  const [auditoria, setAuditoria] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [compacto, setCompacto] = useState(false);
  const [envioAberto, setEnvioAberto] = useState(false);
  const [novoVencimento, setNovoVencimento] = useState("");
  const pix = email.formaPagamento === "pix";
  const bloqueado = !["rascunho", "revisado"].includes(email.status);
  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/emails?empresa=${empresa}`, { cache: "no-store" });
      const d = await lerRespostaAdmin<{emails: EmailCobranca[]; remetente: string; auditoria?: string; erro?: string}>(r); if (!r.ok) throw new Error(d.erro);
      setLista(d.emails); setRemetente(d.remetente); setAuditoria(d.auditoria || "");
    } catch (e) { setAviso(e instanceof Error ? e.message : "Falha na consulta."); }
  }, [empresa]);
  useEffect(() => { const id = requestAnimationFrame(() => void carregar()); return () => cancelAnimationFrame(id); }, [carregar]);
  function mudar<K extends keyof EmailCobranca>(chave: K, valor: EmailCobranca[K]) {
    setEmail(e => ({ ...e, [chave]: valor, status: "rascunho" })); setAlterado(true); setEnvioAberto(false);
  }
  async function executar(acao: string, tipo?: AnexoEmail["tipo"], numero?: string, vencimento?: string) {
    setOcupado(true); setAviso("");
    try {
      const res = await fetch(`/api/admin/emails?empresa=${empresa}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao, tipo, numero, vencimento, email, id: email.id, atualizadoEm: email.atualizadoEm, remetente, auditoria }) });
      const d = await lerRespostaAdmin<{email?: EmailCobranca; mensagem?: string; erro?: string}>(res, true);
      if (d.email) { setEmail(d.email); setAlterado(false); setNovoVencimento(""); }
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
    <div className={styles.intro}><div><h2>Revise cada cobrança antes de enviar</h2><p>Ajuste a mensagem, confira os documentos e aprove o envio.</p></div><details><summary>Remetente <strong>{remetente || "configuração pendente"}</strong></summary><p>A prévia é um rascunho; nenhuma mensagem sai ao editar ou salvar. A geração automática por agendamento não está ativa. Na cobrança, revise a emissão bancária quando disponível ou registre os documentos emitidos manualmente.</p></details></div>
    <MensagemAdmin mensagem={aviso} aoFechar={()=>setAviso("")} titulo="Revisão da cobrança" subtitulo="Resultado da operação com e-mail e documentos"/>
    {email.fluxo && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><h3 className="font-bold text-blue-950">{email.fluxo.documentos ? "1. Documentos conferidos → 2. Revisar e aprovar o envio" : "1. Conferir documentos existentes → 2. Revisar e aprovar o envio"}</h3><p className="mt-2 text-sm">NFS-e: {email.fluxo.nota || "Pendente"} · {pix ? "PIX — sem boleto" : `Boleto: ${email.fluxo.boleto || "Pendente"}`}. Use as ações de geração abaixo quando disponíveis. Abra os PDFs exigidos pela forma de pagamento e confira cliente, valor, referência, PO e vencimento.</p>{email.fluxo.documentos ? <p className="mt-2 text-xs">Conferência registrada por {email.fluxo.documentos.por} em {new Date(email.fluxo.documentos.em).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}.</p> : <button className={`${destaque} mt-3`} disabled={ocupado || alterado || bloqueado || !documentosCompletos(email)} onClick={async()=>{if(await confirmar({titulo:"Confirmar documentos conferidos?",subtitulo:pix ? "Nota fiscal e ordem de serviço — pagamento via PIX" : "Reutilização da nota e do boleto já emitidos",descricao:"Confirme que abriu os PDFs exigidos pela forma de pagamento e verificou empresa, cliente, referência, valor, PO e vencimento. Essa etapa registra sua conferência; não gera novos documentos.",confirmar:"Confirmar conferência",detalhes:[{rotulo:"Cliente",valor:email.cliente},{rotulo:"Nota",valor:email.fluxo?.nota||"Pendente"},{rotulo:pix?"Pagamento":"Boleto",valor:pix?`PIX · ${email.pixChave} · ${email.pixBeneficiario}`:email.fluxo?.boleto||"Pendente"},{rotulo:"Referência",valor:email.competencia.split("-").reverse().join("/")}],observacao:"O envio do e-mail ainda depende de revisão e aprovação separadas."}))void executar("conferir-documentos");}}>Confirmar documentos já emitidos</button>}</section>}
    {!inicial && <>
    <div className="flex flex-wrap gap-3"><button className={botao} disabled={ocupado || alterado} onClick={() => { setEmail(novoEmail(empresa)); setEnvioAberto(false); }}>Nova mensagem</button><button className={botao} disabled={ocupado} onClick={() => void carregar()}>Atualizar histórico</button><span className="self-center text-sm text-slate-500">{lista.length} mensagem(ns) salva(s){alterado ? " · salve suas alterações antes de trocar de mensagem" : ""}</span></div>
    {lista.length > 0 && <div className="flex gap-3 overflow-x-auto pb-2">{lista.map(e => <button disabled={alterado || ocupado} key={e.id} className={`${botao} min-w-56 text-left ${e.id === email.id ? "border-blue-600 bg-blue-50" : ""}`} onClick={() => { setEmail(e); setEnvioAberto(false); }}><strong className="block">{e.cliente || "Cliente a confirmar"}</strong><span className="mt-1 block text-xs">{e.competencia || "Competência pendente"} · {nomes[e.status]}</span></button>)}</div>}
    </>}
    <div className={styles.editorGrid}>
      <section className={`${styles.editor} rounded-3xl border border-slate-200 bg-white p-5`}><div className={styles.cardHeading}><div><p>CONFIGURAR MENSAGEM</p><h3 className="font-black">Conteúdo e documentos</h3></div><span className={styles.badge}>{nomes[email.status]}</span></div>
        <fieldset disabled={ocupado || bloqueado} className="mt-5 space-y-4">
          <details open className={styles.group}><summary><span>01</span> Cliente e destinatários</summary><div className={styles.fields}>
          {!email.fluxo && <label className="block text-sm font-semibold">Preencher cliente · {empresa.toUpperCase()}<select className={campo} disabled={carregandoClientes} value={clientes.find(c => c.nome === email.cliente)?.id || ""} onChange={e => { const c = clientes.find(c => c.id === e.target.value); if (c) { setEmail(x => ({ ...x, cliente:c.nome, para:c.email, status:"rascunho" })); setAlterado(true); setEnvioAberto(false); } }}><option value="">{carregandoClientes ? "Carregando clientes..." : "Selecione um cliente"}</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>}
          <MensagemAdmin mensagem={erroClientes} aoFechar={()=>{}} titulo="Clientes não disponíveis" subtitulo="A consulta à base de clientes não foi concluída" tom="erro" acao={()=>void atualizarClientes()} rotuloAcao="Atualizar clientes"/>
          {!carregandoClientes && clientes.length === 0 && <p className="text-sm text-slate-600">Nenhum cliente disponível para {empresa.toUpperCase()}. Confira a empresa no menu. Você também pode preencher os dados abaixo manualmente.</p>}
          <button className={botao} disabled={carregandoClientes} onClick={() => void atualizarClientes()}>Atualizar clientes</button>
          {texto("cliente","Cliente")}{texto("para","Para (separe e-mails por ponto e vírgula)")}{texto("cc","Cópia (opcional)")}
          <label className="block text-sm font-semibold">Pessoa de contato<input className={campo} maxLength={120} placeholder="Ex.: Marcelo" value={email.contato || ""} onChange={e=>mudar("contato",e.target.value)}/></label>
          {auditoria && <p className="text-sm text-slate-600">Cópia oculta automática de auditoria: <strong>{auditoria}</strong>. Se já estiver em Para ou Cópia, não será duplicada.</p>}
          <label className="block text-sm font-semibold">Receber respostas em<input type="email" className={campo} maxLength={254} value={email.responderPara || ""} onChange={e => mudar("responderPara",e.target.value)}/></label>
          </div></details>
          <details open className={styles.group}><summary><span>02</span> Dados da cobrança</summary><div className={styles.fields}>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Competência<input disabled={!!email.fluxo} type="month" className={campo} value={email.competencia} onChange={e => mudar("competencia",e.target.value)}/></label><label className="text-sm font-semibold">Valor (R$)<input disabled={!!email.fluxo} type="text" inputMode="decimal" className={campo} value={valorFormatado(email.centavos)} onChange={e => {const v=valorDigitado(e.target.value);if(v!==null)mudar("centavos",v);}}/></label></div>
          <label className="block text-sm font-semibold">Pedido de compra (PO)<input className={campo} maxLength={120} placeholder="Ex.: 069825" value={email.po || ""} onChange={e=>mudar("po",e.target.value)}/><span className="text-xs font-normal text-slate-500">Aparece em destaque no demonstrativo. Confira também a PO nos PDFs.</span></label>
          <label className="block text-sm font-semibold">Vencimento<input disabled={!!email.fluxo} type="date" className={campo} value={email.vencimento} onChange={e => mudar("vencimento",e.target.value)}/></label>
          {email.fluxo && <details className="rounded-xl border border-blue-200 bg-blue-50 p-3"><summary className="cursor-pointer text-sm font-bold">Alterar vencimento desta cobrança</summary><p className="mt-2 text-xs">Antes de emitir documentos ou enviar, escolha outra data. Esta alteração não muda a recorrência dos próximos meses e exige nova revisão. Documentos ou tentativas já registrados impedem a alteração.</p><label className="mt-3 block text-sm font-semibold">Novo vencimento<input type="date" className={campo} value={novoVencimento} onChange={e=>setNovoVencimento(e.target.value)}/></label><button type="button" className={`${botao} mt-3`} disabled={alterado || !novoVencimento || novoVencimento===email.vencimento} onClick={async()=>{if(await confirmar({titulo:"Alterar vencimento da cobrança?",subtitulo:"Somente esta competência será ajustada",descricao:"O vencimento será atualizado na cobrança e no e-mail salvo. A aprovação anterior será revogada; revise novamente antes de emitir ou enviar. Esta ação não altera documentos já emitidos.",confirmar:"Salvar novo vencimento",tom:"atencao",detalhes:[{rotulo:"Cliente",valor:email.cliente},{rotulo:"De",valor:email.vencimento.split("-").reverse().join("/")},{rotulo:"Para",valor:novoVencimento.split("-").reverse().join("/")}],observacao:"Nenhum boleto, nota fiscal ou e-mail será emitido por esta alteração."}))void executar("alterar-vencimento",undefined,undefined,novoVencimento);}}>Salvar novo vencimento</button>{alterado&&<p className="mt-2 text-xs">Salve primeiro as alterações do rascunho.</p>}</details>}
          <label className="block text-sm font-semibold">Forma de pagamento<select className={campo} value={email.formaPagamento || "boleto"} onChange={e=>mudar("formaPagamento",e.target.value as "boleto"|"pix")}><option value="boleto">Boleto</option><option value="pix">PIX — nota e ordem de serviço, sem boleto</option></select></label>
          {pix && <><label className="block text-sm font-semibold">Chave PIX<input className={campo} maxLength={150} value={email.pixChave || ""} onChange={e=>mudar("pixChave",e.target.value)}/></label><label className="block text-sm font-semibold">Beneficiário do PIX<input className={campo} maxLength={150} value={email.pixBeneficiario || ""} onChange={e=>mudar("pixBeneficiario",e.target.value)}/></label><p className="text-xs text-blue-800">Para PIX, anexe a nota fiscal e a ordem de serviço. Alterar estes dados exige nova conferência e aprovação.</p></>}
          {texto("descricao","Descrição do serviço")}
          </div></details>
          <details className={styles.group}><summary><span>03</span> Texto e apresentação</summary><div className={styles.fields}>
          {texto("assunto","Assunto")}{texto("saudacao","Saudação")}{texto("introducao","Introdução",true)}{texto("observacoes","Observações",true)}{texto("assinatura","Assinatura",true)}
          <p className="text-xs text-slate-600">Variáveis para assunto e saudação: {"{{empresa}}, {{competencia}}, {{contato}}, {{cliente}}, {{po}}, {{valor}}, {{vencimento}}"}. A prévia e o envio usam os valores atuais; textos fixos são preservados.</p>
          <p className="rounded-lg bg-blue-50 p-3 text-sm"><strong>Assunto que será enviado:</strong> {resolverTextoEmail(email.assunto,email)}</p>
          <button type="button" className={botao} onClick={()=>mudar("saudacao","Olá, {{contato}}, tudo bem?")}>Usar contato na saudação</button>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={email.detalhado} onChange={e => mudar("detalhado",e.target.checked)}/>Mostrar cliente e descrição detalhada</label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={email.confirmarRecebimento} onChange={e => mudar("confirmarRecebimento",e.target.checked)}/>Destacar pedido de confirmação de recebimento</label>
          </div></details>
          <button className={`${destaque} w-full`} onClick={() => void executar("salvar")}>Salvar rascunho</button>
        </fieldset>
        {email.id && !email.fluxo && <button className={`${botao} mt-4`} disabled={ocupado || alterado || email.status === "incerto" || email.status === "enviando"} onClick={() => void executar("duplicar")}>Duplicar para revisar ou reenviar</button>}
        <div className={styles.documents}><h3 className="font-black">04 · Documentos e aprovação</h3><p className="mt-1 text-xs text-slate-500">Confira empresa, cliente, competência, valor e vencimento nos PDFs exigidos pela forma de pagamento.</p>
        {email.fluxo && <DocumentosCobranca email={email} alterado={alterado} ocupado={ocupado} onEmail={e=>{setEmail(e);setAlterado(false);setEnvioAberto(false);void carregar();}}/>}
        {email.fluxo && <details className="my-4 rounded-xl border border-blue-200 bg-blue-50 p-4"><summary className="cursor-pointer text-sm font-bold">Nota ou boleto emitido manualmente?</summary><p className="mt-2 text-sm">Se uma integração não estiver disponível, emita pelo portal da Prefeitura ou pelo banco. Registre aqui cada documento já emitido, separadamente, e depois anexe o PDF. O outro documento pode continuar pendente; o envio só será liberado após conferir ambos.</p><form className="mt-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void executar("registrar-documento-manual",f.get("tipo") as "nota"|"boleto",String(f.get("numero")));}}><fieldset disabled={alterado||ocupado||bloqueado}><label className="block text-sm">Tipo<select name="tipo" className={campo}><option value="nota">Nota fiscal já emitida</option>{!pix && <option value="boleto">Boleto já emitido</option>}</select></label><label className="mt-3 block text-sm">Número da nota / nosso número do boleto<input name="numero" required maxLength={120} className={campo}/></label><button className={`${botao} mt-3`}>Registrar documento existente</button></fieldset></form></details>}
        {email.anexos.map(a => <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" key={a.tipo}><a target="_blank" rel="noreferrer" className="break-words text-blue-700 underline" href={`/api/admin/emails?empresa=${empresa}&id=${email.id}&anexo=${a.tipo}`}>{nomesAnexos[a.tipo]}: {a.nome}</a><button className={botao} disabled={alterado || ocupado || bloqueado} onClick={async() => { if (await confirmar({titulo:"Remover anexo da cobrança?",subtitulo:"Somente o arquivo desta mensagem será removido",descricao:"O anexo selecionado deixará de acompanhar este e-mail. Será necessário anexar o PDF correto, conferir os documentos e aprovar novamente antes do envio.",confirmar:"Remover este anexo",tom:"atencao",detalhes:[{rotulo:"Cliente",valor:email.cliente},{rotulo:"Documento",valor:nomesAnexos[a.tipo]},{rotulo:"Arquivo",valor:a.nome}],observacao:"Isso não cancela a nota fiscal nem o boleto emitido. O documento original e o histórico de envios serão preservados."})) void executar("remover-anexo", a.tipo); }}>Remover {nomesAnexos[a.tipo].toLowerCase()}</button></div>)}
        <p className="mt-3 text-xs text-slate-500">Para substituir, selecione o mesmo tipo e anexe o PDF correto. Isso substitui apenas o anexo desta mensagem; não cancela a nota ou o boleto emitido.</p>
        <form onSubmit={anexar} className="mt-4"><fieldset disabled={!email.id || alterado || ocupado || bloqueado} className="space-y-3"><label className="block text-sm">Documento<select name="tipo" className={campo}><option value="nota">Nota fiscal (PDF)</option>{!pix && <option value="boleto">Boleto (PDF)</option>}<option value="ordem-servico">Ordem de serviço (PDF)</option></select></label><input aria-label="PDF do documento" name="arquivo" type="file" accept="application/pdf" required className="w-full text-sm"/><button className={botao}>Anexar PDF</button></fieldset></form>
        <p className="mt-5 text-sm text-slate-600">Etapa 2: confira o remetente, destinatários e abra os PDFs exigidos pela forma de pagamento antes de aprovar. Alterações exigem nova aprovação. Esta aprovação não emite documentos.</p>
        {email.aprovacaoEnvio && !alterado && <p className="mt-2 text-xs text-blue-800">Última aprovação: {email.aprovacaoEnvio.por} · {new Date(email.aprovacaoEnvio.em).toLocaleString("pt-BR")} · remetente {email.aprovacaoEnvio.remetente}</p>}
        <button className={`${destaque} mt-5`} disabled={!email.id || alterado || ocupado || bloqueado || !remetente || (!!email.fluxo && !email.fluxo.documentos)} onClick={async() => {if(await confirmar({titulo:"Aprovar e-mail e documentos?",subtitulo:"Autorizar esta versão para a próxima etapa de envio",descricao:"Confirme que conferiu o corpo do e-mail, os destinatários e os PDFs exigidos pela forma de pagamento anexados. A aprovação ficará vinculada a esta versão; mudanças exigirão uma nova revisão.",confirmar:"Aprovar esta versão",detalhes:[{rotulo:"Cliente",valor:email.cliente},{rotulo:"Remetente",valor:remetente},{rotulo:"Para",valor:email.para},{rotulo:"Assunto",valor:resolverTextoEmail(email.assunto,email)},{rotulo:"Anexos",valor:email.anexos.map(a=>a.nome).join("\n")}],observacao:"Aprovar não envia e-mail e não emite documentos. O envio real terá outra confirmação separada."}))void executar("revisar");}}>Aprovar e-mail e PDFs para envio</button>
        <button className={`${botao} mt-3`} disabled={email.status !== "revisado" || alterado || ocupado || !remetente} onClick={() => setEnvioAberto(true)}>Preparar envio real</button>
        <ModalAdmin aberto={envioAberto} aoFechar={()=>setEnvioAberto(false)} aoConfirmar={()=>{setEnvioAberto(false);void executar("enviar");}} titulo="Enviar cobrança ao cliente?" subtitulo="Última conferência antes do envio real" descricao="O cliente receberá o corpo HTML que você revisou, com o logo, os documentos anexados (nota e ordem de serviço para PIX; nota e boleto para boleto). Confira os destinatários e o assunto abaixo antes de autorizar." confirmar="Enviar este e-mail agora" cancelar="Voltar e revisar" tom="atencao" detalhes={[{rotulo:"Empresa",valor:empresa.toUpperCase()},{rotulo:"Cliente",valor:email.cliente},{rotulo:"Remetente",valor:remetente},{rotulo:"Para",valor:email.para},{rotulo:"Cópia",valor:email.cc||"Sem cópia"},{rotulo:"Auditoria",valor:auditoria||"Não configurada"},{rotulo:"Assunto",valor:resolverTextoEmail(email.assunto,email)},{rotulo:"Anexos",valor:email.anexos.map(a=>a.nome).join("\n")}]} observacao="A confirmação envia uma mensagem real pelo provedor. Aceitação pelo provedor não comprova entrega ou leitura. Se o retorno for incerto, confira o histórico antes de reenviar."/>
        </div>
      </section>
      <section className={`${styles.preview} rounded-3xl border border-slate-200 bg-white p-4`}><div className={styles.cardHeading}><div><p>VISUALIZAÇÃO AO VIVO</p><h3 className="font-black">Assim o cliente vai receber</h3></div><button className={botao} onClick={() => setCompacto(!compacto)}>{compacto ? "Ver computador" : "Ver celular"}</button></div><div className={styles.previewCanvas}><iframe title="Prévia do e-mail de cobrança" sandbox="" srcDoc={htmlEmail(email,"/logo.png")} className={`mx-auto h-[780px] max-w-full rounded-xl border border-slate-200 ${compacto ? "w-[375px]" : "w-full"}`}/></div>
        <h3 className="mt-5 font-black">Envios desta mensagem</h3>{email.tentativas.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nenhum envio realizado.</p> : email.tentativas.map(t => <details key={t.id} className="mt-3 rounded-xl border p-3"><summary className="cursor-pointer text-sm">{new Date(t.data).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})} · {t.status} · {t.destino}</summary><p className="my-2 text-xs">{t.assunto} · {t.messageId || "Sem confirmação do provedor"}</p><p className="my-2 text-xs">Remetente: {t.remetente || "não registrado neste histórico antigo"} · Cópia: {t.cc || "não registrada"} · Cópia oculta: {t.bcc || "não registrada"}</p><iframe sandbox="" title={`Mensagem enviada ${t.id}`} className="h-[750px] w-full" srcDoc={t.html}/></details>)}
      </section>
    </div>
  </div>;
}
