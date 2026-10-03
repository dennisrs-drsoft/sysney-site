"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import styles from "./admin-shell.module.css";
import {MensagemAdmin} from "./dialogos-admin";

const icons: Record<string, string> = {
  "visao-geral": "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  cobrancas: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M7 14h3m4 0h3m-10 4h3",
  aprovacoes: "m9 12 2 2 4-4M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z",
  emails: "M3 5h18v14H3zM3 6l9 7 9-7",
  "historico-inter": "M3 11a9 9 0 1 1 3 8M3 4v7h7M12 7v5l3 2",
  "nfse-nacional": "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7",
  "nova-emissao": "M6 3h9l4 4v14H6zM12 11v6m-3-3h6",
  clientes: "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 3a4 4 0 0 1 0 8m2 3a4 4 0 0 1 3 4v3",
  documentos: "M3 7V4h7l3 3h8v13H3z",
};
function Icon({ name }: { name: string }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name] || icons.documentos}/></svg>;
}
const groups = [
  { label: "Visão do negócio", ids: ["visao-geral", "cobrancas", "acompanhamento"] },
  { label: "Operação financeira", ids: ["nova-emissao", "aprovacoes", "emails"] },
  { label: "Cadastros e integrações", ids: ["clientes", "documentos", "historico-inter", "nfse-nacional"] },
];

export function AdminShell<T extends string>({children, empresa, regime, secao, secoes, onEmpresa, onSecao, aviso, onFecharAviso}: {
  children: ReactNode; empresa: "drsoft" | "sysney"; regime: string; secao: T;
  secoes: {id: T; label: string}[]; onEmpresa: (id:"drsoft"|"sysney")=>void; onSecao:(id:T)=>void; aviso:string;onFecharAviso:()=>void;
}) {
  const [menu, setMenu] = useState(false);
  const titulo = secoes.find(s=>s.id===secao)?.label;
  return <div className={styles.shell}>
    <a href="#conteudo-admin" className={styles.skip}>Pular para o conteúdo</a>
    <aside className={`${styles.sidebar} ${menu ? styles.open : ""}`}>
      <div className={styles.brand}><Image src="/logo.png" alt="SYSNEY Informática" width={56} height={56} priority/><div><strong>SYSNEY<span>Financeiro</span></strong><small>GESTÃO DE SERVIÇOS</small></div></div>
      <div className={styles.company}><span>EMPRESA EM OPERAÇÃO</span><div role="group" aria-label="Selecionar empresa">{(["sysney","drsoft"] as const).map(id=><button key={id} aria-pressed={empresa===id} onClick={()=>onEmpresa(id)}>{id.toUpperCase()}</button>)}</div><small>{regime}</small></div>
      <nav aria-label="Administração" id="menu-admin">{groups.map(group=><div className={styles.group} key={group.label}><p>{group.label}</p>{group.ids.map(id=>{
        const item=secoes.find(s=>s.id===id); if(!item)return null;
        return <button key={id} aria-current={secao===id?"page":undefined} onClick={()=>{onSecao(item.id);setMenu(false);window.scrollTo({top:0});requestAnimationFrame(()=>document.getElementById("conteudo-admin")?.focus({preventScroll:true}));}}><Icon name={id}/><span>{item.label}</span>{secao===id && <span className={styles.activeDot}/>}</button>;
      })}</div>)}</nav>
      <div className={styles.sidebarFooter}><div className={styles.avatar}>AD</div><div><strong>Administração</strong><small>Área privada · {empresa.toUpperCase()}</small></div><a href="/.auth/logout?post_logout_redirect_uri=/" aria-label="Sair da administração" title="Sair"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 5H4v14h5m5-14 7 7-7 7m-5-7h12"/></svg></a></div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><button className={styles.menuToggle} aria-expanded={menu} aria-controls="menu-admin" onClick={()=>setMenu(!menu)}>{menu?"Fechar menu":"Menu"}</button><div className={styles.breadcrumb}>Financeiro <span>/</span> <strong>{titulo}</strong></div><span className={styles.environment}><i/>Revisão obrigatória</span></header>
      <main id="conteudo-admin" tabIndex={-1} className={styles.main}>
        <div className={styles.pageHeading}><div><p>{empresa.toUpperCase()} <span> / </span> ADMINISTRAÇÃO FINANCEIRA</p><h1>{titulo}</h1></div><span className={styles.privateBadge}><Icon name="aprovacoes"/>Revisão antes de agir</span></div>
        <details className={styles.notice}><summary><span className={styles.info}>i</span><strong>Operações com aprovação</strong><span>Nota e boleto conforme integração · PDFs com recuperação</span></summary><p>Na fila de cobranças, a emissão real de nota ou boleto depende da integração habilitada para a empresa, da conferência dos dados e de sua confirmação específica. A NFS-e municipal utiliza o certificado configurado no serviço fiscal. Após confirmar a emissão, o sistema tenta recuperar e anexar os PDFs oficiais; se falhar, use Tentar baixar ou o anexo manual, sem reemitir o documento. Emitir documentos não envia e-mail: o envio exige revisão e confirmação separadas. O agendamento automático ainda não está ativo.</p></details>
        <MensagemAdmin mensagem={aviso} aoFechar={onFecharAviso} titulo="Registro administrativo" subtitulo="Resultado da operação no painel"/>
        <div className={styles.content}>{children}</div>
        <footer className={styles.pageFooter}>SYSNEY Financeiro <span>Dados separados por empresa · Ações com aprovação</span></footer>
      </main>
    </div>
  </div>;
}
