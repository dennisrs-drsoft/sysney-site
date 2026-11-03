"use client";
import {useEffect,useState} from "react";
import type {EmailCobranca} from "@/lib/emails-cobranca";
import type {PerfilNacional} from "@/lib/nfse-nacional";
import type {FiscalSP} from "@/lib/nfse-sp";
import {lerRespostaAdmin} from "@/lib/admin-resposta";
import {MensagemAdmin} from "./dialogos-admin";
const input="mt-1 w-full rounded-lg border border-blue-200 bg-white p-2 text-sm text-slate-900";
const inicial:PerfilNacional={codigoNacional:"",codigoMunicipal:"",nbs:"",serie:"",regimeEspecial:"",apuracaoSimples:"",retencaoIss:"",aliquotaIss:"",transparencia:{tipo:"naoInformar",percentual:""}};
const enderecoInicial:FiscalSP["endereco"]={tipo:"",logradouro:"",numero:"",bairro:"",municipio:"",uf:"",cep:""};
type Previa={dados:{competenciaFiscal:string;endereco:FiscalSP["endereco"];perfil:PerfilNacional};pendencias:string[]};
export function NotaFiscalNacional({email,alterado,ocupado}:{email:EmailCobranca;alterado:boolean;ocupado:boolean}){
  const [perfil,setPerfil]=useState<PerfilNacional>(inicial),[endereco,setEndereco]=useState(enderecoInicial),[competencia,setCompetencia]=useState("");
  const [regime,setRegime]=useState(""),[confirmado,setConfirmado]=useState(false),[busy,setBusy]=useState(false),[aviso,setAviso]=useState(""),[previa,setPrevia]=useState<Previa|null>(null);
  useEffect(()=>{let ativo=true;async function carregar(){try{
    const url=`/api/admin/nfse?empresa=${email.empresa}&id=${email.id}`;
    const [n,m]=await Promise.all([fetch(url+"&emissor=nacional",{cache:"no-store"}),fetch(url,{cache:"no-store"})]);
    const nacional=await lerRespostaAdmin<{perfil?:{perfil:PerfilNacional};previa?:Previa;regime?:string;erro?:string}>(n);
    const municipal=await lerRespostaAdmin<{perfil?:{fiscal?:Partial<FiscalSP>};trabalho?:{dados:{fiscal:FiscalSP}};erro?:string}>(m);
    if(!n.ok||!m.ok)throw Error(nacional.erro||municipal.erro||"Não foi possível recuperar os perfis fiscais.");
    if(!ativo)return;setRegime(nacional.regime||"");setPrevia(nacional.previa||null);
    if(nacional.perfil)setPerfil(nacional.perfil.perfil);
    const anterior=municipal.perfil?.fiscal?.endereco||municipal.trabalho?.dados.fiscal.endereco;
    if(nacional.previa){setCompetencia(nacional.previa.dados.competenciaFiscal);setEndereco(nacional.previa.dados.endereco);setPerfil(nacional.previa.dados.perfil);}else if(anterior)setEndereco(anterior);
  }catch(e){if(ativo)setAviso(e instanceof Error?e.message:"Falha ao consultar o perfil nacional.");}}void carregar();return()=>{ativo=false;};},[email.empresa,email.id]);
  async function salvar(){setBusy(true);setAviso("");try{
    const r=await fetch(`/api/admin/nfse?empresa=${email.empresa}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao:"nacional-preparar",id:email.id,atualizadoEm:email.atualizadoEm,perfil,endereco,competenciaFiscal:competencia,confirmado})});
    const d=await lerRespostaAdmin<{erro?:string;mensagem?:string;previa?:Previa}>(r,true);if(!r.ok)throw Error(d.erro||"Não foi possível salvar a prévia nacional.");setPrevia(d.previa||null);setAviso(d.mensagem||"Prévia salva.");setConfirmado(false);
  }catch(e){setAviso(e instanceof Error?e.message:"Resultado não confirmado. Atualize para conferir a prévia salva.");}finally{setBusy(false);}}
  const campo=(k:keyof Omit<PerfilNacional,"transparencia"|"federais">,titulo:string)=><label key={k}>{titulo}<input className={input} value={perfil[k]} onChange={e=>{setPerfil(p=>({...p,[k]:e.target.value}));setConfirmado(false);}}/></label>;
  return <details className="rounded-xl border border-cyan-300 bg-cyan-50 p-4"><summary className="cursor-pointer font-bold text-blue-950">Emissor Nacional — preparar perfil e conferir pendências</summary><div className="mt-4 space-y-4 text-sm text-slate-800">
    <p>Empresa: <strong>{email.empresa.toUpperCase()}</strong> · Regime: {regime==="simples"?"Simples Nacional":regime==="presumido"?"Lucro Presumido":"não configurado"} · Referência comercial: {email.competencia}.</p>
    <p>A competência fiscal é a data real do fato gerador. Ela não muda porque a emissão será feita hoje. Para o Simples de São Paulo, competências anteriores a novembro/2026 permanecem no municipal.</p>
    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3">Transmissão nacional ainda não habilitada. Salvar não emite nota nem reserva numeração. {regime==="presumido"&&"A habilitação da DRSoft no nacional precisa ser confirmada; o regime será preservado."}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Data real da competência fiscal<input type="date" className={input} value={competencia} onChange={e=>{setCompetencia(e.target.value);setConfirmado(false);}}/></label>
      {campo("codigoNacional","Código nacional do serviço (6 dígitos)")}{campo("codigoMunicipal","Complemento municipal nacional (opcional; não é o código antigo)")}{campo("nbs","NBS (9 dígitos, quando aplicável)")}{campo("serie","Série DPS exclusiva (1 a 99999)")}
      {campo("regimeEspecial","Regime especial (0 nenhum; 1 cooperativa; 2 estimativa; 3 microempresa municipal; 4 notário; 5 autônomo; 6 sociedade; 9 outros)")}
      {campo("retencaoIss","Retenção de ISS (1 não retido; 2 tomador; 3 intermediário)")}{campo("aliquotaIss","Alíquota do ISS (%), quando exigida")}
      {regime==="simples"&&campo("apuracaoSimples","Apuração do Simples (1 federais/ISS no SN; 2 ISS fora; 3 ambos fora)")}
      <label>Transparência tributária<select className={input} value={perfil.transparencia.tipo} onChange={e=>{setPerfil(p=>({...p,transparencia:{tipo:e.target.value as "naoInformar"|"simples",percentual:""}}));setConfirmado(false);}}><option value="naoInformar">Não informar estimativa — conferir aplicabilidade</option>{regime==="simples"&&<option value="simples">Percentual total do Simples</option>}</select></label>
      {perfil.transparencia.tipo==="simples"&&<label>Percentual total (%)<input className={input} value={perfil.transparencia.percentual} onChange={e=>{setPerfil(p=>({...p,transparencia:{...p.transparencia,percentual:e.target.value}}));setConfirmado(false);}}/></label>}
    </div>
    {regime==="presumido"&&<fieldset className="rounded-lg border p-3"><legend className="font-bold">Tributos federais nacionais</legend><div className="grid gap-3 sm:grid-cols-2">{(["cst","pis","cofins","ir","csll","inss","retencaoPisCofins"] as const).map(k=><label key={k}>{({cst:"CST PIS/COFINS",pis:"PIS (%)",cofins:"COFINS (%)",ir:"IRRF retido (%)",csll:"CSLL retida (%)",inss:"Contribuição previdenciária retida (%)",retencaoPisCofins:"Tipo de retenção PIS/COFINS (0 a 9)"})[k]}<input className={input} value={perfil.federais?.[k]||""} onChange={e=>{setPerfil(p=>({...p,federais:{cst:"",pis:"",cofins:"",ir:"",csll:"",inss:"",retencaoPisCofins:"",...p.federais,[k]:e.target.value}}));setConfirmado(false);}}/></label>)}</div></fieldset>}
    <fieldset className="rounded-lg border p-3"><legend className="font-bold">Endereço fiscal recuperado — conferir dados atuais</legend><div className="grid gap-3 sm:grid-cols-2">{([["tipo","Tipo (R, AV…)"],["logradouro","Logradouro"],["numero","Número"],["complemento","Complemento"],["bairro","Bairro"],["municipio","Município IBGE"],["uf","UF"],["cep","CEP sem pontuação"]] as const).map(([k,t])=><label key={k}>{t}<input className={input} value={endereco[k]||""} onChange={e=>{setEndereco(p=>({...p,[k]:e.target.value}));setConfirmado(false);}}/></label>)}</div></fieldset>
    <label className="flex gap-2"><input type="checkbox" checked={confirmado} onChange={e=>setConfirmado(e.target.checked)}/>Conferi código nacional, enquadramento, endereço e data real da competência fiscal. A série DPS será exclusiva deste sistema.</label>
    <button type="button" disabled={!confirmado||busy||ocupado||alterado||!["rascunho","revisado"].includes(email.status)||!!email.fluxo?.nota||email.anexos.some(a=>a.tipo==="nota")} onClick={()=>void salvar()} className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-40">{busy?"Salvando…":"Salvar prévia nacional — sem emitir"}</button>
    <MensagemAdmin mensagem={aviso} aoFechar={()=>setAviso("")} titulo="Preparação nacional" subtitulo="Dados fiscais e pendências" observacao="Salvar a prévia não emite nota, não reserva DPS e não envia e-mail."/>{previa&&<div className="rounded-lg border bg-white p-3"><p className="font-bold">Prévia salva · aguardando homologação</p><ul className="mt-2 list-disc space-y-1 pl-5">{previa.pendencias.map(p=><li key={p}>{p}</li>)}</ul><p className="mt-2 text-xs">Alterações no formulário precisam ser salvas novamente. A prévia não é uma NFS-e autorizada.</p></div>}
    <a className="text-blue-700 underline" target="_blank" rel="noreferrer" href="https://www.gov.br/nfse/pt-br/mei-e-demais-empresas/codigos-de-tributacao-nacional-nbs">Consultar códigos oficiais nacionais</a>
  </div></details>;
}
