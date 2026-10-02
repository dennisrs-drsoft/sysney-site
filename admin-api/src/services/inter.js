import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { Agent, request } from "undici";

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

function obterCredential() {
  credential ??= new DefaultAzureCredential();
  return credential;
}

function obterSecretClient() {
  if (secretClient) return secretClient;
  const vaultUrl = process.env.KEY_VAULT_URI;
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

async function obterToken({ clientId, clientSecret }, dispatcher) {
  const corpo = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: process.env.INTER_READ_SCOPE || ESCOPO_LEITURA,
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
  return dados.access_token;
}

function conteudoCobrancas(resposta) {
  if (Array.isArray(resposta)) return resposta;
  if (Array.isArray(resposta.content)) return resposta.content;
  if (Array.isArray(resposta.cobrancas)) return resposta.cobrancas;
  return [];
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

export async function listarCobrancasInter({
  empresa,
  dataInicial,
  dataFinal,
}) {
  const credenciais = await carregarCredenciais(empresa);
  const dispatcher = agenteMtls(credenciais);

  try {
    const token = await obterToken(credenciais, dispatcher);
    const cobrancas = [];

    for (let paginaAtual = 0; paginaAtual < 100; paginaAtual += 1) {
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
    }

    return cobrancas;
  } finally {
    await dispatcher.close();
  }
}
