"use client";
import {contaDepositoPadrao,type DadosDeposito} from "@/lib/emails-cobranca";
import type {Empresa} from "@/lib/cobrancas";
import styles from "./conta-deposito.module.css";

export function ContaDepositoCampos({empresa,dados,aoAlterar,disabled=false}:{empresa:Empresa;dados:DadosDeposito;aoAlterar?:(dados:DadosDeposito)=>void;disabled?:boolean}) {
 const campos:[keyof DadosDeposito,string,string?][]=[["banco","Banco"],["agencia","Agência","numeric"],["conta","Conta com dígito"],["cnpj","CNPJ do beneficiário"],["razaoSocial","Razão social"]];
 return <fieldset className={styles.card} disabled={disabled}>
  <legend className={styles.legend}>Conta para depósito bancário</legend>
  <div className={styles.heading}><div className={styles.identity}><span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 10h18M5 10v8m5-8v8m4-8v8m5-8v8M3 21h18M2 7l10-5 10 5v3H2z"/></svg></span><div><p>CONTA RECEBEDORA</p><strong>{empresa.toUpperCase()}</strong></div></div><span className={styles.badge}>Depósito/Transferência</span></div>
  <p className={styles.description}>Os dados abaixo acompanham esta cobrança. Confira a conta antes de aprovar o envio.</p>
  <div className={styles.grid}>{campos.map(([chave,rotulo,inputMode])=><label className={chave==="razaoSocial"?styles.full:undefined} key={chave}>{rotulo}<input aria-label={rotulo} inputMode={inputMode as "numeric"|undefined} required maxLength={150} readOnly={!aoAlterar||chave==="cnpj"} value={dados[chave]} onChange={e=>aoAlterar?.({...dados,[chave]:e.target.value})}/></label>)}</div>
  {!dados.conta&&<p role="status" className={styles.pending}>Informe a conta corrente da {empresa.toUpperCase()} para concluir a configuração.</p>}
  <div className={styles.footer}><p>Sem boleto. O demonstrativo apresenta os dados bancários e o vencimento.</p>{aoAlterar&&<button type="button" onClick={()=>aoAlterar(contaDepositoPadrao(empresa))}>Restaurar dados da empresa</button>}</div>
 </fieldset>;
}
