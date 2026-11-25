import {createHash} from "node:crypto";
import type {TableClient} from "@azure/data-tables";
import {hojeBrasil,type Empresa} from "./cobrancas";
import {normalizarPerfilNacional,validarDadosNacionais,type DadosNacionais} from "./nfse-nacional";
import type {ContextoFiscal} from "./contexto-fiscal";
export async function prepararNacional({table,emp,c,body,regime}:{table:(nome?:string)=>TableClient;emp:Empresa;c:ContextoFiscal;body:Record<string,unknown>;regime:string}){
 const opcional=async<T extends object>(part:string,id:string,nome="AdminDocumentos")=>{try{return await table(nome).getEntity<T>(part,id);}catch(e){if((e as {statusCode?:number}).statusCode!==404)throw e;return null;}};
      const {email,cobranca,documento,idNota}=c;
      if(body.confirmado!==true||body.atualizadoEm!==email.atualizadoEm)throw Error("Salve a cobrança e confirme o perfil nacional e a competência fiscal.");
      if(!["rascunho","revisado"].includes(email.status)||email.fluxo?.nota||cobranca.nota||email.anexos.some(a=>a.tipo==="nota"))throw Error("Já há nota ou operação em andamento. Consulte o documento existente, sem emitir novamente.");
      const municipal=await opcional<{json:string}>(`nfse-sp-${emp}`,idNota);
      if(municipal)throw Error("Há um trabalho municipal nesta cobrança. Concilie essa tentativa antes de mudar o emissor.");

      const emitente=await opcional<{cnpj:string}>("nfse-emitentes",emp,"AdminConfiguracoes");
      const cnpj=process.env[`NFSE_${emp.toUpperCase()}_CNPJ`]||emitente?.cnpj;
      if(!["simples","presumido"].includes(regime)||!cnpj)throw Error("Emitente ou regime vigente não configurado no servidor.");
      const perfil=normalizarPerfilNacional(body.perfil);
      const dados:DadosNacionais={empresa:emp,cnpj,regime:regime as "simples"|"presumido",documento,cliente:email.cliente,centavos:email.centavos,descricao:email.descricao+(email.po?`. PO ${email.po}`:""),referencia:email.competencia,competenciaFiscal:typeof body.competenciaFiscal==="string"?body.competenciaFiscal:"",emissao:hojeBrasil(),endereco:body.endereco as DadosNacionais["endereco"],perfil};
      validarDadosNacionais(dados,hojeBrasil());
      const part=`nfse-nacional-previas-${emp}`,anterior=await opcional<{json:string}>(part,idNota);
      const previa={dados,status:"aguardando-homologacao",emailId:email.id,emailAtualizadoEm:email.atualizadoEm,atualizadoEm:new Date().toISOString(),hash:createHash("sha256").update(JSON.stringify(dados)).digest("hex"),pendencias:[...(regime==="presumido"?["Confirmar habilitação do Lucro Presumido de São Paulo no Emissor Nacional."]:[]),"Homologar assinatura, XML e consulta oficial para este emitente e perfil.","Habilitar transmissão no serviço fiscal após validação; nenhuma DPS foi reservada."]};
      const ent={partitionKey:part,rowKey:idNota,json:JSON.stringify(previa)};
      if(anterior)await table().updateEntity(ent,"Replace",{etag:anterior.etag});else await table().createEntity(ent);
      // Perfil somente depois de validar o contexto completo. Não copia aprovações,
      // datas, valores monetários antigos nem sequência municipal para outros clientes.
      const perfilPart=`nfse-nacional-perfis-${emp}`,salvo=await opcional<{json:string}>(perfilPart,documento,"AdminConfiguracoes");
      const pe={partitionKey:perfilPart,rowKey:documento,json:JSON.stringify({perfil,atualizadoEm:previa.atualizadoEm,fonte:"Perfil nacional conferido pelo administrador"})};
      if(salvo)await table("AdminConfiguracoes").updateEntity(pe,"Replace",{etag:salvo.etag});else await table("AdminConfiguracoes").createEntity(pe);
      return ({previa,mensagem:"Prévia nacional salva para conferência. Sem reserva de DPS, emissão, boleto ou envio de e-mail. Pendências de habilitação e homologação permanecem visíveis."});
}
