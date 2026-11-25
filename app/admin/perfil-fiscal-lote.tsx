"use client";
import type {ConfiguracaoLoteFiscal} from "@/lib/regularizacao-emissao-modelo";
import type {FiscalSP} from "@/lib/nfse-sp";
import type {PerfilNacional} from "@/lib/nfse-nacional";
import {FinanceSelect} from "../design-system/finance-fields";

export const enderecoFiscalVazio: FiscalSP["endereco"]={tipo:"",logradouro:"",numero:"",complemento:"",bairro:"",municipio:"",uf:"",cep:""};
export const perfilNacionalVazio:PerfilNacional={codigoNacional:"",codigoMunicipal:"",nbs:"",serie:"",regimeEspecial:"",apuracaoSimples:"",retencaoIss:"",aliquotaIss:"",transparencia:{tipo:"naoInformar",percentual:""}};
export function fiscalMunicipalVazio(regime:"simples"|"presumido",data:string):FiscalSP{return {regime,serie:"",numeroInicial:"1",dataEmissao:data,codigoServico:"",aliquota:"",issRetido:false,nbs:"",indicadorOperacao:"",classificacaoTributaria:"",consumidorFinal:false,municipioPrestacao:"3550308",deducoes:0,pis:0,cofins:0,inss:0,ir:0,csll:0,ipi:0,retencaoPisCofins:"0",endereco:{...enderecoFiscalVazio}};}
const input="mt-2 h-11 w-full min-w-0 rounded-xl border border-[#b8cfd8] bg-white px-3 text-sm text-[#123b4d] outline-none focus:border-[#007a92] focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50";
const grid="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-3";

export function PerfilFiscalLote({valor,onChange,disabled}:{valor:ConfiguracaoLoteFiscal;onChange:(v:ConfiguracaoLoteFiscal)=>void;disabled:boolean}){
  const p=valor.perfil||perfilNacionalVazio,f=valor.fiscal||fiscalMunicipalVazio("presumido","");
  const mudarPerfil=(key:keyof Omit<PerfilNacional,"transparencia"|"federais">,v:string)=>onChange({...valor,perfil:{...p,[key]:v}});
  const mudarFiscal=(next:Partial<FiscalSP>)=>onChange({...valor,fiscal:{...f,...next}});
  const campoPerfil=(key:keyof Omit<PerfilNacional,"transparencia"|"federais">,label:string)=><label className="min-w-0 text-[13px] font-medium text-[#244b5b]" key={key}>{label}<input disabled={disabled} className={input} value={p[key]||""} onChange={e=>mudarPerfil(key,e.target.value)}/></label>;
  const campoFiscal=(key:"serie"|"numeroInicial"|"codigoServico"|"aliquota"|"nbs"|"indicadorOperacao"|"classificacaoTributaria"|"municipioPrestacao",label:string)=><label className="min-w-0 text-[13px] font-medium text-[#244b5b]" key={key}>{label}<input disabled={disabled} className={input} value={f[key]} onChange={e=>mudarFiscal({[key]:e.target.value})}/></label>;
  const address=valor.emissor==="nacional"?(valor.endereco||enderecoFiscalVazio):f.endereco;
  const atualizarEndereco=(key:keyof FiscalSP["endereco"],v:string)=>{const next={...address,[key]:v};if(valor.emissor==="nacional")onChange({...valor,endereco:next});else mudarFiscal({endereco:next});};
  return <div className="min-w-0 space-y-6">
    {valor.emissor==="nacional"?<>
      <div className={grid}>{campoPerfil("codigoNacional","Código nacional do serviço")}{campoPerfil("codigoMunicipal","Complemento municipal nacional")}{campoPerfil("nbs","NBS")}{campoPerfil("serie","Série DPS exclusiva")}{campoPerfil("regimeEspecial","Regime especial")}{campoPerfil("apuracaoSimples","Apuração do Simples")}{campoPerfil("retencaoIss","Retenção ISS (1: não retido)")}{campoPerfil("aliquotaIss","Alíquota ISS (%), se exigida")}
        <label className="min-w-0 text-[13px] font-medium text-[#244b5b]">Transparência tributária<FinanceSelect label="Transparência tributária" value={p.transparencia.tipo} disabled={disabled} onValueChange={v=>onChange({...valor,perfil:{...p,transparencia:{tipo:v as "naoInformar"|"simples",percentual:p.transparencia.percentual}}})}><option value="naoInformar">Não informar estimativa</option><option value="simples">Percentual do Simples</option></FinanceSelect></label>
        {p.transparencia.tipo==="simples"&&<label className="min-w-0 text-[13px] font-medium text-[#244b5b]">Percentual total do Simples (%)<input disabled={disabled} className={input} value={p.transparencia.percentual} onChange={e=>onChange({...valor,perfil:{...p,transparencia:{...p.transparencia,percentual:e.target.value}}})}/></label>}
      </div>
      {!!p.federais&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Este modelo contém tributos federais adicionais. Os valores foram preservados; confira o perfil individual antes de usar o lote.</p>}
    </>:<>
      <div className={grid}>{campoFiscal("codigoServico","Código municipal do serviço")}{campoFiscal("serie","Série RPS exclusiva")}{campoFiscal("numeroInicial","Número inicial, se a série for nova")}{campoFiscal("municipioPrestacao","Município da prestação (IBGE)")}{campoFiscal("aliquota","Alíquota ISS (%)")}{campoFiscal("nbs","NBS, quando exigido")}{campoFiscal("indicadorOperacao","Indicador da operação, se exigido")}{campoFiscal("classificacaoTributaria","Classificação tributária, se exigida")}
        <label className="min-w-0 text-[13px] font-medium text-[#244b5b]">Retenção PIS/COFINS/CSLL<FinanceSelect label="Retenção PIS/COFINS/CSLL" value={f.retencaoPisCofins||"0"} disabled={disabled} onValueChange={v=>mudarFiscal({retencaoPisCofins:v})}><option value="0">Não retidos</option>{[3,4,5,6,7,8,9].map(v=><option key={v} value={String(v)}>Tipo {v} — conforme perfil fiscal</option>)}</FinanceSelect></label>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#244b5b]"><label className="flex items-center gap-2"><input disabled={disabled} type="checkbox" checked={f.issRetido} onChange={e=>mudarFiscal({issRetido:e.target.checked})}/> ISS retido</label><label className="flex items-center gap-2"><input disabled={disabled} type="checkbox" checked={f.consumidorFinal} onChange={e=>mudarFiscal({consumidorFinal:e.target.checked})}/> Consumidor final</label></div>
      <details className="rounded-xl border border-[#d4e3e8] p-4"><summary className="cursor-pointer text-sm font-semibold text-[#17495f]">Retenções e deduções por nota</summary><div className="mt-4 space-y-4">
        <label className="flex items-center gap-2 text-sm"><input disabled={disabled} type="checkbox" checked={!!f.calcularRetencoes} onChange={e=>mudarFiscal({calcularRetencoes:e.target.checked,taxasRetencao:f.taxasRetencao||{ir:"0",csll:"0",cofins:"0",pis:"0"}})}/> Calcular retenções pelo valor de cada nota</label>
        {f.calcularRetencoes?<div className={grid}>{(["ir","csll","cofins","pis"] as const).map(k=><label key={k} className="text-[13px] font-medium">{k.toUpperCase()} (%)<input disabled={disabled} className={input} value={f.taxasRetencao?.[k]||"0"} onChange={e=>mudarFiscal({taxasRetencao:{ir:"0",csll:"0",cofins:"0",pis:"0",...f.taxasRetencao,[k]:e.target.value}})}/></label>)}</div>:<p className="text-xs leading-5 text-slate-600">Para várias notas com retenção, use o cálculo por percentuais. Não copie valores monetários fixos de uma nota anterior para pagamentos de valores diferentes.</p>}
        <div className={grid}>{(["deducoes","inss","ipi",...(!f.calcularRetencoes?["pis","cofins","ir","csll"]:[])] as ("deducoes"|"inss"|"ipi"|"pis"|"cofins"|"ir"|"csll")[]).map(k=><label key={k} className="text-[13px] font-medium">{k==="deducoes"?"Deduções":k.toUpperCase()} (R$)<input disabled={disabled} className={input} type="number" min="0" step="0.01" value={f[k]/100} onChange={e=>mudarFiscal({[k]:Math.round(Number(e.target.value)*100)})}/></label>)}</div>
      </div></details>
    </>}
    <details open className="rounded-2xl border border-[#d4e3e8] bg-[#f8fbfc] p-4 sm:p-5"><summary className="cursor-pointer text-sm font-semibold text-[#17495f]">Endereço fiscal do cliente</summary><div className={`${grid} mt-5`}>{([["tipo","Tipo (R, AV…)"],["logradouro","Logradouro"],["numero","Número"],["complemento","Complemento"],["bairro","Bairro"],["municipio","Município (IBGE)"],["uf","UF"],["cep","CEP (8 dígitos)"]] as const).map(([key,label])=><label key={key} className="min-w-0 text-[13px] font-medium text-[#244b5b]">{label}<input disabled={disabled} className={input} value={address[key]||""} maxLength={key==="uf"?2:key==="cep"?8:50} onChange={e=>atualizarEndereco(key,e.target.value)}/></label>)}</div></details>
  </div>;
}
