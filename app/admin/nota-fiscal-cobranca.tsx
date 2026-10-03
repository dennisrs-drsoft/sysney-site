"use client";
import {useEffect,useState} from "react";
import type {EmailCobranca} from "@/lib/emails-cobranca";
import type {FiscalSP,TrabalhoSP} from "@/lib/nfse-sp";
import {hojeBrasil,moeda} from "@/lib/cobrancas";
import {lerRespostaAdmin} from "@/lib/admin-resposta";
const input="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm disabled:opacity-50";
const button="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-800 disabled:opacity-40";
const monetarios=["deducoes","pis","cofins","inss","ir","csll","ipi"] as const;
const labels={deducoes:"Deduções",pis:"PIS retido",cofins:"COFINS retida",inss:"INSS retido",ir:"IR retido",csll:"CSLL retida",ipi:"IPI"};
type Formulario={serie:string;numeroInicial:string;dataEmissao:string;codigoServico:string;aliquota:string;nbs:string;indicadorOperacao:string;classificacaoTributaria:string;municipioPrestacao:string;issRetido:boolean;consumidorFinal:boolean;endereco:FiscalSP["endereco"]}&Record<typeof monetarios[number],string>;
const vazio=():Formulario=>({serie:"SB001",numeroInicial:"1",dataEmissao:hojeBrasil(),codigoServico:"",aliquota:"",nbs:"",indicadorOperacao:"",classificacaoTributaria:"",municipioPrestacao:"3550308",issRetido:false,consumidorFinal:false,deducoes:"",pis:"",cofins:"",inss:"",ir:"",csll:"",ipi:"",endereco:{tipo:"",logradouro:"",numero:"",bairro:"",municipio:"3550308",uf:"SP",cep:""}});
function centavos(v:string){if(!/^\d+(,\d{1,2})?$/.test(v))throw Error("Preencha todos os valores fiscais usando vírgula; use 0,00 somente quando confirmado.");const [a,b=""]=v.split(",");const c=Number(a)*100+Number(b.padEnd(2,"0"));if(!Number.isSafeInteger(c))throw Error("Valor fiscal inválido.");return c;}
function formulario(f:FiscalSP):Formulario {const valor=(k:typeof monetarios[number])=>(f[k]/100).toFixed(2).replace(".",",");return {...f,deducoes:valor("deducoes"),pis:valor("pis"),cofins:valor("cofins"),inss:valor("inss"),ir:valor("ir"),csll:valor("csll"),ipi:valor("ipi")};}
export function NotaFiscalCobranca({email,alterado,ocupado,onEmail}:{email:EmailCobranca;alterado:boolean;ocupado:boolean;onEmail:(e:EmailCobranca)=>void}){
 const [aberto,setAberto]=useState(false),[form,setForm]=useState(vazio),[confirma,setConfirma]=useState(false),[conferido,setConferido]=useState(false);
 const [job,setJob]=useState<TrabalhoSP|null>(null),[local,setLocal]=useState(false),[producao,setProducao]=useState(false),[pronto,setPronto]=useState(false),[busy,setBusy]=useState(false),[aviso,setAviso]=useState("");
 useEffect(()=>{let ativo=true;fetch(`/api/admin/nfse?empresa=${email.empresa}&id=${email.id}`,{cache:"no-store"}).then(async r=>{const d=await lerRespostaAdmin<{local:boolean;producao:boolean;trabalho:TrabalhoSP|null;perfil?:{fiscal:FiscalSP};erro?:string}>(r);if(!r.ok)throw Error(d.erro);if(ativo){setPronto(true);setLocal(d.local);setProducao(d.producao);setJob(d.trabalho);setForm(d.trabalho?formulario(d.trabalho.dados.fiscal):d.perfil?{...formulario(d.perfil.fiscal),dataEmissao:hojeBrasil()}:vazio());setConfirma(false);setConferido(false);if(d.perfil&&!d.trabalho)setAviso("Campos preenchidos a partir do último teste aceito deste cliente. Confira o enquadramento e os valores: não há aprovação automática.");}}).catch(e=>{if(ativo)setAviso(e.message);});return()=>{ativo=false;};},[email.id,email.empresa]);
 const bloqueado=!pronto||busy||ocupado||alterado||!["rascunho","revisado"].includes(email.status)||!!email.fluxo?.nota||email.anexos.some(a=>a.tipo==="nota");
 const fiscalAlterado=!!job&&JSON.stringify(form)!==JSON.stringify(formulario(job.dados.fiscal));
 function mudar(k:keyof Formulario,v:string|boolean){setForm({...form,[k]:v});setConferido(false);}
 async function executar(acao:string){
  setBusy(true);setAviso("");
  try{
   const fiscal=acao==="preparar"?{...form,aliquota:form.aliquota.replace(",","."),...Object.fromEntries(monetarios.map(k=>[k,centavos(form[k])]))}:undefined;
   const r=await fetch(`/api/admin/nfse?empresa=${email.empresa}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao,id:email.id,atualizadoEm:email.atualizadoEm,fiscal,confirmarSerie:confirma,hash:job?.hash,aprovado:acao==="emitir"})});
   const d=await lerRespostaAdmin<{trabalho?:TrabalhoSP;email?:EmailCobranca;mensagem?:string;erro?:string}>(r,true);
   if(d.trabalho){setJob(d.trabalho);setForm(formulario(d.trabalho.dados.fiscal));setConferido(false);}if(d.email)onEmail(d.email);
   if(!r.ok)throw Error(d.erro);setAviso(d.mensagem||"Consulta concluída.");
  }catch(e){setAviso(e instanceof Error?e.message:"Resultado fiscal não confirmado. Consulte antes de repetir.");}finally{setBusy(false);}
 }
 const campo=(label:string,k:keyof Formulario,maxLength=30)=><label key={k} className="space-y-1 text-xs text-slate-600">{label}<input className={input} value={String(form[k])} maxLength={maxLength} onChange={e=>mudar(k,e.target.value)} disabled={busy}/></label>;
 return <div className="rounded-xl border bg-white p-4 sm:col-span-2"><button type="button" className={button} onClick={()=>setAberto(!aberto)}>NFS-e municipal — preparar e testar</button><p className="mt-2 text-xs text-slate-600">{email.fluxo?.nota?`Nota ${email.fluxo.nota} já registrada. Não emitir outra.`:"Teste na Prefeitura sem emitir; transmissão real exige aprovação específica."}</p>
 {aberto&&<div className="mt-4 space-y-4">
 <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">{!pronto?"Consultando a disponibilidade e o registro fiscal…":local?"Certificado Windows: execução neste computador, sem exportar a chave privada.":"No ambiente on-line, é possível preparar. Para testar e assinar, abra o painel local neste computador. Assinador on-line ainda pendente."} {email.empresa==="sysney"&&"Para SYSNEY, o caminho nacional a partir de novembro permanece separado."}</p>
 <p className="text-xs text-slate-600">Escopo atual: serviço tributado em São Paulo, tomador com CNPJ e sem intermediário. Campos fiscais devem ser conferidos; o sistema não presume o enquadramento.</p>
 <div className="grid gap-3 2xl:grid-cols-2">{campo("Série RPS (proposta)","serie",5)}{campo("Número inicial (na primeira reserva)","numeroInicial",12)}<label className="text-xs text-slate-600">Data de emissão<input type="date" className={input} value={form.dataEmissao} onChange={e=>mudar("dataEmissao",e.target.value)} /></label>{campo("Código municipal do serviço","codigoServico",5)}{campo("ISS (%) — não inferir da nota antiga","aliquota",8)}{campo("NBS — 9 dígitos","nbs",9)}{campo("Indicador da operação — 6 dígitos","indicadorOperacao",6)}{campo("Classificação IBS/CBS — 6 dígitos","classificacaoTributaria",6)}{campo("Município da prestação (IBGE)","municipioPrestacao",7)}</div>
 <div className="flex flex-wrap gap-4 text-xs"><label><input type="checkbox" checked={form.issRetido} onChange={e=>mudar("issRetido",e.target.checked)}/> ISS retido pelo tomador</label><label><input type="checkbox" checked={form.consumidorFinal} onChange={e=>mudar("consumidorFinal",e.target.checked)}/> Uso/consumo pessoal (IBS/CBS)</label></div>
 <details className="rounded-xl border p-3"><summary className="text-sm font-bold">Preencher retenções e valores fiscais</summary><p className="my-2 text-xs text-slate-500">Os valores impressos na nota antiga não comprovam, sozinhos, que houve retenção. Informe 0,00 apenas quando confirmado.</p><div className="grid gap-3 2xl:grid-cols-2">{monetarios.map(k=>campo(`${labels[k]} (R$)`,k,15))}</div></details>
 <details className="rounded-xl border p-3"><summary className="text-sm font-bold">Preencher endereço fiscal do tomador</summary><div className="mt-3 grid gap-3 2xl:grid-cols-2">{([['tipo','Tipo (R, AV…)'],['logradouro','Logradouro'],['numero','Número'],['bairro','Bairro'],['municipio','Município (IBGE)'],['uf','UF'],['cep','CEP sem pontuação']] as const).map(([k,label])=><label key={k} className="text-xs text-slate-600">{label}<input className={input} value={form.endereco[k]} onChange={e=>{setForm({...form,endereco:{...form.endereco,[k]:e.target.value}});setConferido(false);}}/></label>)}</div></details>
 <label className="block text-xs text-slate-700"><input type="checkbox" checked={confirma} onChange={e=>setConfirma(e.target.checked)}/> Confirmo série exclusiva e numeração inicial não utilizada por outro sistema. A reserva não é uma nota emitida.</label>
 <button type="button" className={button} disabled={bloqueado||!confirma||!!job?.aprovacao} onClick={()=>void executar("preparar")}>Preparar prévia fiscal — não emitir</button>
 {job&&<div className="space-y-3 rounded-xl border border-blue-200 bg-slate-50 p-4"><h5 className="font-bold">Situação: {job.status} · RPS {job.dados.fiscal.serie}/{job.dados.numero}</h5><p className="text-sm">{job.dados.clienteNome} · CNPJ {job.dados.clienteDocumento}<br/>Referência {job.dados.competencia} · {moeda(job.dados.centavos)}<br/>{job.dados.descricao}{job.dados.po&&` · PO ${job.dados.po}`}</p><p className="text-xs">A prévia é a última versão salva. Alterar campos acima exige preparar e testar novamente.</p>
 {job.teste&&<div className="text-xs"><p>Teste: {job.teste.resultado.sucesso?"aceito":"rejeitado"} · {new Date(job.teste.em).toLocaleString("pt-BR")}</p>{[...job.teste.resultado.erros,...job.teste.resultado.alertas].map((v,i)=><p key={i} className="mt-1 text-amber-800">{v}</p>)}</div>}
 {fiscalAlterado&&<p className="text-xs text-amber-800">Há alterações fiscais não preparadas. Prepare a nova versão antes de testar ou aprovar.</p>}
 <button type="button" className={button} disabled={bloqueado||fiscalAlterado||!local||!!job.aprovacao||!["preparada","testada","rejeitada"].includes(job.status)} onClick={()=>void executar("testar")}>Testar na Prefeitura — sem emitir nota</button>
 <label className="block text-xs"><input type="checkbox" checked={conferido} onChange={e=>setConferido(e.target.checked)}/> Conferi a prévia salva, o enquadramento fiscal, os valores e todos os alertas do teste.</label>
 <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={bloqueado||fiscalAlterado||!producao||job.status!=="testada"||!conferido} onClick={()=>{if(window.confirm("Aprovo a prévia fiscal salva e autorizo transmitir este RPS para emitir uma nota real, sem enviar e-mail. Continuar?"))void executar("emitir");}}>Aprovar e emitir NFS-e real</button>
 {!producao&&<p className="text-xs text-amber-800">Produção bloqueada até homologar a integração. Teste aceito não libera emissão automaticamente.</p>}
 <button type="button" className={button} disabled={busy||ocupado||alterado||!local} onClick={()=>void executar("consultar")}>Consultar RPS / recuperar número — não reemitir</button>
 {job.resultado?.numero&&<p className="text-sm">NFS-e {job.resultado.numero} · PDF ainda deve ser obtido no portal e anexado.</p>}
 {job.resultado&&[...job.resultado.erros,...job.resultado.alertas].map((v,i)=><p key={i} className="text-xs text-amber-800">{v}</p>)}
 </div>}
 {aviso&&<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{aviso}</p>}
 </div>}
 </div>;
}
