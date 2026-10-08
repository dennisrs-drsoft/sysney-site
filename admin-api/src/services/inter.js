import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { Agent, request } from "undici";
import { TableClient } from "@azure/data-tables";
import { createHash } from "node:crypto";

const TOKEN_URL_PADRAO =
  "https://cdpj.partners.bancointer.com.br/oauth/v2/token";
const API_URL_PADRAO = "https://cdpj.partners.bancointer.com.br";
const ESCOPO_LEITURA = "boleto-cobranca.read";

const configuracoes = {
  sysney: {
    situacao: "ativa",
    prefixo: "inter-sysney",
  },
  drsoft: {
    situacao: "em_validacao",
    prefixo: "inter-drsoft",
  },
};

let credential;
let secretClient;
const tokens = new Map();

function obterCredential() {
  credential ??= new DefaultAzureCredential();
  return credential;
}

function obterSecretClient() {
  if (secretClient) return secretClient;
  const vaultUrl = process.env.KEY_VAULT_URI || (process.env.NODE_ENV === "development" ? "https://sysney-admin-kv-2602.vault.azure.net/" : "");
  if (!vaultUrl) throw new Error("KEY_VAULT_URI não configurado.");
  secretClient = new SecretClient(vaultUrl, obterCredential());
  return secretClient;
}

function configuracaoEmpresa(empresa) {
  const configuracao = configuracoes[empresa];
  if (!configuracao) throw new Error("Empresa inválida.");
  return configuracao;
}

async function segredoObrigatorio(nome) {
  const resposta = await obterSecretClient().getSecret(nome);
  if (!resposta.value) throw new Error(`Segredo ${nome} não configurado.`);
  return resposta.value;
}

async function segredoOpcional(nome) {
  try {
    return (await obterSecretClient().getSecret(nome)).value ?? null;
  } catch (erro) {
    if (erro?.statusCode === 404) return null;
    throw erro;
  }
}

async function carregarCredenciais(empresa) {
  const configuracao = configuracaoEmpresa(empresa);
  if (configuracao.situacao !== "ativa") {
    throw new Error("Integração ainda em validação no Banco Inter.");
  }

  const [clientId, clientSecret, certificate, privateKey, contaCorrente] =
    await Promise.all([
      segredoObrigatorio(`${configuracao.prefixo}-client-id`),
      segredoObrigatorio(`${configuracao.prefixo}-client-secret`),
      segredoObrigatorio(`${configuracao.prefixo}-certificado-crt`),
      segredoObrigatorio(`${configuracao.prefixo}-chave-privada`),
      segredoOpcional(`${configuracao.prefixo}-conta-corrente`),
    ]);

  return { clientId, clientSecret, certificate, privateKey, contaCorrente };
}

function agenteMtls({ certificate, privateKey }) {
  return new Agent({
    connect: {
      cert: certificate,
      key: privateKey,
      rejectUnauthorized: true,
    },
  });
}

async function respostaJson(resposta, contexto) {
  const texto = await resposta.body.text();
  if (resposta.statusCode < 200 || resposta.statusCode >= 300) {
    throw new Error(`${contexto} retornou HTTP ${resposta.statusCode}.`);
  }

  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`${contexto} retornou conteúdo inválido.`);
  }
}

async function obterToken({ clientId, clientSecret }, dispatcher, scope = process.env.INTER_READ_SCOPE || ESCOPO_LEITURA) {
  const cacheKey = `${clientId}:${scope}`;
  const cached = tokens.get(cacheKey);
  if (cached && cached.ate > Date.now()) return cached.token;
  const corpo = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope,
    grant_type: "client_credentials",
  });

  const resposta = await request(
    process.env.INTER_TOKEN_URL || TOKEN_URL_PADRAO,
    {
      method: "POST",
      dispatcher,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: corpo.toString(),
      signal: AbortSignal.timeout(30_000),
    }
  );

  const dados = await respostaJson(resposta, "Autenticação do Inter");
  if (!dados.access_token) {
    throw new Error("Autenticação do Inter não retornou token.");
  }
  tokens.set(cacheKey, { token: dados.access_token, ate: Date.now() + Math.max(0, Math.min(Number(dados.expires_in) || 3600, 3600) - 120) * 1000 });
  return dados.access_token;
}

// Consulta individual e PDF conforme SDK oficial inter-co/pj-sdk-java.
export async function consultarCobrancaInter(empresa, codigo, pdf = false) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(codigo)) throw new Error("Código de cobrança inválido.");
  const credenciais = await carregarCredenciais(empresa);
  const dispatcher = agenteMtls(credenciais);
  try {
    const token = await obterToken(credenciais, dispatcher);
    const resposta = await request(new URL(`/cobranca/v3/cobrancas/${codigo}${pdf ? "/pdf" : ""}`, API_URL_PADRAO), {
      method: "GET", dispatcher,
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(credenciais.contaCorrente ? { "x-conta-corrente": credenciais.contaCorrente } : {}) },
      signal: AbortSignal.timeout(30000),
    });
    return await respostaJson(resposta, "Consulta individual do Inter");
  } finally { await dispatcher.close(); }
}

export async function emitirCobrancaInter({ empresa, competencia, payload, autorizacaoPainel = false }) {
  // O painel valida configuração privada, revisão explícita e trava da cobrança antes desta chamada.
  if (process.env.INTER_WRITE_OPERATIONS_ENABLED !== "true" && autorizacaoPainel !== true) throw new Error("Emissão bancária não habilitada.");
  if (empresa !== "sysney" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new Error("Empresa ou competência inválida.");
  if (!payload?.pagador?.cpfCnpj || !Number.isFinite(payload.valorNominal) || payload.valorNominal <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(payload.dataVencimento)) throw new Error("Cobrança incompleta.");
  const table = new TableClient(`https://${process.env.ADMIN_STORAGE_ACCOUNT || "sysneyadm2602"}.table.core.windows.net`, "AdminDocumentos", obterCredential());
  const rowKey = createHash("sha256").update(`${payload.pagador.cpfCnpj.replace(/\D/g, "")}:${competencia}`).digest("hex");
  const partitionKey = `inter-emissoes-${empresa}`;
  // Preparar acesso antes do bloqueio. Nenhum POST bancário é repetido automaticamente.
  const credenciais = await carregarCredenciais(empresa);
  const dispatcher = agenteMtls(credenciais);
  try {
    const token = await obterToken(credenciais, dispatcher, "boleto-cobranca.write");
    const registro = { partitionKey, rowKey, competencia, status: "enviando", json: JSON.stringify(payload), criadoEm: new Date().toISOString() };
    await table.createEntity(registro); // Conflito impede nova emissão da mesma competência.
    try {
      const resposta = await request(new URL("/cobranca/v3/cobrancas", API_URL_PADRAO), {
        method: "POST", dispatcher,
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(credenciais.contaCorrente ? { "x-conta-corrente": credenciais.contaCorrente } : {}) },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
      });
      const dados = await respostaJson(resposta, "Emissão de cobrança do Inter");
      if (!dados.codigoSolicitacao) throw new Error("Resposta sem código; conferir no banco antes de qualquer repetição.");
      await table.updateEntity({ partitionKey, rowKey, status: "solicitada", codigoSolicitacao: dados.codigoSolicitacao }, "Merge");
      return dados;
    } catch (erro) {
      await table.updateEntity({ partitionKey, rowKey, status: "incerto" }, "Merge").catch(() => {});
      throw erro;
    }
  } finally { await dispatcher.close(); }
}

export async function cancelarCobrancaPorSubstituicao(empresa, codigo) {
  if (process.env.INTER_WRITE_OPERATIONS_ENABLED !== "true") throw new Error("Cancelamento não habilitado.");
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(codigo)) throw new Error("Código inválido.");
  const detalhe = await consultarCobrancaInter(empresa, codigo);
  if (detalhe.cobranca.situacao === "CANCELADO") return { jaCancelado:true };
  if (detalhe.cobranca.situacao !== "A_RECEBER") throw new Error("Situação bancária impede cancelamento automático.");
  const credenciais = await carregarCredenciais(empresa);
  const dispatcher = agenteMtls(credenciais);
  try {
    const token = await obterToken(credenciais, dispatcher, "boleto-cobranca.write");
    const resposta = await request(new URL(`/cobranca/v3/cobrancas/${codigo}/cancelar`, API_URL_PADRAO), {
      method:"POST", dispatcher,
      headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json", ...(credenciais.contaCorrente ? { "x-conta-corrente":credenciais.contaCorrente } : {}) },
      body:JSON.stringify({ motivoCancelamento:"SUBSTITUICAO" }), signal:AbortSignal.timeout(30000),
    });
    await resposta.body.text();
    if (resposta.statusCode < 200 || resposta.statusCode >= 300) throw new Error(`Cancelamento retornou HTTP ${resposta.statusCode}; conferir antes de repetir.`);
    return { solicitado:true };
  } finally { await dispatcher.close(); }
}

function conteudoCobrancas(resposta) {
  if (Array.isArray(resposta)) return resposta;
  if (Array.isArray(resposta.content)) return resposta.content;
  if (Array.isArray(resposta.cobrancas)) return resposta.cobrancas;
  throw new Error("Consulta de cobranças retornou formato desconhecido.");
}

function possuiProximaPagina(resposta, quantidade, paginaAtual) {
  if (resposta.last === true || resposta.ultimaPagina === true) return false;
  const totalPaginas =
    resposta.totalPages ??
    resposta.totalPaginas ??
    resposta.paginacao?.totalPaginas;
  if (Number.isFinite(totalPaginas)) return paginaAtual + 1 < totalPaginas;
  return quantidade === 100;
}

export function situacaoInter(empresa) {
  return configuracaoEmpresa(empresa).situacao;
}

export async function verificarConfiguracaoInter(empresa) {
  const configuracao = configuracaoEmpresa(empresa);
  if (configuracao.situacao !== "ativa") {
    return { configurada: false, situacao: configuracao.situacao };
  }

  try {
    await carregarCredenciais(empresa);
    return { configurada: true, situacao: "credenciais_no_cofre" };
  } catch {
    return { configurada: false, situacao: "aguardando_credenciais" };
  }
}

export async function validarAutenticacaoInter(empresa) {
  const credenciais = await carregarCredenciais(empresa);
  const dispatcher = agenteMtls(credenciais);

  try {
    await obterToken(credenciais, dispatcher);
    return { autenticada: true };
  } finally {
    await dispatcher.close();
  }
}

// Somente leitura. Extrato enriquecido identifica PIX avulsos que não constam nos boletos.
// Contrato: SDK oficial inter-co/pj-sdk-java, BankStatementClient.
export async function consultarPaginaExtratoInter({ empresa, dataInicial, dataFinal, pagina = 0 }) {
  const data = v => typeof v === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!data(dataInicial) || !data(dataFinal) || dataInicial > dataFinal || (Date.parse(dataFinal) - Date.parse(dataInicial)) / 86400000 > 89 || !Number.isSafeInteger(pagina) || pagina < 0 || pagina > 9999) throw new Error("Período ou página do extrato inválido (máximo 90 dias).");
  const credenciais = await carregarCredenciais(empresa);
  const dispatcher = agenteMtls(credenciais);
  try {
    const token = await obterToken(credenciais, dispatcher, "extrato.read");
    const url = new URL("/banking/v2/extrato/completo", API_URL_PADRAO);
    for (const [k, v] of Object.entries({ dataInicio: dataInicial, dataFim: dataFinal, pagina, tamanhoPagina: 100 })) url.searchParams.set(k, String(v));
    const resposta = await request(url, { method: "GET", dispatcher,
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(credenciais.contaCorrente ? { "x-conta-corrente": credenciais.contaCorrente } : {}) }, signal: AbortSignal.timeout(30000) });
    return await respostaJson(resposta, "Extrato enriquecido do Inter");
  } finally { await dispatcher.close(); }
}

export async function listarCobrancasInter({
  empresa,
  dataInicial,
  dataFinal,
  maxPaginas = 100,
}) {
  const credenciais = await carregarCredenciais(empresa);
  const dispatcher = agenteMtls(credenciais);

  try {
    const token = await obterToken(credenciais, dispatcher);
    const cobrancas = [];

    for (let paginaAtual = 0; paginaAtual < maxPaginas; paginaAtual += 1) {
      const url = new URL(
        "/cobranca/v3/cobrancas",
        process.env.INTER_API_URL || API_URL_PADRAO
      );
      url.searchParams.set("dataInicial", dataInicial);
      url.searchParams.set("dataFinal", dataFinal);
      url.searchParams.set("filtrarDataPor", "EMISSAO");
      url.searchParams.set("itensPorPagina", "100");
      url.searchParams.set("paginaAtual", String(paginaAtual));

      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (credenciais.contaCorrente) {
        headers["x-conta-corrente"] = credenciais.contaCorrente;
      }

      const resposta = await request(url, {
        method: "GET",
        dispatcher,
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      const dados = await respostaJson(resposta, "Consulta de cobranças do Inter");
      const pagina = conteudoCobrancas(dados);
      cobrancas.push(...pagina);

      if (!possuiProximaPagina(dados, pagina.length, paginaAtual)) break;
      if (paginaAtual + 1 === maxPaginas) throw new Error("Consulta bancária excedeu o limite de páginas; não assumir histórico completo.");
    }

    return cobrancas;
  } finally {
    await dispatcher.close();
  }
}
