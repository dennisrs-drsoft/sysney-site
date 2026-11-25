import {entidadeLoteFiscal,lerLoteFiscal} from "./regularizacao-emissao-store";
import {criarCobrancaRegularizada,type ArquivoRegularizacao} from "./regularizacao-cobranca";
import {randomUUID,createHash} from "node:crypto";
import type {TableClient,TransactionAction} from "@azure/data-tables";
import {hojeBrasil,type Empresa,type Cobranca} from "./cobrancas";
import {novoEmail,type EmailCobranca} from "./emails-cobranca";
import type {RegularizacaoFiscal} from "./regularizacao-fiscal";
import {normalizarFiscalSP} from "./nfse-sp";
import {normalizarPerfilNacional,validarDadosNacionais} from "./nfse-nacional";
import {orientacaoEmissor} from "./perfil-fiscal-historico";
import {operarMunicipal} from "./nfse-municipal-runtime";
import {operarNacional,statusNacional} from "./nfse-nacional-runtime";
import {prepararNacional} from "./nfse-nacional-preparacao";
import {particaoDocumentoFiscal,particaoControleFiscal,type ContextoFiscal} from "./contexto-fiscal";
import {digestFiscal,fonteRecebimento,validarRecebimentosEmissao,manifestoLote,identidadesItem,podeRevisarLote,type ConfiguracaoLoteFiscal,type LoteEmissaoFiscal,type ItemLoteFiscal} from "./regularizacao-emissao-modelo";

type Tabela=(nome?:string)=>TableClient;
type Registro={json:string};
type Dependencias={table:Tabela;hoje?:()=>string;agora?:()=>string;nacional?:typeof operarNacional;municipal?:typeof operarMunicipal;preparar?:typeof prepararNacional;arquivo?:ArquivoRegularizacao};
const errorCode=(e:unknown)=>(e as {statusCode?:number}).statusCode;
function responsavel(req:Request){const p=req.headers.get("x-ms-client-principal");return p?String(JSON.parse(Buffer.from(p,"base64").toString()).userDetails||"Administrador").slice(0,254):"Administrador local";}
const seguroErro=()=>"Não foi possível confirmar a etapa. Consulte o mesmo documento; não crie outro lote para este pagamento.";

export function criarRegularizacaoEmissao(deps:Dependencias){
  const {table}=deps,hoje=deps.hoje||hojeBrasil,agora=deps.agora||(()=>new Date().toISOString());
  const nacional=deps.nacional||operarNacional,municipal=deps.municipal||operarMunicipal,preparar=deps.preparar||prepararNacional;
  const part=(emp:Empresa)=>`regularizacao-${emp}`;
  async function opcional<T extends object>(p:string,k:string,nome="AdminDocumentos"){try{return await table(nome).getEntity<T>(p,k);}catch(e){if(errorCode(e)!==404)throw e;return null;}}
  async function registro(emp:Empresa,id:string){if(!/^[a-f0-9]{64}$/.test(id))throw Error("Pagamento inválido.");const row=await table().getEntity<Registro>(part(emp),id);return {row,r:JSON.parse(row.json) as RegularizacaoFiscal};}
  async function lote(emp:Empresa,id:string){if(!/^emissao-[a-f0-9]{64}$/.test(id))throw Error("Lote inválido.");const row=await table().getEntity<Registro>(part(emp),id),l: LoteEmissaoFiscal=lerLoteFiscal(row);if(l.empresa!==emp||l.tipo!=="emissao-regularizacao")throw Error("Lote de outra empresa.");return {row,l};}
  async function regime(emp:Empresa){const row=await opcional<Registro>("nfse-regimes",emp,"AdminConfiguracoes");const historico: {regime:string;vigencia:string}[]=row?JSON.parse(row.json).historico:[];const value=historico.filter(x=>x.vigencia<=hoje()).sort((a,b)=>b.vigencia.localeCompare(a.vigencia))[0]?.regime;if(!["simples","presumido"].includes(value))throw Error("Configure o regime fiscal vigente da empresa.");return value as "simples"|"presumido";}
  async function fontes(l:LoteEmissaoFiscal){
    for(const i of l.itens){
      const {r}=await registro(l.empresa,i.recebimentoId);
      if(fonteRecebimento(r)!==i.fonteHash||r.notasCandidatas.length)throw Error("Um pagamento foi alterado ou já possui nota a conferir. Atualize o lote antes de continuar.");
      if(r.nota&&r.nota!==i.nota){
        // O vínculo pode ter sido salvo antes de uma queda na última gravação do lote.
        // Só permite recuperar a nota já confirmada pela identidade fiscal deste item.
        const w=await trabalho(l,i);
        if(w?.status!=="emitida"||w.resultado?.numero!==r.nota)throw Error("Pagamento já possui outra nota. Confira o vínculo existente, sem emitir novamente.");
      }
    }
  }
  async function contexto(l:LoteEmissaoFiscal,i:ItemLoteFiscal):Promise<ContextoFiscal>{
    const ids=identidadesItem(l,i.recebimentoId),origem="regularizacao" as const;
    const ep=particaoDocumentoFiscal(l.empresa,{origem}),cp=particaoControleFiscal(l.empresa,{origem});
    let er=await opcional<Registro>(ep,ids.emailId),cr=await opcional<Registro>(cp,ids.controleId);
    if(!er||!cr){
      const email:EmailCobranca={...novoEmail(l.empresa,i.cliente),id:ids.emailId,descricao:i.descricao,competencia:l.dataFiscal.slice(0,7),centavos:i.centavos,vencimento:i.recebimento,observacoes:"Pagamento já recebido. Documento fiscal de regularização, sem nova cobrança.",atualizadoEm:l.criadoEm,fluxo:{cobrancaId:ids.controleId,nota:"",boleto:""}};
      const c:Cobranca={id:ids.controleId,planoId:i.recebimentoId,competencia:email.competencia,clienteNome:i.cliente,email:"",descricao:i.descricao,centavos:i.centavos,envioPrevisto:l.dataFiscal,vencimento:i.recebimento,nota:"",boleto:"",demonstrativo:false,persistida:true,eventos:[]};
      const criar=async(p:string,k:string,obj:object)=>{try{await table().createEntity({partitionKey:p,rowKey:k,json:JSON.stringify(obj)});}catch(e){if(errorCode(e)!==409)throw e;}};
      if(!er)await criar(ep,ids.emailId,email);if(!cr)await criar(cp,ids.controleId,c);
      er=await opcional<Registro>(ep,ids.emailId);cr=await opcional<Registro>(cp,ids.controleId);
    }
    if(!er||!cr)throw Error("Preparação documental incompleta. Retome o mesmo lote.");
    const email:EmailCobranca=JSON.parse(er.json),cobranca:Cobranca=JSON.parse(cr.json);
    if(email.empresa!==l.empresa||email.centavos!==i.centavos||email.descricao!==i.descricao||cobranca.centavos!==i.centavos)throw Error("Contexto fiscal divergente do pagamento.");
    return {origem,email,cobranca,row:er,cr,documento:i.documento,idNota:ids.idNota};
  }
  async function trabalho(l:LoteEmissaoFiscal,i:ItemLoteFiscal){
    const id=identidadesItem(l,i.recebimentoId).idNota;
    if(l.configuracao.emissor==="municipal"){const r=await opcional<Registro>(`nfse-sp-${l.empresa}`,id);return r?JSON.parse(r.json):null;}
    const key=createHash("sha256").update(`${l.empresa}:${id}:${l.configuracao.ambiente}:nacional-admin-v1`).digest("hex");
    const r=await opcional<Registro>(`nfse-nacional-trabalhos-${l.empresa}`,key);return r?JSON.parse(r.json):null;
  }
  async function historico(l:LoteEmissaoFiscal,i:ItemLoteFiscal,req:Request){
    if(i.status!=="emitida")return;
    try{
      const w=await trabalho(l,i);
      if(w?.status!=="emitida"||w.resultado?.numero!==i.nota||w.resultado?.chave!==i.chave)throw Error("Nota ainda não confirmada no trabalho fiscal.");
      const source=await registro(l.empresa,i.recebimentoId);
      if(fonteRecebimento(source.r)!==i.fonteHash)throw Error("O pagamento mudou depois da emissão.");
      const ref=await criarCobrancaRegularizada({table,lote:l,item:i,recebimento:source.r,por:responsavel(req),em:agora(),arquivo:deps.arquivo});
      i.historicoCobranca=ref;delete i.erroHistorico;
      if(source.r.cobrancaId!==ref.cobrancaId||source.r.emailId!==ref.emailId){source.r.cobrancaId=ref.cobrancaId;source.r.emailId=ref.emailId;source.r.atualizadoEm=agora();await table().updateEntity({partitionKey:part(l.empresa),rowKey:source.r.id,json:JSON.stringify(source.r)},"Replace",{etag:source.row.etag});}
    }catch{ i.erroHistorico="Nota emitida e preservada. A cobrança paga ou o rascunho ainda precisa ser organizado. Retome o histórico sem reemitir a nota."; }
  }
  async function organizarHistorico(emp:Empresa,id:string,body:Record<string,unknown>,req:Request){
    const {row,l}=await lote(emp,id);
    if(body.confirmado!==true||body.hash!==l.hash||l.hash!==manifestoLote(l)||l.execucao||l.configuracao.ambiente!=="producao"||!l.itens.some(i=>i.status==="emitida"))throw Error("Confirme o lote já emitido antes de organizar cobranças e rascunhos.");
    await fontes(l);
    for(const i of l.itens)if(i.status==="emitida")await historico(l,i,req);
    l.atualizadoEm=agora();await table().updateEntity(entidadeLoteFiscal(l),"Replace",{etag:row.etag});return l;
  }
  async function configuracao(emp:Empresa,documento?:string){
    const reg=await regime(emp),emissor=orientacaoEmissor(reg,hoje().slice(0,7),hoje()).tipo==="nacional"?"nacional":"municipal";
    let perfil=null,fiscal=null,endereco=null;
    if(documento&&/^\d{14}$/.test(documento)){
      const [n,m]=await Promise.all([opcional<Registro>(`nfse-nacional-perfis-${emp}`,documento,"AdminConfiguracoes"),opcional<Registro>(`nfse-perfil-${emp}`,documento,"AdminConfiguracoes")]);
      perfil=n?JSON.parse(n.json).perfil:null;fiscal=m?JSON.parse(m.json).fiscal:null;endereco=fiscal?.endereco||null;
      if(!endereco){let data="";for await(const row of table().listEntities<Registro>({queryOptions:{filter:`PartitionKey eq 'nfse-nacional-previas-${emp}'`}})){const p=JSON.parse(row.json);if(p.dados?.documento===documento&&p.atualizadoEm>data){data=p.atualizadoEm;endereco=p.dados.endereco;}}}
    }
    const modelos:{id:string;titulo:string;perfil?:ConfiguracaoLoteFiscal["perfil"];fiscal?:ConfiguracaoLoteFiscal["fiscal"]}[]=[];
    const perfilPart=emissor==="nacional"?`nfse-nacional-perfis-${emp}`:`nfse-perfil-${emp}`;
    for await(const row of table("AdminConfiguracoes").listEntities<Registro>({queryOptions:{filter:`PartitionKey eq '${perfilPart}'`}})){
      const saved=JSON.parse(row.json),value=emissor==="nacional"?saved.perfil:saved.fiscal;
      if(!value)continue;const id=digestFiscal(value);if(modelos.some(m=>m.id===id))continue;
      modelos.push({id,titulo:emissor==="nacional"?`Nacional ${value.codigoNacional} · série ${value.serie}`:`Municipal ${value.codigoServico} · série ${value.serie}`,...(emissor==="nacional"?{perfil:value}:{fiscal:value})});
    }
    const saude=await statusNacional(table,emp,"consulta-regularizacao","producao");
    const municipalSaude=await opcional<{em:string;modo:string}>("servico","drserver","FiscalFila");
    const age=municipalSaude?Date.now()-Date.parse(municipalSaude.em):Infinity;
    return {emissor,regime:reg,dataFiscal:hoje(),perfil,fiscal,endereco,modelos,disponivel:emissor==="nacional"?saude.disponivel:age>=-30000&&age<120000,producaoHabilitada:emissor==="nacional"?saude.producao:process.env.NFSE_SP_PRODUCAO_HABILITADA==="true"&&process.env.NFSE_SP_VM_PRODUCAO_HABILITADA==="true"&&municipalSaude?.modo==="producao",limite:30};
  }
  async function listar(emp:Empresa){const lotes:LoteEmissaoFiscal[]=[];for await(const row of table().listEntities<Registro>({queryOptions:{filter:`PartitionKey eq '${part(emp)}'`}})){const r=JSON.parse(row.json);if(r.tipo==="emissao-regularizacao"&&r.empresa===emp)lotes.push(lerLoteFiscal(row));}return lotes.sort((a,b)=>b.criadoEm.localeCompare(a.criadoEm));}
  async function criar(emp:Empresa,body:Record<string,unknown>,req:Request){
    if(body.confirmado!==true)throw Error("Confirme os dados fiscais e a série exclusiva do lote.");
    if(!Array.isArray(body.recebimentos)||body.recebimentos.length>30)throw Error("Selecione até 30 pagamentos por lote.");
    const entries=await Promise.all(body.recebimentos.map(async v=>{if(!v||typeof v!=="object")throw Error("Pagamento inválido.");const item=v as {id:string;atualizadoEm:string};const x=await registro(emp,item.id);if(x.r.atualizadoEm!==item.atualizadoEm)throw Error("Pagamento alterado. Atualize a seleção.");return x;}));
    const lista=entries.map(x=>x.r);validarRecebimentosEmissao(lista,emp);
    if(new Set(lista.map(x=>x.documento)).size!==1)throw Error("Selecione um cliente por lote para conferir o mesmo perfil fiscal.");
    if(new Set(lista.map(x=>x.endToEndId||x.transacao)).size!==lista.length)throw Error("O mesmo PIX aparece mais de uma vez. Confira o histórico.");
    const raw=body.configuracao as ConfiguracaoLoteFiscal,reg=await regime(emp),expected=orientacaoEmissor(reg,hoje().slice(0,7),hoje()).tipo==="nacional"?"nacional":"municipal";
    if(!raw||raw.emissor!==expected||!["homologacao","producao"].includes(raw.ambiente)||raw.emissor==="municipal"&&raw.ambiente!=="producao")throw Error("Confira emissor e ambiente. O teste municipal usa TesteEnvioLoteRPS, sem emissão real.");
    let config:ConfiguracaoLoteFiscal;
    if(raw.emissor==="nacional"){
      const perfil=normalizarPerfilNacional(raw.perfil),issuer=await opcional<{cnpj:string}>("nfse-emitentes",emp,"AdminConfiguracoes");
      validarDadosNacionais({empresa:emp,cnpj:process.env[`NFSE_${emp.toUpperCase()}_CNPJ`]||issuer?.cnpj||"",regime:reg,documento:lista[0].documento,cliente:lista[0].cliente,centavos:lista[0].centavos,descricao:lista[0].descricao,referencia:hoje().slice(0,7),competenciaFiscal:hoje(),emissao:hoje(),endereco:raw.endereco!,perfil},hoje());
      config={emissor:raw.emissor,ambiente:raw.ambiente,perfil,endereco:raw.endereco};
    }else{
      const fiscal=normalizarFiscalSP({...raw.fiscal,regime:reg,dataEmissao:hoje()},lista[0].centavos);
      if(lista.length>1&&([fiscal.inss,fiscal.ipi,fiscal.deducoes].some(v=>v!==0)||!fiscal.calcularRetencoes&&[fiscal.pis,fiscal.cofins,fiscal.ir,fiscal.csll].some(v=>v!==0)))throw Error("Para várias notas, use alíquotas calculadas por valor; não copie retenções fixas de outra nota.");
      config={emissor:raw.emissor,ambiente:raw.ambiente,fiscal};
    }
    const ids=lista.map(r=>r.id).sort(),selection=createHash("sha256").update(ids.join("|")).digest("hex"),id=`emissao-${selection}`,old=await opcional<Registro>(part(emp),id);
    const anterior:LoteEmissaoFiscal|null=old?lerLoteFiscal(old):null;
    if(anterior&&body.revisar!==true){if(anterior.dataFiscal!==hoje()||digestFiscal(anterior.configuracao)!==digestFiscal(config))throw Error("O lote já existe. Abra-o e use Revisar prévias; não crie outra tentativa.");return anterior;}
    const promover=anterior?.configuracao.ambiente==="homologacao"&&anterior.itens.every(i=>i.status==="homologada"&&i.pdf&&i.xml)&&config.ambiente==="producao";
    if(anterior){if(!podeRevisarLote(anterior))throw Error("Há transmissão aprovada ou resultado pendente. Consulte o documento existente, sem substituir a preparação.");for(const item of anterior.itens){const w=await trabalho(anterior,item);if(promover?w?.status!=="homologada":w?.aprovacao||["transmitindo","incerta","emitida","homologada"].includes(w?.status))throw Error("Há tentativa fiscal que precisa de consulta antes de revisar.");}}
    const now=agora(),l:LoteEmissaoFiscal={id,tipo:"emissao-regularizacao",empresa:emp,dataFiscal:hoje(),configuracao:config,versao:(anterior?.versao||0)+1,hash:"",estado:"preparado",criadoEm:anterior?.criadoEm||now,atualizadoEm:now,responsavel:responsavel(req),itens:lista.sort((a,b)=>a.recebimento.localeCompare(b.recebimento)||a.id.localeCompare(b.id)).map(r=>({recebimentoId:r.id,documento:r.documento,cliente:r.cliente,centavos:r.centavos,recebimento:r.recebimento,referencia:r.competencia,descricao:`${r.descricao}${r.competencia?` Referência do serviço: ${r.competencia}.`:""} PIX recebido em ${r.recebimento}. Serviço já pago; sem novo valor a pagar.`,fonteHash:fonteRecebimento(r),status:"pendente"})),...(anterior?{historico:[...(anterior.historico||[]),{em:now,hash:anterior.hash,versao:anterior.versao,motivo:promover?"Homologação concluída preservada; nova versão para aprovação de produção":"Prévia anterior sem aprovação de transmissão substituída pelo administrador"}]}:{})};l.hash=manifestoLote(l);
    const entity=entidadeLoteFiscal(l);
    const tx:TransactionAction[]=[old?["update",entity,"Replace",{etag:old.etag}]:["create",entity]];
    for(const x of entries){
      for(const key of [`reserva-${x.r.id}`,`reserva-pix-${digestFiscal(x.r.endToEndId||x.r.transacao)}`]){
        const saved=await opcional<Registro>(part(emp),key),owner=saved?JSON.parse(saved.json).loteId:null;
        if(owner&&owner!==id&&owner!==`lote-${selection}`)throw Error("Pagamento reservado em outro lote. Retome a mesma seleção já preparada.");
        tx.push(saved?["update",{partitionKey:part(emp),rowKey:key,json:JSON.stringify({loteId:id})},"Replace",{etag:saved.etag}]:["create",{partitionKey:part(emp),rowKey:key,json:JSON.stringify({loteId:id})}]);
      }
      tx.push(["update",{partitionKey:part(emp),rowKey:x.r.id,json:JSON.stringify(x.r)},"Replace",{etag:x.row.etag}]);
    }
    await table().submitTransaction(tx);return l;
  }
  async function aprovar(emp:Empresa,id:string,body:Record<string,unknown>,req:Request){
    const {row,l}=await lote(emp,id);await fontes(l);
    if(l.dataFiscal!==hoje()||l.hash!==manifestoLote(l)||body.hash!==l.hash||body.confirmado!==true||l.execucao||!l.itens.every(i=>i.status==="pronta"))throw Error("Valide todas as prévias atuais e confirme os dados do lote de hoje.");
    for(const i of l.itens){const w=await trabalho(l,i);if(l.configuracao.emissor==="nacional"?w?.status!=="assinada":w?.status!=="testada"||!w.teste?.resultado?.sucesso||Date.now()-Date.parse(w.teste.em)>1800000)throw Error("Uma prévia ainda não está validada ou o teste municipal expirou. Valide novamente.");}
    const saude=await configuracao(emp);
    if(!saude.disponivel||l.configuracao.ambiente==="producao"&&!saude.producaoHabilitada)throw Error("O emissor não está disponível para transmissão neste ambiente. Nenhuma emissão aprovada.");
    if(l.configuracao.emissor==="nacional"){
      const ph=digestFiscal(l.configuracao.perfil),issuer=await opcional<{cnpj:string}>("nfse-emitentes",emp,"AdminConfiguracoes");
      const cnpj=process.env[`NFSE_${emp.toUpperCase()}_CNPJ`]||issuer?.cnpj;
      const rowPolicy=await opcional<Registro>("nfse-nacional-politicas",emp,"AdminConfiguracoes"),policy=rowPolicy?JSON.parse(rowPolicy.json):null;
      if(!policy||policy.cnpj!==cnpj||!Array.isArray(policy.perfis)||!policy.perfis.includes(ph)||policy[l.configuracao.ambiente]!==true)throw Error("Perfil nacional ainda não liberado na política protegida deste emitente. Nenhuma emissão aprovada.");
      if(l.configuracao.ambiente==="producao"){
        const h=await opcional<Registro>(`nfse-nacional-homologacoes-${emp}`,ph);
        if(!h||JSON.parse(h.json).cnpj!==cnpj)throw Error("Este perfil ainda não concluiu homologação com XML e PDF confirmados.");
        if(saude.regime==="presumido"&&policy.habilitacaoPresumidoConfirmada!==true)throw Error("Habilitação nacional do Lucro Presumido ainda não confirmada.");
      }
    }
    l.aprovacao={hash:l.hash,por:responsavel(req),em:agora()};l.estado="aprovado";l.atualizadoEm=agora();await table().updateEntity(entidadeLoteFiscal(l),"Replace",{etag:row.etag});return l;
  }
  async function avancar(emp:Empresa,id:string,body:Record<string,unknown>,req:Request){
    const {row,l}=await lote(emp,id),modo=body.modo;
    if(!["validar","emitir","consultar"].includes(String(modo)))throw Error("Etapa inválida.");
    if(l.hash!==manifestoLote(l)||body.hash!==l.hash)throw Error("O lote mudou. Atualize a revisão.");
    if(modo!=="consultar"&&l.dataFiscal!==hoje())throw Error("A data de emissão mudou. Revise as prévias sem transmissão antes de aprovar.");
    if(modo==="emitir"&&l.aprovacao?.hash!==l.hash)throw Error("Aprove explicitamente o lote validado antes de transmitir.");
    if(modo==="validar"&&l.aprovacao)throw Error("Lote já aprovado. Retome a emissão ou consulte a tentativa existente.");
    await fontes(l);
    if(l.execucao){if(Date.now()-Date.parse(l.execucao.em)<120000)return l;const affected=l.itens.find(i=>i.recebimentoId===l.execucao!.recebimentoId);if(affected){affected.status="incerta";affected.mensagem="A etapa anterior perdeu a resposta. Consulte a mesma nota antes de continuar.";}delete l.execucao;l.estado="revisar";await table().updateEntity(entidadeLoteFiscal(l),"Replace",{etag:row.etag});return l;}
    const i=modo==="consultar"?l.itens.find(i=>i.recebimentoId===body.recebimentoId):l.itens.find(i=>modo==="validar"?!["pronta","emitida","homologada"].includes(i.status):!["emitida","homologada"].includes(i.status));
    if(!i){l.estado=modo==="validar"?"pronto":"concluido";await table().updateEntity(entidadeLoteFiscal(l),"Replace",{etag:row.etag});return l;}
    if(modo!=="consultar"&&["incerta","rejeitada"].includes(i.status))throw Error("Há um item pendente de revisão. Consulte ou corrija as prévias antes de continuar.");
    const token=randomUUID();l.execucao={id:token,em:agora(),recebimentoId:i.recebimentoId};l.estado=modo==="validar"?"validando":"processando";
    await table().updateEntity(entidadeLoteFiscal(l),"Replace",{etag:row.etag});
    try{
      const ctx=await contexto(l,i),reg=await regime(emp);let w=await trabalho(l,i);let resposta:{trabalho?:{status:string;resultado?:{numero?:string;chave?:string;xmlBlob?:string;pdfBlob?:string};teste?:{resultado?:{erros?:string[]}}};mensagem?:string}={};
      if(l.configuracao.emissor==="nacional"){
        const args={table,emp,ctx,req,regime:reg};
        let action:string|null=null;
        if(modo==="validar")action=!w?"nacional-assinar":w.status==="assinando"?"nacional-resultado":null;
        else if(modo==="consultar"){
          if(!w)throw Error("Não existe tentativa fiscal. Revise a preparação, sem transmitir.");
          action=i.consultaPendente||["assinando","transmitindo"].includes(w.status)?"nacional-resultado":"nacional-consultar";
        }else action=w?.status==="assinada"?"nacional-emitir":w?.status==="transmitindo"?"nacional-resultado":null;
        if(modo==="validar"&&!w){await preparar({table,emp,c:ctx,regime:reg,body:{confirmado:true,atualizadoEm:ctx.email.atualizadoEm,perfil:l.configuracao.perfil,endereco:l.configuracao.endereco,competenciaFiscal:l.dataFiscal}});const p=await table().getEntity<Registro>(`nfse-nacional-previas-${emp}`,ctx.idNota);resposta=await nacional({...args,body:{acao:"nacional-assinar",ambiente:l.configuracao.ambiente,hash:JSON.parse(p.json).hash,confirmarSerie:true,atualizadoEm:ctx.email.atualizadoEm}});}
        else if(action)resposta=await nacional({...args,body:{acao:action,ambiente:l.configuracao.ambiente,hash:w?.hash,aprovado:modo==="emitir",atualizadoEm:ctx.email.atualizadoEm}});
        w=resposta.trabalho||await trabalho(l,i);
        if(modo==="consultar"&&resposta.mensagem?.startsWith("Consulta da mesma")){i.status="processando";i.consultaPendente=true;}
        else if(modo==="consultar"&&i.consultaPendente&&resposta.mensagem?.includes("processando a tarefa")){i.status="processando";}
        else if(modo==="consultar"){i.consultaPendente=false;}
        if(!i.consultaPendente){
          if(w?.status==="assinada")i.status="pronta";else if(w?.status==="assinando")i.status="validando";else if(w?.status==="transmitindo")i.status="processando";else if(w?.status==="rejeitada")i.status="rejeitada";else if(w?.status==="incerta")i.status="incerta";
        }
      }else{
        const action=modo==="validar"?(!w?"preparar":"testar"):modo==="consultar"?"consultar":w?.status==="testada"?"emitir":w?.status==="emitida"?"consultar":null;
        if(action)resposta=await municipal({table,emp,ctx,req,regime:reg,body:{acao:action,hash:w?.hash,atualizadoEm:ctx.email.atualizadoEm,confirmarSerie:true,aprovado:modo==="emitir",fiscal:{...l.configuracao.fiscal,regime:reg,dataEmissao:l.dataFiscal}}});
        w=resposta.trabalho||await trabalho(l,i);
        if(w?.status==="preparada")i.status="validando";else if(w?.status==="testada")i.status="pronta";else if(w?.status==="testando")i.status="validando";else if(w?.status==="rejeitada")i.status="rejeitada";else if(w?.status==="incerta"||w?.status==="transmitindo")i.status="incerta";
      }
      i.mensagem=resposta.mensagem||"Etapa consultada.";
      if(!i.consultaPendente&&["emitida","homologada"].includes(w?.status)){
        i.status=w.status;i.nota=w.resultado?.numero;i.chave=w.resultado?.chave;
        const er=await table().getEntity<Registro>(particaoDocumentoFiscal(emp,ctx),ctx.email.id),doc:EmailCobranca=JSON.parse(er.json);i.pdf=w.resultado?.pdfBlob||doc.anexos.find(a=>a.tipo==="nota")?.blob;i.xml=w.resultado?.xmlBlob;
        if(l.configuracao.emissor==="municipal"&&w.resultado?.numero)i.xml=`historico/${emp}/nfse/regularizacao-${ctx.idNota}-${w.resultado.numero}-consulta.xml`;
        if(i.status==="emitida"&&i.nota){
          const bp=`regularizacao-vinculos-${emp}`,key=digestFiscal({emissor:l.configuracao.emissor,nota:i.nota,chave:i.chave||""});
          const saved=await opcional<{recebimentoId:string}>(bp,key);if(saved&&saved.recebimentoId!==i.recebimentoId)throw Error("Nota já vinculada a outro pagamento. Consulte o resultado, sem reemitir.");
          if(!saved){try{await table().createEntity({partitionKey:bp,rowKey:key,recebimentoId:i.recebimentoId,loteId:l.id,nota:i.nota});}catch(e){if(errorCode(e)!==409)throw e;const existing=await table().getEntity<{recebimentoId:string}>(bp,key);if(existing.recebimentoId!==i.recebimentoId)throw Error("Nota já vinculada a outro pagamento.");}}
        }
        if(i.status==="emitida"&&i.nota&&l.configuracao.emissor==="municipal"){
          const hp=`nfse-historico-${emp}`,old=await opcional<Registro>(hp,i.nota);if(old){const prior=JSON.parse(old.json);if(prior.documento!==i.documento||prior.centavos!==i.centavos)throw Error("Número municipal vinculado a outro documento. Concilie antes de continuar.");}
          const hist={numero:i.nota,documento:i.documento,cliente:i.cliente,emissao:l.dataFiscal,centavos:i.centavos,situacao:"N",emissor:"municipal",...(i.xml?{xmlBlob:i.xml}:{}),...(i.pdf?{pdfBlob:i.pdf}:{}),consultadoEm:agora()};const entity={partitionKey:hp,rowKey:i.nota,json:JSON.stringify(hist)};if(old)await table().updateEntity(entity,"Replace",{etag:old.etag});else await table().createEntity(entity);
        }
        if(i.status==="emitida"&&i.nota){const source=await registro(emp,i.recebimentoId);if(fonteRecebimento(source.r)!==i.fonteHash||source.r.nota&&source.r.nota!==i.nota)throw Error("Nota confirmada, mas o pagamento mudou. Concilie o vínculo sem reemitir.");Object.assign(source.r,{nota:i.nota,notaEmissor:l.configuracao.emissor,notaChave:i.chave||"",emissaoFiscal:l.dataFiscal,pdfBlob:i.pdf||"",xmlBlob:i.xml||"",emissaoPlanejada:"",atualizadoEm:agora()});await table().updateEntity({partitionKey:part(emp),rowKey:source.r.id,json:JSON.stringify(source.r)},"Replace",{etag:source.row.etag});}
        // Falha ao materializar o histórico nunca transforma nota confirmada em tentativa incerta.
        if(i.status==="emitida")await historico(l,i,req);
      }
      if(["incerta","rejeitada"].includes(i.status))l.estado="revisar";else if(l.itens.every(i=>["emitida","homologada"].includes(i.status)))l.estado="concluido";else if(l.itens.every(i=>i.status==="pronta"))l.estado="pronto";
    }catch(e){
      const detail=e instanceof Error&&/^(Perfil nacional|Este perfil|Produção |Serviço |Confirme |Confira |Habilitação |O emitente |Regime )/.test(e.message)?e.message.slice(0,300):seguroErro();
      const w=await trabalho(l,i);i.status=w?.aprovacao||["transmitindo","incerta","emitida","homologada"].includes(w?.status)?"incerta":"rejeitada";i.mensagem=detail;l.estado="revisar";
    }
    const latest=await lote(emp,id);if(latest.l.execucao?.id!==token)throw Error("Outra execução assumiu o lote. Atualize sem repetir a transmissão.");
    if(l.itens.every(item=>["emitida","homologada"].includes(item.status)))l.estado="concluido";else if(l.itens.every(item=>item.status==="pronta"))l.estado="pronto";
    delete l.execucao;l.atualizadoEm=agora();await table().updateEntity(entidadeLoteFiscal(l),"Replace",{etag:latest.row.etag});return l;
  }
  return {configuracao,listar,criar,aprovar,avancar,lote,organizarHistorico};
}
