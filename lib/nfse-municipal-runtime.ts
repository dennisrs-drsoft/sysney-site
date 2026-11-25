import {createHash} from "node:crypto";
import type {TableClient} from "@azure/data-tables";
import {hojeBrasil,type Empresa} from "./cobrancas";
import type {EmailCobranca} from "./emails-cobranca";
import {hashNotaSP,normalizarFiscalSP,montarXmlSP,cadeiaAssinaturaSP,type DadosNotaSP,type TrabalhoSP} from "./nfse-sp";
import {executarNotaSP,executorMunicipalDisponivel} from "./nfse-sp-executor";
import {recuperarPdfNotaSP} from "./documentos-pdf";
import {recuperarPdfRegularizacao} from "./documentos-regularizacao";
import {orientacaoEmissor} from "./perfil-fiscal-historico";
import {particaoDocumentoFiscal,particaoControleFiscal,type ContextoFiscal} from "./contexto-fiscal";
type Table=(nome?:string)=>TableClient;
export async function operarMunicipal({table,emp,ctx,body,req,regime}:{table:Table;emp:Empresa;ctx:ContextoFiscal;body:Record<string,unknown>;req:Request;regime:string}){
 const opcional=async<T extends object>(part:string,id:string,nome="AdminDocumentos")=>{try{return await table(nome).getEntity<T>(part,id);}catch(e){if((e as {statusCode?:number}).statusCode!==404)throw e;return null;}};
 const salvar=async(t:TrabalhoSP,part:string,etag:string)=>table().updateEntity({partitionKey:part,rowKey:t.id,json:JSON.stringify(t)},"Replace",{etag});
    const {email,cobranca,documento,idNota}=ctx;
    const part=`nfse-sp-${emp}`;
    let row=await opcional<{json:string}>(part,idNota);
    let trabalho:TrabalhoSP|null=row?JSON.parse(row.json):null;
    const em=new Date().toISOString();
    if(body.acao==="preparar"){
      if(!["rascunho","revisado"].includes(email.status)||email.fluxo?.nota||cobranca.nota||email.anexos.some(a=>a.tipo==="nota"))throw Error("Nota/anexo já existente ou operação em andamento. Registre ou consulte a nota existente, sem emitir outra.");
      if(body.atualizadoEm!==email.atualizadoEm)throw Error("Salve e atualize a cobrança antes de preparar a nota.");
      const testeAbandonado=trabalho?.status==="testando"&&!trabalho.aprovacao&&Date.now()-Date.parse(trabalho.atualizadoEm)>120000;
      if(trabalho && ((! ["preparada","testada","rejeitada"].includes(trabalho.status)&&!testeAbandonado)||trabalho.aprovacao||trabalho.emailId!==email.id))throw Error("Já existe tentativa fiscal. Consulte antes de emitir novamente.");
      const fiscal=normalizarFiscalSP(body.fiscal,email.centavos);
      if(fiscal.regime!==regime)throw Error("Salve o regime vigente da empresa antes de preparar a nota.");
      if(Number(fiscal.numeroInicial)>=999999999999)throw Error("Número inicial fora da faixa reservável.");
      if(fiscal.dataEmissao!==hojeBrasil())throw Error("Para esta integração, a data de emissão deve ser a data de hoje. A competência do serviço permanece separada.");
      const orientacao=orientacaoEmissor(fiscal.regime,email.competencia,hojeBrasil());
      if(orientacao.tipo!=="municipal")throw Error(orientacao.mensagem);
      // Identidade obtida exclusivamente da configuração protegida, nunca do navegador.
      const emitente=await opcional<{cnpj:string;inscricao:string}>("nfse-emitentes",emp,"AdminConfiguracoes");
      const cnpj=process.env[`NFSE_${emp.toUpperCase()}_CNPJ`]||emitente?.cnpj,inscricao=process.env[`NFSE_${emp.toUpperCase()}_CCM`]||emitente?.inscricao;
      if(!cnpj||!inscricao)throw Error("CNPJ e inscrição municipal do emitente ainda não configurados no servidor.");
      let numero=trabalho?.dados.numero||fiscal.numeroInicial;
      const dados:DadosNotaSP={empresa:emp,cnpj,inscricao,clienteDocumento:documento,clienteNome:email.cliente,competencia:email.competencia,centavos:email.centavos,descricao:email.descricao,po:email.po||"",numero,fiscal};
      hashNotaSP(dados); // Validação antes de reservar qualquer número.
      if(!trabalho){
        if(body.confirmarSerie!==true)throw Error("Confirme que série e numeração não foram utilizadas por outro sistema.");
        const seqPart=`nfse-sequencia-${emp}`,seq=await opcional<{proximo:string;cnpj:string;inscricao:string}>(seqPart,fiscal.serie);
        if(seq){
          if(seq.cnpj!==cnpj||seq.inscricao!==inscricao)throw Error("Sequência pertence a outro emitente. Confira a configuração.");
          numero=seq.proximo;
          if(!/^[1-9]\d{0,11}$/.test(numero)||Number(numero)>=999999999999)throw Error("Sequência de RPS esgotada.");
          await table().updateEntity({partitionKey:seqPart,rowKey:fiscal.serie,proximo:String(Number(numero)+1),cnpj,inscricao},"Replace",{etag:seq.etag});
        }else{await table().createEntity({partitionKey:seqPart,rowKey:fiscal.serie,proximo:String(Number(numero)+1),cnpj,inscricao});}
      }else if(fiscal.serie!==trabalho.dados.fiscal.serie)throw Error("Série já reservada. Não altere a chave do RPS.");
      dados.numero=numero;
      trabalho={id:idNota,emailId:email.id,dados,hash:hashNotaSP(dados),status:"preparada",atualizadoEm:em};
      if(row)await salvar(trabalho,part,row.etag!);else await table().createEntity({partitionKey:part,rowKey:idNota,json:JSON.stringify(trabalho)});
      return ({trabalho,mensagem:"Prévia fiscal criada; número reservado, sem emitir nota. Confira os dados e execute o teste na Prefeitura."});
    }
    if(!trabalho||!row)throw Error("Prepare a nota primeiro.");
    if(trabalho.emailId!==email.id)throw Error("Tentativa fiscal vinculada a outra cobrança. Concilie antes de continuar.");
    if(!executorMunicipalDisponivel())throw Error("Use o painel local deste computador para assinar com o certificado Windows. No ambiente on-line, registre a nota manualmente.");
    if(body.acao!=="consultar"){
      const d=trabalho.dados;
      if(d.fiscal.regime!==regime)throw Error("Regime vigente mudou. Prepare e teste novamente.");
      if(hashNotaSP(d)!==trabalho.hash)throw Error("O modelo fiscal foi atualizado. Prepare e teste novamente; aprovações anteriores não são reutilizadas.");
      if(body.hash!==trabalho.hash||body.atualizadoEm!==email.atualizadoEm||d.clienteDocumento!==documento||d.centavos!==email.centavos||d.competencia!==email.competencia||d.descricao!==email.descricao||d.po!==(email.po||"")||d.clienteNome!==email.cliente||d.fiscal.dataEmissao!==hojeBrasil())throw Error("Os dados mudaram ou a data expirou. Prepare e teste novamente.");
      if(!["rascunho","revisado"].includes(email.status)||email.fluxo?.nota||cobranca.nota||email.anexos.some(a=>a.tipo==="nota"))throw Error("Nota ou operação já existente. Consulte, sem emitir outra.");
    }
    if(body.acao==="testar"){
      if(!["preparada","testada","rejeitada"].includes(trabalho.status)||trabalho.aprovacao)throw Error("Tentativa real existente: consulte, sem testar nova emissão.");
      trabalho.status="testando";trabalho.atualizadoEm=em;await salvar(trabalho,part,row.etag!);
      let resultado;
      try{resultado=await executarNotaSP("testar",trabalho.dados);}catch{
        const r=await table().getEntity<{json:string}>(part,idNota),atual:TrabalhoSP=JSON.parse(r.json);
        if(atual.status!=="testando"||atual.atualizadoEm!==em||atual.hash!==trabalho.hash)return ({trabalho:atual,mensagem:"A versão mudou durante o teste. Atualize a prévia; nenhuma nota foi emitida."});
        trabalho.status="preparada";trabalho.atualizadoEm=new Date().toISOString();await salvar(trabalho,part,r.etag!);
        return ({trabalho,mensagem:"Teste não concluído. Nenhuma nota emitida. Confira os campos fiscais e a autorização do certificado, depois repita somente o teste."});
      }
      const r=await table().getEntity<{json:string}>(part,idNota),atual:TrabalhoSP=JSON.parse(r.json);
      if(atual.status!=="testando"||atual.atualizadoEm!==em||atual.hash!==trabalho.hash)return ({trabalho:atual,mensagem:"Resultado do teste pertence a uma versão anterior. Prepare e teste a versão atual; nenhuma nota foi emitida."});
      trabalho.status=resultado.sucesso?"testada":"rejeitada";trabalho.teste={hash:trabalho.hash,em:new Date().toISOString(),resultado};trabalho.atualizadoEm=trabalho.teste.em;
      await salvar(trabalho,part,r.etag!);
      if(resultado.sucesso){
        const perfilPart=`nfse-perfil-${emp}`,p=await opcional<{json:string}>(perfilPart,documento,"AdminConfiguracoes");
        const ent={partitionKey:perfilPart,rowKey:documento,json:JSON.stringify({fiscal:trabalho.dados.fiscal,testeEm:trabalho.teste.em,fonte:"Último teste aceito. Enquadramento deve ser revisado a cada emissão."})};
        if(p)await table("AdminConfiguracoes").updateEntity(ent,"Replace",{etag:p.etag});else await table("AdminConfiguracoes").createEntity(ent);
      }
      return ({trabalho,mensagem:resultado.sucesso?"Teste aceito pela Prefeitura. Nenhuma nota foi emitida. Confira também os alertas antes de aprovar a emissão real.":"Teste rejeitado. Confira os erros fiscais abaixo, corrija e teste novamente. Nenhuma nota foi emitida."});
    }
    if(body.acao==="emitir"){
      if(process.env.NFSE_SP_WORKER_HABILITADO==="true"&&process.env.NFSE_SP_VM_PRODUCAO_HABILITADA!=="true")throw Error("Serviço da VM em homologação: emissão real bloqueada.");
      if(process.env.NFSE_SP_PRODUCAO_HABILITADA!=="true")throw Error("Produção fiscal bloqueada até a homologação da integração.");
      if(body.aprovado!==true||trabalho.status!=="testada"||trabalho.teste?.hash!==trabalho.hash||!trabalho.teste.resultado.sucesso||Date.now()-Date.parse(trabalho.teste.em)>1800000)throw Error("Teste aprovado recente e aprovação explícita são obrigatórios.");
      let por="Administrador local";const p=req.headers.get("x-ms-client-principal");if(p){const u=JSON.parse(Buffer.from(p,"base64").toString("utf8"));por=String(u.userDetails||u.userId||por).slice(0,254);}
      trabalho.aprovacao={por,em,hash:trabalho.hash,xmlHash:createHash("sha256").update(montarXmlSP(trabalho.dados,false)).digest("hex"),cadeiaHash:createHash("sha256").update(cadeiaAssinaturaSP(trabalho.dados)).digest("hex")};trabalho.status="transmitindo";trabalho.atualizadoEm=em;
      // Trava durável antes de qualquer transmissão. Falha/timeout nunca libera reemissão automática.
      await salvar(trabalho,part,row.etag!);
      email.status="emitindo_documento";email.atualizadoEm=em;delete email.aprovacaoEnvio;delete email.fluxo!.documentos;
      await table().updateEntity({partitionKey:particaoDocumentoFiscal(emp,ctx),rowKey:email.id,json:JSON.stringify(email)},"Replace",{etag:ctx.row.etag});
      try{trabalho.resultado=await executarNotaSP("emitir",trabalho.dados,{empresa:emp,trabalhoId:trabalho.id,hashAprovado:trabalho.hash});trabalho.status=trabalho.resultado.sucesso&&trabalho.resultado.numero?"emitida":"incerta";}catch{trabalho.status="incerta";}
      const r=await table().getEntity<{json:string}>(part,idNota);trabalho.atualizadoEm=new Date().toISOString();await salvar(trabalho,part,r.etag!);
      if(trabalho.status!=="emitida")return ({trabalho,email,mensagem:"Tentativa registrada. Consulte o resultado para vincular a nota. Não repita a emissão; nenhum e-mail foi enviado."});
      // Confirma por consulta antes de vincular e baixar; jamais transmite novamente.
      row=await table().getEntity<{json:string}>(part,idNota);
      ctx.row=await table().getEntity<{json:string}>(particaoDocumentoFiscal(emp,ctx),email.id);
      const emailAtual:EmailCobranca=JSON.parse(ctx.row.json!);
      if(emailAtual.atualizadoEm!==email.atualizadoEm||emailAtual.status!==email.status)return ({trabalho,email:emailAtual,mensagem:"A cobrança mudou durante a emissão. Consulte o RPS para recuperar a nota existente; não emita novamente."});
    }
    if(trabalho.status==="testando")throw Error("Teste ainda em andamento. Aguarde e atualize.");
    if(trabalho.status==="transmitindo"&&Date.now()-Date.parse(trabalho.atualizadoEm)<90000)throw Error("Transmissão ainda em andamento. Aguarde antes de consultar; não repita a emissão.");
    // Uma consulta nunca transmite um novo RPS; utiliza sempre a chave já reservada.
    const resultado=await executarNotaSP("consultar",trabalho.dados);
    if(!resultado.sucesso||!resultado.numero)return ({trabalho,mensagem:"Nenhuma nota confirmada nessa chave de RPS. Se houve tentativa real, confira no portal antes de qualquer substituição."});
    if(resultado.inscricao!==trabalho.dados.inscricao||!/^\d+$/.test(resultado.numero)||!resultado.verificacao)throw Error("Resposta sem identificação fiscal confirmada. Confira no portal.");
    const esperado=trabalho.dados;
    if(resultado.tomador!==esperado.clienteDocumento||!resultado.valorFinal||Math.round(Number(resultado.valorFinal)*100)!==esperado.centavos||resultado.descricao?.replaceAll("\r\n","\n")!==(esperado.descricao+(esperado.po?`\nPO ${esperado.po}`:"")))throw Error("Nota retornada com tomador, valor ou descrição divergentes. Confira no portal; não vincular nem reemitir automaticamente.");
    if(cobranca.nota&&cobranca.nota!==resultado.numero)throw Error("Outra nota já vinculada. Conciliação necessária.");
    trabalho.resultado=resultado;trabalho.status="emitida";trabalho.atualizadoEm=em;await salvar(trabalho,part,row.etag!);
    cobranca.nota=resultado.numero;cobranca.persistida=true;
    if(!cobranca.eventos.some(x=>x.id===idNota))cobranca.eventos.push({id:idNota,tipo:"documentos",data:hojeBrasil(),registradoEm:em,responsavel:"Sistema — Prefeitura SP",detalhe:`NFS-e ${resultado.numero} confirmada por consulta do RPS ${trabalho.dados.fiscal.serie}/${trabalho.dados.numero}. PDF pendente de anexação. Nenhum e-mail enviado.`});
    const ce={partitionKey:particaoControleFiscal(emp,ctx),rowKey:cobranca.id,json:JSON.stringify(cobranca)};
    if(ctx.cr)await table().updateEntity(ce,"Replace",{etag:ctx.cr.etag});else await table().createEntity(ce);
    if(!["aceito","enviando","incerto"].includes(email.status)){
      email.fluxo!.nota=resultado.numero;delete email.fluxo!.documentos;delete email.aprovacaoEnvio;email.status="rascunho";email.atualizadoEm=em;
      await table().updateEntity({partitionKey:particaoDocumentoFiscal(emp,ctx),rowKey:email.id,json:JSON.stringify(email)},"Replace",{etag:ctx.row.etag});
    }
    if(!["aceito","enviando","incerto"].includes(email.status)) {
      try {return ({trabalho,...await (ctx.origem==="regularizacao"?recuperarPdfRegularizacao(table,emp,ctx,trabalho):recuperarPdfNotaSP(emp,email.id))});}
      catch {return ({trabalho,email,mensagem:"Nota confirmada e vinculada. O PDF não pôde ser anexado agora. Use Tentar baixar PDF da nota; não emita novamente. Nenhum e-mail enviado."});}
    }
    return ({trabalho,email,mensagem:"Nota confirmada. Mensagem já enviada ou em processamento: anexos preservados."});
}
