"use client";
import {useCallback,useEffect,useState} from "react";
import {LaboratorioEmails,type EditorEmailProps} from "./laboratorio-emails";
import type {EmailCobranca} from "@/lib/emails-cobranca";
import {dataBr,hojeBrasil,moeda,pago,dataValida,type Cobranca} from "@/lib/cobrancas";
import {filtrarFila,type FiltrosFila} from "@/lib/fila-cobrancas";
import {tiposAviso,type TipoAviso} from "@/lib/avisos-cobranca";
import {useOrdenacaoTabela} from "./ordenacao-tabela";
import {lerRespostaAdmin} from "@/lib/admin-resposta";
import {MensagemAdmin,useConfirmarAdmin} from "./dialogos-admin";
const button="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-800 disabled:opacity-40";
export function FilaCobrancas(props:EditorEmailProps) {
 const confirmar=useConfirmarAdmin();
 const [cobrancas,setCobrancas]=useState<Cobranca[]>([]),[emails,setEmails]=useState<EmailCobranca[]>([]);
 const [aberta,setAberta]=useState<EmailCobranca|null>(null),[aviso,setAviso]=useState(""),[ocupado,setOcupado]=useState(false);
 const [carregada,setCarregada]=useState(false);
 const padrao:FiltrosFila={busca:"",situacao:"abertas",inicio:"",fim:"",data:"vencimento"};
 const [filtros,setFiltros]=useState<FiltrosFila>(padrao),[pagina,setPagina]=useState(1),[tamanho,setTamanho]=useState(20),[tipoAviso,setTipoAviso]=useState<TipoAviso>("atraso");
 const hoje=hojeBrasil(),filtradas=filtrarFila(cobrancas,filtros,hoje);
 const originais=new Map(emails.filter(e=>e.fluxo).map(e=>[e.fluxo!.cobrancaId,e]));
 const situacao=(c:Cobranca)=>pago(c)>=c.centavos?"Recebida":dataValida(c.vencimento)&&c.vencimento<hoje?"Em atraso":pago(c)>0?"Pagamento parcial":"Em aberto";
 const ordem=useOrdenacaoTabela(filtradas,[{titulo:"Cliente",valor:c=>c.clienteNome},{titulo:"Referência",valor:c=>c.competencia},{titulo:"Vencimento",valor:c=>c.vencimento},{titulo:"Saldo",valor:c=>Math.max(0,c.centavos-pago(c))},{titulo:"Situação",valor:situacao},{titulo:"Documentos",valor:c=>c.nota},{titulo:"Ações"}],"Vencimento",()=>setPagina(1),c=>c.competencia);
 const paginas=Math.max(1,Math.ceil(ordem.ordenadas.length/tamanho)),atual=Math.min(pagina,paginas),linhas=ordem.ordenadas.slice((atual-1)*tamanho,atual*tamanho);
 function filtrar<K extends keyof FiltrosFila>(k:K,v:FiltrosFila[K]){setFiltros(f=>({...f,[k]:v}));setPagina(1);}
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
 async function avisoPagamento(c:Cobranca,e:EmailCobranca){
  if(!await confirmar({titulo:`Preparar ${tiposAviso[tipoAviso].toLowerCase()}?`,subtitulo:"Reutilizar a cobrança, sem nova emissão",descricao:"Será criado um rascunho com os PDFs existentes e o saldo atualizado. Você poderá conferir, ajustar o texto e aprovar antes de enviar. Se o pagamento já ocorreu, a mensagem orientará a desconsiderar o aviso e enviar o comprovante.",confirmar:"Preparar para revisão",detalhes:[{rotulo:"Cliente",valor:c.clienteNome},{rotulo:"Saldo",valor:moeda(Math.max(0,c.centavos-pago(c)))},{rotulo:"Vencimento",valor:dataBr(c.vencimento)},{rotulo:"Cópia oculta",valor:"drsoft.log@gmail.com"}],observacao:"Preparar não envia e-mail, não gera juros e não interrompe serviços."}))return;
  setOcupado(true);setAviso("");
  try{const r=await fetch(`/api/admin/emails?empresa=${props.empresa}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao:"preparar-aviso",cobrancaId:c.id,origemId:e.id,tipo:tipoAviso})});const d=await lerRespostaAdmin<{email:EmailCobranca;erro?:string}>(r,true);if(!r.ok)throw Error(d.erro);setAberta(d.email);}catch(err){setAviso(err instanceof Error?err.message:"Não foi possível preparar o aviso.");}finally{setOcupado(false);}
 }
 if(aberta)return <section className="space-y-4"><button className={button} onClick={async()=>{if(await confirmar({titulo:"Voltar à fila de cobranças?",subtitulo:"Confira se salvou as alterações da mensagem",descricao:"As alterações não salvas não serão mantidas ao sair do editor. Os documentos já emitidos e os dados salvos da cobrança serão preservados.",confirmar:"Voltar à fila",cancelar:"Continuar revisando",detalhes:[{rotulo:"Cliente",valor:aberta.cliente},{rotulo:"Referência",valor:aberta.competencia.split("-").reverse().join("/")}]})){setAberta(null);void carregar();}}}>← Voltar à fila</button><LaboratorioEmails {...props} inicial={aberta} key={aberta.id}/></section>;
 return <section className="space-y-5">
 <header className="rounded-2xl border border-blue-200 bg-white p-5"><p className="text-xs font-bold uppercase text-blue-600">{props.empresa.toUpperCase()} · Cobranças e avisos</p><h2 className="mt-2 text-2xl font-black">Fila de cobranças</h2><p className="mt-2 text-sm text-slate-600">Localize a cobrança, confira documentos e revise o envio. Pagamentos recebidos ficam disponíveis no filtro; não exigem nova preparação.</p></header>
 <details className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm"><summary className="cursor-pointer font-bold">Como funciona a fila e o reenvio</summary><p className="mt-3">Preparar uma cobrança ou aviso não emite documentos nem envia e-mail. A geração de documentos depende da integração e aprovação específicas. Avisos reutilizam os PDFs existentes e conferem o saldo antes de aprovar e enviar. Nenhum aviso calcula encargos nem suspende serviços automaticamente. A preparação por agendamento ainda não está ativa.</p></details>
 <div className="grid gap-3 sm:grid-cols-3">{[{titulo:"Em aberto",valor:cobrancas.filter(c=>pago(c)<c.centavos).length},{titulo:"Em atraso",valor:cobrancas.filter(c=>pago(c)<c.centavos&&dataValida(c.vencimento)&&c.vencimento<hoje).length},{titulo:"Recebidas",valor:cobrancas.filter(c=>pago(c)>=c.centavos).length}].map(x=><div className="rounded-xl border border-slate-200 bg-white p-4" key={x.titulo}><p className="text-sm text-slate-500">{x.titulo}</p><p className="mt-1 text-2xl font-bold">{x.valor}</p></div>)}</div>
 <section aria-label="Filtros da fila" className="rounded-2xl border border-slate-200 bg-white p-5">
 <div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-semibold">Buscar cliente, serviço ou documento<input className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={filtros.busca} onChange={e=>filtrar("busca",e.target.value)} placeholder="Ex.: TFSeven, 928, suporte"/></label>
 <label className="text-sm font-semibold">Situação<select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={filtros.situacao} onChange={e=>filtrar("situacao",e.target.value)}><option value="abertas">Em aberto (padrão)</option><option value="atrasadas">Em atraso</option><option value="parciais">Pagamento parcial</option><option value="pagas">Recebidas</option><option value="todas">Todas</option></select></label>
 <label className="text-sm font-semibold">Filtrar período por<select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={filtros.data} onChange={e=>filtrar("data",e.target.value as FiltrosFila["data"])}><option value="vencimento">Vencimento</option><option value="competencia">Competência (primeiro dia do mês)</option><option value="envioPrevisto">Preparação prevista</option></select></label>
 <label className="text-sm font-semibold">Data inicial<input type="date" className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={filtros.inicio} onChange={e=>filtrar("inicio",e.target.value)}/></label><label className="text-sm font-semibold">Data final<input type="date" className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={filtros.fim} onChange={e=>filtrar("fim",e.target.value)}/></label>
 <label className="text-sm font-semibold">Tipo de aviso para preparar<select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={tipoAviso} onChange={e=>setTipoAviso(e.target.value as TipoAviso)}>{Object.entries(tiposAviso).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label></div>
 <div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={ocupado} onClick={()=>void carregar()}>{ocupado?"Carregando…":"Atualizar fila"}</button><button className={button} onClick={()=>{setFiltros(padrao);setPagina(1);ordem.restaurar();}}>Limpar filtros e restaurar ordem</button></div>
 <p className="mt-3 text-xs text-slate-500">Ordenação padrão: vencimento decrescente. Clique nos títulos para mudar. Sem data conhecida, a cobrança fica no final. Cópia oculta dos avisos: drsoft.log@gmail.com.</p>
 {filtros.inicio&&filtros.fim&&filtros.inicio>filtros.fim&&<p className="mt-2 text-sm text-red-700">A data inicial precisa ser anterior ou igual à final.</p>}
 </section>
 <MensagemAdmin mensagem={aviso} aoFechar={()=>setAviso("")} titulo="Confira a operação na fila" subtitulo="Nenhum envio automático será realizado" tom="erro" acao={()=>void carregar()} rotuloAcao="Atualizar fila"/>
 <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
 <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><p className="text-sm font-semibold">{filtradas.length} cobrança(s) encontradas · saldo do filtro {moeda(filtradas.reduce((s,c)=>s+Math.max(0,c.centavos-pago(c)),0))}</p><label className="text-sm">Por página <select className="ml-2 rounded-lg border p-2" value={tamanho} onChange={e=>{setTamanho(Number(e.target.value));setPagina(1);}}>{[10,20,50].map(n=><option key={n}>{n}</option>)}</select></label></div>
 <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>{ordem.cabecalhos}</tr></thead><tbody>
 {linhas.map(c=>{
 const e=originais.get(c.id),avisos=emails.filter(x=>x.aviso?.cobrancaId===c.id).sort((a,b)=>b.atualizadoEm.localeCompare(a.atualizadoEm));
 const saldo=Math.max(0,c.centavos-pago(c));
 const etapa=e?(e.status==="aceito"?"Envio aceito pelo provedor":e.status==="incerto"||e.status==="enviando"?"Conferir resultado do envio":e.status==="revisado"?"Aprovada para envio":e.fluxo?.documentos?"Revisar e-mail":"Conferir documentos"):"Sem e-mail preparado";
 const candidatos=emails.filter(x=>!x.fluxo&&!x.aviso&&["rascunho","revisado"].includes(x.status)&&x.competencia===c.competencia&&x.centavos===c.centavos&&x.vencimento===c.vencimento);
 return <tr key={c.id} className="border-t border-slate-100 align-top hover:bg-blue-50/30">
 <td className="min-w-64 px-3 py-4"><p className="font-bold text-slate-900">{c.clienteNome}</p><p className="mt-1 max-w-md text-xs text-slate-500">{c.descricao}</p></td>
 <td className="whitespace-nowrap px-3 py-4">{c.competencia.split("-").reverse().join("/")}</td><td className="whitespace-nowrap px-3 py-4">{dataBr(c.vencimento)}</td>
 <td className="whitespace-nowrap px-3 py-4"><p className="font-bold">{moeda(saldo)}</p><p className="mt-1 text-xs text-slate-500">Total {moeda(c.centavos)}</p>{pago(c)>0&&<p className="text-xs text-emerald-700">Recebido {moeda(pago(c))}</p>}</td>
 <td className="min-w-44 px-3 py-4"><span className={saldo===0?"rounded-full bg-emerald-50 px-2 py-1 text-emerald-700":"rounded-full bg-amber-50 px-2 py-1 text-amber-800"}>{situacao(c)}</span><p className="mt-2 text-xs text-slate-500">{etapa}</p></td>
 <td className="min-w-36 px-3 py-4">NFS-e {c.nota||e?.fluxo?.nota||"pendente"}<p className="mt-1 text-xs text-slate-500">{e?.formaPagamento==="pix"?"PIX — sem boleto":c.boleto?("Boleto "+c.boleto):"Boleto não informado"}</p></td>
 <td className="min-w-64 px-3 py-4"><div className="space-y-2">
 {e?<button className={button} disabled={ocupado} onClick={()=>setAberta(e)}>Abrir cobrança</button>:candidatos.length>0?candidatos.map(d=><button key={d.id} className={button} disabled={ocupado} onClick={async()=>{if(await confirmar({titulo:"Vincular rascunho à cobrança?",subtitulo:"Confira a identidade do cliente",descricao:"Datas e valores coincidem, mas confirme que este rascunho pertence ao cliente. A aprovação anterior será revogada.",confirmar:"Vincular e revisar",detalhes:[{rotulo:"Cliente",valor:c.clienteNome},{rotulo:"Rascunho",valor:d.cliente}],observacao:"Nenhum documento ou e-mail será emitido."}))void preparar(c,d.id);}}>Usar rascunho: {d.cliente}</button>):<button className={button} disabled={ocupado} onClick={()=>void preparar(c)}>{saldo===0?"Abrir histórico para revisão":"Preparar para revisão"}</button>}
 {e?.status==="aceito"&&saldo>0&&<button className={button} disabled={ocupado} onClick={()=>void avisoPagamento(c,e)}>Preparar aviso / reenvio</button>}
 {avisos.length>0&&<label className="block text-xs font-semibold">Histórico de avisos ({avisos.length})<select className="mt-1 w-full rounded-lg border p-2" value="" onChange={ev=>{const escolhido=avisos.find(x=>x.id===ev.target.value);if(escolhido)setAberta(escolhido);}}><option value="">Selecionar aviso para consultar</option>{avisos.map(a=><option key={a.id} value={a.id}>{tiposAviso[a.aviso!.tipo]} · {dataBr(a.aviso!.data)} · {a.status==="aceito"?"Aceito pelo provedor":a.status==="revisado"?"Aprovado":a.status==="rascunho"?"Rascunho":"Conferir resultado"}</option>)}</select></label>}
 </div></td></tr>;
 })}</tbody></table></div>
 {carregada&&!ocupado&&linhas.length===0&&<p className="p-8 text-center text-slate-500">{cobrancas.length?"Nenhuma cobrança corresponde aos filtros.":"Nenhuma cobrança prevista. Cadastre em Acompanhamento."}</p>}
 <nav aria-label="Paginação das cobranças" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4"><span className="text-sm text-slate-500">Página {atual} de {paginas}</span><div className="flex gap-2"><button className={button} disabled={atual===1} onClick={()=>setPagina(1)}>Primeira</button><button className={button} disabled={atual===1} onClick={()=>setPagina(atual-1)}>Anterior</button><button className={button} disabled={atual===paginas} onClick={()=>setPagina(atual+1)}>Próxima</button><button className={button} disabled={atual===paginas} onClick={()=>setPagina(paginas)}>Última</button></div></nav>
 </section></section>;
}
