import { NextRequest, NextResponse } from "next/server";
import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { BlobServiceClient } from "@azure/storage-blob";
import { randomUUID, createHash } from "node:crypto";
import { assinaturaEnvio } from "@/lib/aprovacao-envio";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { usuarioAdministrador } from "../_auth";
import { encaminharAdmin } from "../_remote";
import { novoEmail, emailsValidos, destinatarios, htmlEmail, type EmailCobranca, type TentativaEmail } from "@/lib/emails-cobranca";
import { mesValido, dataValida, hojeBrasil, prevista, type Cobranca, type Plano } from "@/lib/cobrancas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cred = new DefaultAzureCredential();
const conta = () => process.env.ADMIN_STORAGE_ACCOUNT || (process.env.NODE_ENV !== "production" ? "sysneyadm2602" : "");
const table = () => new TableClient(`https://${conta()}.table.core.windows.net`, "AdminDocumentos", cred);
const container = () => new BlobServiceClient(`https://${conta()}.blob.core.windows.net`, cred).getContainerClient("admin-anexos");
const vault = () => new SecretClient(process.env.KEY_VAULT_URI || "https://sysney-admin-kv-2602.vault.azure.net/", cred);
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function emp(req: NextRequest) { const value = req.nextUrl.searchParams.get("empresa"); if (value !== "sysney" && value !== "drsoft") throw new Error("Empresa inválida."); return value; }
function idValido(id: unknown): id is string { return typeof id === "string" && /^[a-f0-9-]{36}$/.test(id); }
async function ler(empresa: string, id: string) { if (!idValido(id)) throw new Error("Mensagem inválida."); const r = await table().getEntity<{ json: string }>(`emails-${empresa}`, id); return { email: JSON.parse(r.json) as EmailCobranca, etag: r.etag }; }
async function guardar(e: EmailCobranca, etag?: string) {
  const json = JSON.stringify(e);
  if (Buffer.byteLength(json, "utf16le") > 60000) throw new Error("Limite de histórico da mensagem atingido. Crie uma nova mensagem.");
  const row = { partitionKey: `emails-${e.empresa}`, rowKey: e.id, json };
  if (etag) await table().updateEntity(row, "Replace", { etag }); else await table().createEntity(row);
}
async function mailConfig(empresa: "sysney" | "drsoft") {
  const key = process.env.SENDGRID_API_KEY || (await vault().getSecret("financeiro-sendgrid-api-key")).value;
  const from = empresa === "sysney"
    ? process.env.SENDGRID_FROM_EMAIL_SYSNEY || "financeiro@sysney.com"
    : process.env.SENDGRID_FROM_EMAIL_DRSOFT || "financeiro@drsoftinformatica.com";
  if (!key || !emailsValidos(from) || destinatarios(from).length !== 1) throw new Error("Remetente de e-mail não configurado.");
  return { key, from };
}
function validarEnvio(e: EmailCobranca) {
  if (!emailsValidos(e.para) || (e.cc && !emailsValidos(e.cc))) throw new Error("Confira os destinatários.");
  if (!e.responderPara || !emailsValidos(e.responderPara) || destinatarios(e.responderPara).length !== 1) throw new Error("Informe um e-mail para receber as respostas do cliente.");
  if (!e.cliente || !e.assunto || !e.descricao || !mesValido(e.competencia) || !dataValida(e.vencimento) || !Number.isSafeInteger(e.centavos) || e.centavos <= 0) throw new Error("Confirme cliente, competência, descrição, valor e vencimento antes da revisão.");
  if (!e.anexos.some(a => a.tipo === "nota") || !e.anexos.some(a => a.tipo === "boleto")) throw new Error("Anexe os PDFs da nota e do boleto desta cobrança.");
}
function responsavel(req: NextRequest) {
  const raw = req.headers.get("x-ms-client-principal");
  if (!raw) return "Administrador local";
  const p = JSON.parse(Buffer.from(raw,"base64").toString("utf8"));
  return String(p.userDetails || p.userId || "Administrador").slice(0,254);
}
async function pacote(e: EmailCobranca) {
  const config = await mailConfig(e.empresa);
  const buffers = await Promise.all(e.anexos.map(a => container().getBlockBlobClient(a.blob).downloadToBuffer()));
  const logo = await readFile(join(process.cwd(), "public", "logo.png"));
  const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  return { config, logo, buffers, hash:assinaturaEnvio(e,config.from,hash(logo),buffers.map(hash)) };
}
async function hashDocumentos(e: EmailCobranca) {
  if (!e.fluxo?.nota || !e.fluxo.boleto || !e.anexos.some(a=>a.tipo === "nota") || !e.anexos.some(a=>a.tipo === "boleto")) throw new Error("A emissão integrada ainda não está disponível. Informe os documentos já emitidos no acompanhamento e anexe os dois PDFs para conferência.");
  const anexos = await Promise.all(e.anexos.map(async a=>({tipo:a.tipo,hash:createHash("sha256").update(await container().getBlockBlobClient(a.blob).downloadToBuffer()).digest("hex")})));
  return createHash("sha256").update(JSON.stringify({empresa:e.empresa,cliente:e.cliente,competencia:e.competencia,vencimento:e.vencimento,centavos:e.centavos,cobrancaId:e.fluxo.cobrancaId,nota:e.fluxo.nota,boleto:e.fluxo.boleto,anexos})).digest("hex");
}
async function conferirFluxo(e: EmailCobranca) {
  if (e.fluxo && (!e.fluxo.documentos || e.fluxo.documentos.hash !== await hashDocumentos(e))) throw new Error("Confira e aprove primeiro os documentos existentes desta cobrança. Nenhuma nova emissão será realizada.");
  if (e.fluxo) {
    const c: Cobranca = JSON.parse((await table().getEntity<{json:string}>(`cobrancas-${e.empresa}`,e.fluxo.cobrancaId)).json);
    if (c.competencia !== e.competencia || c.centavos !== e.centavos || c.vencimento !== e.vencimento || c.nota !== e.fluxo.nota || c.boleto !== e.fluxo.boleto) throw new Error("O acompanhamento mudou. Confira os documentos da cobrança novamente antes de enviar.");
  }
}
async function buscarCobranca(empresa: string, id: string) {
  if (typeof id !== "string" || !/^[a-f0-9]{64}_20\d{2}-(0[1-9]|1[0-2])$/.test(id)) throw new Error("Cobrança inválida.");
  try {
    const row = await table().getEntity<{json:string}>(`cobrancas-${empresa}`,id);
    return {c:JSON.parse(row.json) as Cobranca,etag:row.etag};
  } catch(e) {
    if ((e as {statusCode?:number}).statusCode !== 404) throw e;
    const [planoId,competencia] = id.split("_");
    const configs = new TableClient(`https://${conta()}.table.core.windows.net`,"AdminConfiguracoes",cred);
    const p: Plano = JSON.parse((await configs.getEntity<{json:string}>(`cobrancas-${empresa}`,planoId)).json);
    if (competencia < p.inicio || (p.fim && competencia > p.fim)) throw new Error("Competência fora da recorrência.");
    return {c:prevista(p,competencia),etag:undefined};
  }
}
function erro(e: unknown) {
  const code = (e as { statusCode?: number }).statusCode;
  if (code === 409 || code === 412) return reply({ erro: "Mensagem alterada em outra operação. Atualize a lista." }, 409);
  if (code) return reply({ erro: "Não foi possível acessar o armazenamento ou as configurações de envio." }, 503);
  return reply({ erro: e instanceof Error ? e.message : "Operação inválida." }, 400);
}
export async function GET(req: NextRequest) {
  const remote = await encaminharAdmin(req); if (remote) return remote;
  if (!usuarioAdministrador(req)) return reply({ erro: "Não autorizado." }, 401);
  try {
    const empresa = emp(req);
    const id = req.nextUrl.searchParams.get("id");
    const tipo = req.nextUrl.searchParams.get("anexo");
    if (id && tipo) {
      const { email } = await ler(empresa, id);
      const a = email.anexos.find(x => x.tipo === tipo);
      if (!a) return reply({ erro: "Anexo não encontrado." }, 404);
      const bytes = await container().getBlockBlobClient(a.blob).downloadToBuffer();
      return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${a.tipo}.pdf"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    const emails: EmailCobranca[] = [];
    for await (const r of table().listEntities<{ json: string }>({ queryOptions: { filter: `PartitionKey eq 'emails-${empresa}'` } })) emails.push(JSON.parse(r.json));
    let remetente = "";
    try { remetente = (await mailConfig(empresa)).from; } catch { /* A revisão permanece disponível sem configuração de envio. */ }
    return reply({ emails: emails.sort((a,b) => b.atualizadoEm.localeCompare(a.atualizadoEm)), remetente });
  } catch (e) { return erro(e); }
}
export async function POST(req: NextRequest) {
  const remote = await encaminharAdmin(req); if (remote) return remote;
  if (!usuarioAdministrador(req)) return reply({ erro: "Não autorizado." }, 401);
  if (req.headers.get("origin") !== req.nextUrl.origin) return reply({ erro: "Origem inválida." }, 403);
  try {
    const empresa = emp(req);
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      if (Number(req.headers.get("content-length") || 0) > 5_500_000) throw new Error("Cada PDF deve ter até 5 MB.");
      const f = await req.formData(); const id = String(f.get("id")); const tipo = f.get("tipo"); const file = f.get("arquivo");
      const { email, etag } = await ler(empresa, id);
      if (email.status !== "rascunho" && email.status !== "revisado") throw new Error("Crie outra mensagem para alterar documentos após o envio.");
      if (!(file instanceof File) || file.size > 5_000_000 || (tipo !== "nota" && tipo !== "boleto")) throw new Error("Selecione um PDF de até 5 MB.");
      const data = Buffer.from(await file.arrayBuffer());
      if (!data.subarray(0,5).equals(Buffer.from("%PDF-"))) throw new Error("O arquivo não é um PDF reconhecido.");
      const blob = `${empresa}/emails/${id}/${randomUUID()}.pdf`;
      await container().getBlockBlobClient(blob).uploadData(data, { blobHTTPHeaders: { blobContentType: "application/pdf" } });
      email.anexos = [...email.anexos.filter(a => a.tipo !== tipo), { tipo, blob, nome: file.name.replace(/[^\p{L}\p{N} ._-]/gu, "_").slice(0,100), tamanho: data.length }];
      if (email.fluxo) delete email.fluxo.documentos;
      delete email.aprovacaoEnvio;
      email.status = "rascunho"; email.atualizadoEm = new Date().toISOString();
      await guardar(email, etag); return reply({ email });
    }
    const raw = await req.text(); if (raw.length > 15000) throw new Error("Mensagem muito longa.");
    const body = JSON.parse(raw);
    if (body.acao === "preparar-cobranca") {
      const {c} = await buscarCobranca(empresa,body.cobrancaId);
      // One durable link per billing cycle; never create another draft on a retry.
      const linkKey = `fila-${c.id}`;
      let link: {emailId:string} | undefined;
      try { link = await table().getEntity<{emailId:string}>(`fila-${empresa}`,linkKey); }
      catch(e) {if ((e as {statusCode?:number}).statusCode !== 404) throw e;}
      const hash = createHash("sha256").update(`${empresa}:${c.id}`).digest("hex").slice(0,32);
      const id = link?.emailId || body.emailId || `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`;
      let atual: Awaited<ReturnType<typeof ler>> | undefined;
      try { atual = await ler(empresa,id); } catch(e) {if ((e as {statusCode?:number}).statusCode !== 404) throw e;}
      if (body.emailId && !atual) throw new Error("Rascunho não encontrado.");
      if (atual?.email.fluxo?.cobrancaId === c.id) return reply({email:atual.email});
      const email = atual?.email || {...novoEmail(empresa,c.clienteNome),id,para:c.email,responderPara:empresa === "sysney" ? "financeiro@sysney.com" : "financeiro@drsoftinformatica.com",competencia:c.competencia,vencimento:c.vencimento,centavos:c.centavos,descricao:c.descricao};
      if (email.fluxo || !["rascunho","revisado"].includes(email.status) || email.competencia !== c.competencia || email.vencimento !== c.vencimento || email.centavos !== c.centavos) throw new Error("O rascunho não corresponde à cobrança ou já foi processado. Confira cliente, referência, valor e vencimento.");
      if (!link) await table().createEntity({partitionKey:`fila-${empresa}`,rowKey:linkKey,emailId:id});
      email.fluxo = {cobrancaId:c.id,nota:c.nota,boleto:c.boleto};
      delete email.aprovacaoEnvio;
      email.status = "rascunho"; email.atualizadoEm = new Date().toISOString();
      await guardar(email,atual?.etag);
      return reply({email});
    }
    if (body.acao === "salvar") {
      const anterior = body.email?.id ? await ler(empresa, body.email.id) : undefined;
      if (anterior && !["rascunho", "revisado"].includes(anterior.email.status)) throw new Error("Mensagem já processada. Crie outra mensagem para reenviar.");
      if (anterior && body.email.atualizadoEm !== anterior.email.atualizadoEm) throw new Error("A mensagem mudou. Atualize antes de salvar.");
      const e = { ...body.email, id: anterior?.email.id || randomUUID(), empresa, anexos: anterior?.email.anexos || [], tentativas: anterior?.email.tentativas || [], status: "rascunho", atualizadoEm: new Date().toISOString() } as EmailCobranca;
      e.fluxo = anterior?.email.fluxo;
      if (e.fluxo && anterior && ["cliente","competencia","centavos","vencimento"].some(k=>body.email[k] !== anterior.email[k as keyof EmailCobranca])) throw new Error("Os dados da cobrança vinculada não podem ser alterados pelo editor de e-mail.");
      delete e.aprovacaoEnvio; // Nunca aceitar aprovação enviada pelo cliente.
      for (const field of ["cliente", "para", "cc", "assunto", "saudacao", "introducao", "descricao", "competencia", "vencimento", "observacoes", "assinatura"] as const) {
        if (typeof e[field] !== "string" || e[field].length > 2000) throw new Error("Campo inválido ou muito longo.");
      }
      if (!Number.isSafeInteger(e.centavos) || e.centavos < 0 || e.centavos > 10000000000) throw new Error("Valor inválido.");
      e.detalhado = e.detalhado === true; e.confirmarRecebimento = e.confirmarRecebimento === true;
      if (e.responderPara !== undefined && (typeof e.responderPara !== "string" || e.responderPara.length > 254)) throw new Error("E-mail de resposta inválido.");
      await guardar(e, anterior?.etag); return reply({ email: e });
    }
    const { email, etag } = await ler(empresa, body.id);
    if (body.atualizadoEm !== email.atualizadoEm) throw new Error("Revise a versão atual da mensagem antes de continuar.");
    if (body.acao === "registrar-documento-manual") {
      if (!email.fluxo || !["rascunho","revisado"].includes(email.status)) throw new Error("Cobrança indisponível para alteração.");
      if ((body.tipo !== "nota" && body.tipo !== "boleto") || typeof body.numero !== "string" || !body.numero.trim() || body.numero.length > 120) throw new Error("Informe o tipo e o número do documento já emitido.");
      const tipo: "nota" | "boleto" = body.tipo, numero = body.numero.trim();
      const {c,etag:cetag} = await buscarCobranca(empresa,email.fluxo.cobrancaId);
      if (c.competencia !== email.competencia || c.centavos !== email.centavos || c.vencimento !== email.vencimento) throw new Error("A cobrança mudou. Confira o acompanhamento.");
      if (c[tipo] && c[tipo] !== numero) throw new Error("Já existe outro documento registrado. Não substitua sem conferir o cancelamento ou a baixa do anterior.");
      const em = new Date().toISOString();
      if (c[tipo] !== numero) {
        if (c.eventos.length >= 100) throw new Error("Limite de histórico atingido.");
        c[tipo]=numero;c.persistida=true;
        c.eventos.push({id:randomUUID(),tipo:"documentos",data:hojeBrasil(),registradoEm:em,responsavel:responsavel(req),detalhe:`${tipo === "nota" ? "NFS-e" : "Boleto"} ${numero} registrado como emitido fora do sistema. Não houve transmissão, emissão, cancelamento ou envio por esta ação.`});
        const entity={partitionKey:`cobrancas-${empresa}`,rowKey:c.id,json:JSON.stringify(c)};
        if(Buffer.byteLength(entity.json,"utf16le")>60000)throw new Error("Limite de histórico atingido.");
        if(cetag)await table().updateEntity(entity,"Replace",{etag:cetag});else await table().createEntity(entity);
      }
      email.fluxo.nota=c.nota;email.fluxo.boleto=c.boleto;delete email.fluxo.documentos;delete email.aprovacaoEnvio;
      email.status="rascunho";email.atualizadoEm=em;await guardar(email,etag);
      return reply({email,mensagem:"Documento externo registrado. Anexe o PDF correspondente e confira os dois documentos antes de aprovar o envio. Nenhuma emissão foi realizada."});
    }
    if (body.acao === "conferir-documentos") {
      if (!email.fluxo || !["rascunho","revisado"].includes(email.status)) throw new Error("Cobrança indisponível para conferência.");
      const c: Cobranca = JSON.parse((await table().getEntity<{json:string}>(`cobrancas-${empresa}`,email.fluxo.cobrancaId)).json);
      if (c.competencia !== email.competencia || c.vencimento !== email.vencimento || c.centavos !== email.centavos) throw new Error("A cobrança mudou. Confira os dados antes de continuar.");
      email.fluxo.nota = c.nota; email.fluxo.boleto = c.boleto;
      email.fluxo.documentos = {hash:await hashDocumentos(email),por:responsavel(req),em:new Date().toISOString()};
      delete email.aprovacaoEnvio;email.status="rascunho";email.atualizadoEm=new Date().toISOString();
      await guardar(email,etag);
      return reply({email,mensagem:"Documentos existentes conferidos. Nenhuma nota ou boleto foi emitido. Agora revise o e-mail e aprove o envio."});
    }
    if (body.acao === "remover-anexo") {
      if (!["rascunho", "revisado"].includes(email.status)) throw new Error("Crie outra mensagem para alterar documentos após o envio.");
      if (body.tipo !== "nota" && body.tipo !== "boleto") throw new Error("Tipo de documento inválido.");
      if (!email.anexos.some(a => a.tipo === body.tipo)) throw new Error("Anexo não encontrado. Atualize a mensagem.");
      // Remove only the draft reference: a duplicated message may still use the same blob.
      email.anexos = email.anexos.filter(a => a.tipo !== body.tipo);
      if (email.fluxo) delete email.fluxo.documentos;
      delete email.aprovacaoEnvio;
      email.status = "rascunho"; email.atualizadoEm = new Date().toISOString();
      await guardar(email, etag);
      return reply({ email, mensagem: "Anexo removido desta mensagem. Inclua o PDF correto e aprove novamente antes de enviar." });
    }
    if (body.acao === "duplicar") {
      if (email.status === "enviando" || email.status === "incerto") throw new Error("Confira o resultado do envio anterior no provedor antes de preparar um reenvio.");
      const copia: EmailCobranca = { ...email, id: randomUUID(), status: "rascunho", tentativas: [], atualizadoEm: new Date().toISOString() };
      if (email.fluxo) throw new Error("A cobrança já possui uma mensagem vinculada. Reenvio pela fila ainda não disponível.");
      delete copia.aprovacaoEnvio;
      await guardar(copia); return reply({ email: copia, mensagem: "Cópia criada para revisão. Os mesmos PDFs foram mantidos; nenhum novo boleto foi emitido." });
    }
    if (body.acao === "revisar") {
      if (!["rascunho", "revisado"].includes(email.status)) throw new Error("Mensagem já processada.");
      validarEnvio(email); email.status = "revisado"; email.atualizadoEm = new Date().toISOString();
      await conferirFluxo(email);
      const material = await pacote(email);
      if (body.remetente !== material.config.from) throw new Error("O remetente mudou. Atualize a lista e confira antes de aprovar.");
      email.aprovacaoEnvio = { hash:material.hash, por:responsavel(req), em:email.atualizadoEm, remetente:material.config.from };
      await guardar(email, etag); return reply({ email });
    }
    if (body.acao !== "enviar" || email.status !== "revisado") throw new Error("Salve e revise a mensagem e os anexos antes do envio.");
    validarEnvio(email);
    await conferirFluxo(email);
    const material = await pacote(email);
    if (!email.aprovacaoEnvio || email.aprovacaoEnvio.hash !== material.hash) throw new Error("A aprovação não corresponde ao conteúdo, remetente ou PDFs atuais. Revise e aprove novamente.");
    const { config, logo } = material;
    const anexos = email.anexos.map((a,i) => ({ content:material.buffers[i].toString("base64"), filename:a.nome, type:"application/pdf", disposition:"attachment" }));
    const html = htmlEmail(email, "cid:logo-sysney");
    const tentativa: TentativaEmail = { id: randomUUID(), data: new Date().toISOString(), destino: email.para, assunto: email.assunto, html: htmlEmail(email), status: "processando" };
    email.tentativas.push(tentativa); email.status = "enviando"; email.atualizadoEm = tentativa.data;
    await guardar(email, etag);
    // O bloqueio persistente impede reenvio em caso de queda ou resposta ambígua.
    let messageId = "";
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST", signal: AbortSignal.timeout(25000), headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ personalizations: [{ to: destinatarios(email.para).map(email => ({ email })), ...(email.cc ? { cc: destinatarios(email.cc).map(email => ({ email })) } : {}) }],
          from: { email: config.from, name: `${empresa.toUpperCase()} — Financeiro` }, reply_to: { email: email.responderPara }, subject: email.assunto,
          content: [{ type: "text/html", value: html }], attachments: [...anexos, { content: logo.toString("base64"), filename: "logo-sysney.png", type: "image/png", disposition: "inline", content_id: "logo-sysney" }],
          tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } } }),
      });
      if (response.status !== 202) throw new Error("Envio não confirmado.");
      messageId = response.headers.get("x-message-id") || "";
    } catch {
      const lock = await ler(empresa, email.id); tentativa.status = "incerto"; email.status = "incerto";
      await guardar(email, lock.etag);
      return reply({ erro: "O provedor não confirmou o resultado. Consulte o histórico no SendGrid antes de tentar outro envio para evitar duplicidade.", email }, 502);
    }
    const lock = await ler(empresa, email.id);
    tentativa.status = "aceito"; tentativa.messageId = messageId; email.status = "aceito";
    await guardar(email, lock.etag);
    return reply({ email, mensagem: "Aceito pelo provedor. Isso ainda não confirma entrega ou leitura pelo cliente." });
  } catch (e) { return erro(e); }
}
