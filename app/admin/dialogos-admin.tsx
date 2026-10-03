"use client";

import {createContext,useCallback,useContext,useEffect,useId,useRef,useState,useSyncExternalStore,type ReactNode} from "react";
import {createPortal} from "react-dom";
import styles from "./dialogos-admin.module.css";

export type OpcoesDialogo = {
  titulo:string; subtitulo:string; descricao:string; confirmar?:string; cancelar?:string;
  detalhes?:{rotulo:string;valor:string}[]; observacao?:string; tom?:"info"|"atencao"|"erro";
};
type ModalProps=OpcoesDialogo & {aberto:boolean;aoFechar:()=>void;aoConfirmar?:()=>void;ocupado?:boolean};
let modaisAbertos=0,overflowAnterior="";
const subscribe=()=>()=>{},clientSnapshot=()=>true,serverSnapshot=()=>false;
export function ModalAdmin({aberto,titulo,subtitulo,descricao,detalhes,observacao,tom="info",confirmar="Entendi",cancelar="Voltar e revisar",aoFechar,aoConfirmar,ocupado=false}:ModalProps) {
  const montado=useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot);
  const dialog=useRef<HTMLDialogElement>(null),voltar=useRef<HTMLButtonElement>(null),id=useId();
  useEffect(()=>{
    const el=dialog.current;if(!aberto||!el)return;
    const foco=document.activeElement instanceof HTMLElement?document.activeElement:null;
    el.showModal();el.scrollTop=0;voltar.current?.focus({preventScroll:true});
    if(modaisAbertos++===0){overflowAnterior=document.body.style.overflow;document.body.style.overflow="hidden";}
    return()=>{el.close();if(--modaisAbertos===0)document.body.style.overflow=overflowAnterior;if(foco?.isConnected)foco.focus({preventScroll:true});};
  },[aberto,montado]);
  if(!montado)return null;
  return createPortal(<dialog ref={dialog} className={styles.modal} aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-subtitulo ${id}-descricao`} onCancel={e=>{e.preventDefault();if(!ocupado)aoFechar();}}>
    <div className={`${styles.header} ${styles[tom]}`}>
      <span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={tom==="info"?"M12 8v.01M12 11v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0":tom==="erro"?"m9 9 6 6m0-6-6 6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0":"M12 8v5m0 3v.01M12 3 2 21h20z"}/></svg></span>
      <div><p className={styles.eyebrow}>SYSNEY · ADMINISTRAÇÃO FINANCEIRA</p><h2 id={`${id}-titulo`}>{titulo}</h2><p id={`${id}-subtitulo`} className={styles.subtitle}>{subtitulo}</p></div>
      <button type="button" className={styles.close} aria-label="Fechar mensagem sem confirmar" disabled={ocupado} onClick={aoFechar}>×</button>
    </div>
    <div className={styles.body}><p id={`${id}-descricao`} className={styles.description}>{descricao}</p>
      {!!detalhes?.length&&<dl className={styles.details}>{detalhes.map((d,i)=><div key={`${d.rotulo}-${i}`}><dt>{d.rotulo}</dt><dd>{d.valor}</dd></div>)}</dl>}
      {observacao&&<p className={styles.note}><span aria-hidden="true">i</span>{observacao}</p>}
    </div>
    <footer className={styles.actions}>{aoConfirmar&&<button ref={voltar} type="button" className={styles.secondary} disabled={ocupado} onClick={aoFechar}>{cancelar}</button>}<button ref={aoConfirmar?undefined:voltar} type="button" className={styles.primary} disabled={ocupado} onClick={aoConfirmar||aoFechar}>{ocupado?"Aguarde…":confirmar}</button></footer>
  </dialog>,document.body);
}

type Pedido=OpcoesDialogo & {id:string;resolver:(aprovado:boolean)=>void};
const Contexto=createContext<((opcoes:OpcoesDialogo)=>Promise<boolean>)|null>(null);
export function DialogosAdmin({children}:{children:ReactNode}) {
  const [fila,setFila]=useState<Pedido[]>([]),pendentes=useRef(new Map<string,(v:boolean)=>void>());
  const confirmar=useCallback((opcoes:OpcoesDialogo)=>{
    // Evita duas confirmações por clique duplo antes da abertura do diálogo.
    if(pendentes.current.size)return Promise.resolve(false);
    return new Promise<boolean>(resolver=>{
    const id=crypto.randomUUID();pendentes.current.set(id,resolver);setFila(atual=>[...atual,{...opcoes,id,resolver}]);
    });
  },[]);
  useEffect(()=>{const mapa=pendentes.current;return()=>{for(const resolver of mapa.values())resolver(false);mapa.clear();};},[]);
  function concluir(aprovado:boolean){const p=fila[0];if(!p)return;pendentes.current.delete(p.id);setFila(atual=>atual.filter(x=>x.id!==p.id));p.resolver(aprovado);}
  return <Contexto.Provider value={confirmar}>{children}{fila[0]&&<ModalAdmin key={fila[0].id} {...fila[0]} aberto aoFechar={()=>concluir(false)} aoConfirmar={()=>concluir(true)}/>}</Contexto.Provider>;
}
export function useConfirmarAdmin(){const confirmar=useContext(Contexto);if(!confirmar)throw Error("As confirmações precisam do contexto administrativo.");return confirmar;}
export function MensagemAdmin({mensagem,aoFechar,titulo="Resultado da operação",subtitulo="Confira o retorno antes de continuar",tom="info",acao,rotuloAcao="Atualizar consulta",observacao}:{mensagem:string;aoFechar:()=>void;titulo?:string;subtitulo?:string;tom?:OpcoesDialogo["tom"];acao?:()=>void;rotuloAcao?:string;observacao?:string}) {
  if(!mensagem)return null;
  return <MensagemConteudo key={mensagem} titulo={titulo} subtitulo={subtitulo} descricao={mensagem} tom={tom} observacao={observacao} confirmar={acao?rotuloAcao:"Entendi"} cancelar="Fechar mensagem" aoFechar={aoFechar} aoConfirmar={acao}/>;
}
function MensagemConteudo(props:Omit<ModalProps,"aberto">) {
  const [aberto,setAberto]=useState(true);
  function fechar(){setAberto(false);props.aoFechar();}
  return <ModalAdmin {...props} aberto={aberto} aoFechar={fechar} aoConfirmar={props.aoConfirmar?()=>{fechar();props.aoConfirmar!();}:undefined}/>;
}
