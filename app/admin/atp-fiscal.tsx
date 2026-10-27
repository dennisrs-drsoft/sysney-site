"use client";
import {useEffect,useState} from 'react';
import {MensagemAdmin,ModalAdmin,useConfirmarAdmin} from './dialogos-admin';
type Row={id:string;source:string;externalReference:string;amountCentsBRL:number;competence:string;status:string;reviewStatus:string;invoiceNumber:string|null};
const estados:Record<string,string>={pending_review:'Aguardando revisão fiscal',prepared:'Preparada',transmitting:'Transmitindo',uncertain:'Resultado incerto — consultar',rejected:'Rejeitada',issued:'Nota emitida'};
export function AtpFiscal({empresa}:{empresa:'sysney'|'drsoft'}){
 const confirmar=useConfirmarAdmin();
 const [selected,setSelected]=useState<Row|null>(null),[workId,setWorkId]=useState(''),[reasons,setReasons]=useState<string[]>([]),[available,setAvailable]=useState(false),[preview,setPreview]=useState<{previewHash:string;preview:{snapshotHash:string;number:string;issuerDocument:string;recipientDocument:string;amountCentsBRL:number;competence:string;xmlHash:string;pdfHash:string|null}}|null>(null);
 const [rows,setRows]=useState<Row[]>([]),[cursor,setCursor]=useState<string|null>(null),[loading,setLoading]=useState(false),[erro,setErro]=useState('');
 async function load(next?:string){setLoading(true);try{const q=new URLSearchParams({empresa:'sysney'});if(next)q.set('cursor',next);const r=await fetch('/api/admin/atp-fiscal?'+q,{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.erro||'Consulta indisponível.');setRows(old=>next?[...old,...d.solicitacoes]:d.solicitacoes);setCursor(d.nextCursor);}catch(e){setErro(e instanceof Error?e.message:'Consulta indisponível.');}finally{setLoading(false);}}
 useEffect(()=>{if(empresa==='sysney')void load();},[empresa]);
 async function review(row:Row){setSelected(row);setWorkId('');setPreview(null);setAvailable(false);setReasons(['Conferindo requisitos fiscais…']);try{const r=await fetch('/api/admin/atp-fiscal?empresa=sysney&acao=vinculo-capacidades',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível conferir a integração.');setAvailable(d.disponivel===true);setReasons(d.motivos||[]);}catch(e){setReasons([e instanceof Error?e.message:'Consulta indisponível.']);}}
 async function action(kind:'preview'|'approve'){
  if(!selected||!available||loading)return;
  if(kind==='approve'&&(!preview||!await confirmar({titulo:'Confirmar vínculo fiscal ATP',subtitulo:'Documento existente — sem nova emissão',descricao:'Confirme os dados e hashes da prévia. Esta ação vincula a nota existente e registra sua aprovação; não envia e-mail.',confirmar:'Confirmar vínculo',cancelar:'Voltar e revisar',detalhes:[{rotulo:'Nota',valor:preview.preview.number},{rotulo:'Referência ATP',valor:selected.externalReference}]})))return;
  setLoading(true);try{const r=await fetch('/api/admin/atp-fiscal?empresa=sysney',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:kind,requestId:selected.id,workId,...(kind==='approve'?{confirmed:true,snapshotHash:preview!.preview.snapshotHash,previewHash:preview!.previewHash}:{})})}),d=await r.json();if(!r.ok)throw Error(d.erro||'Vínculo não confirmado.');if(kind==='preview')setPreview(d);else{setSelected(null);await load();}}catch(e){setErro(e instanceof Error?e.message:'Operação indisponível.');setPreview(null);}finally{setLoading(false);}
 }
 if(empresa!=='sysney')return <p>As solicitações ATP são emitidas pela SYSNEY. Selecione SYSNEY para consultar.</p>;
 return <section>
  <h2>Solicitações fiscais · ATP</h2>
  <p>Preparações originadas no ATP, separadas das cobranças financeiras. Emissão automática desabilitada. Vínculos reais exigem homologação fiscal.</p>
  <button onClick={()=>void load()} disabled={loading}>Atualizar solicitações</button>
  <MensagemAdmin mensagem={erro} aoFechar={()=>setErro('')} titulo="Consulta ATP" subtitulo="Solicitações fiscais"/>
  <div style={{overflowX:'auto'}}><table><thead><tr><th>Origem / referência</th><th>Competência</th><th>Valor bruto</th><th>Situação fiscal</th><th>Nota / revisão</th><th>Ações</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}>
   <td>{r.source} · {r.externalReference}</td><td>{r.competence}</td><td>{(r.amountCentsBRL/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td>{estados[r.status]||r.status}</td>
   <td>{r.invoiceNumber?`NFS-e ${r.invoiceNumber}`:'Sem nota vinculada'}{r.reviewStatus==='refund_review_required'&&<strong> · Estorno: revisão fiscal pendente, nota não cancelada automaticamente</strong>}{r.reviewStatus==='fiscal_review_required'&&<strong> · Revisão fiscal necessária; documentos indisponíveis até conferência</strong>}</td>
   <td><button onClick={()=>void review(r)} disabled={loading}>Revisar vínculo fiscal</button></td>
  </tr>)}</tbody></table></div>
  {!loading&&!rows.length&&<p>Nenhuma solicitação ATP registrada. Pagamentos históricos e cortesias não são importados automaticamente.</p>}
  {cursor&&<button disabled={loading} onClick={()=>void load(cursor)}>Carregar mais solicitações</button>}
  <ModalAdmin aberto={!!selected} aoFechar={()=>{if(!loading)setSelected(null);}} ocupado={loading} titulo="Revisar vínculo fiscal ATP" subtitulo="Nota existente · nenhuma nova emissão" descricao="O vínculo depende de proveniência ATP anterior à autorização e de documentos oficiais conferidos. Não é permitido associar uma nota apenas porque valor e cliente coincidem." detalhes={selected?[{rotulo:'Referência',valor:selected.externalReference},{rotulo:'Competência',valor:selected.competence}]:[]}>
   {!available&&<div><h3>Aprovação indisponível</h3><ul>{reasons.map(reason=><li key={reason}>{reason}</li>)}</ul><p>Nenhum documento será emitido, vinculado ou enviado enquanto esses requisitos não estiverem homologados.</p></div>}
   {available&&<><label>Identificador interno do trabalho ATP<input value={workId} maxLength={64} onChange={e=>{setWorkId(e.target.value);setPreview(null);}}/></label><button disabled={loading||!/^[a-f0-9]{64}$/.test(workId)} onClick={()=>void action('preview')}>Conferir prévia do vínculo</button>
   {preview&&<div><h3>NFS-e {preview.preview.number}</h3><p>Emitente: {preview.preview.issuerDocument} · Tomador: {preview.preview.recipientDocument}</p><p>Competência: {preview.preview.competence} · Valor: {(preview.preview.amountCentsBRL/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p><p style={{overflowWrap:'anywhere'}}>SHA-256 XML: {preview.preview.xmlHash}<br/>PDF: {preview.preview.pdfHash||'Pendente — não impede nota já emitida'}</p><button disabled={loading} onClick={()=>void action('approve')}>Revisar e aprovar vínculo — sem emitir</button></div>}</>}
  </ModalAdmin>
 </section>;
}
