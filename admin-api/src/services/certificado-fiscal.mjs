import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { X509Certificate } from "node:crypto";
import { TLSSocket, createSecureContext } from "node:tls";
import { ErroRequisicao, lerCorpoLimitado } from "./seguranca-http.mjs";

const empresas = new Map([["sysney", "57767099000179"], ["drsoft", "09365785000170"]]);
const maxPfx = 128 * 1024;
let credential;

function valido(cert, cnpj) {
  const agora = Date.now();
  return cert.subject.split("\n").some(parte => parte.startsWith("CN=") && parte.endsWith(":" + cnpj)) &&
    cert.publicKey.asymmetricKeyType === "rsa" &&
    Date.parse(cert.validFrom) <= agora && agora < Date.parse(cert.validTo);
}

function abrirPfx(pfx, passphrase) {
  const secureContext = createSecureContext({pfx, passphrase});
  const socket = new TLSSocket(undefined, {secureContext, isServer:true});
  try {
    const cert = socket.getX509Certificate();
    if (!cert) throw new Error("Certificado ausente.");
    return cert;
  } finally {
    socket.destroy();
  }
}

async function verificarVersaoImportada(vault, nome, id, cert) {
  const url = new URL(id);
  const partes = url.pathname.split("/");
  if (url.origin !== new URL(vault).origin || partes.length !== 4 ||
      partes[1] !== "certificates" || partes[2] !== nome || !/^[a-f0-9]{32}$/i.test(partes[3])) {
    throw new Error("Versão inválida.");
  }
  const secret = await new SecretClient(vault, credential).getSecret(nome, {
    version:partes[3], abortSignal:AbortSignal.timeout(15000),
  });
  if (!secret.value || secret.properties.contentType !== "application/x-pkcs12") {
    throw new Error("PFX indisponível.");
  }
  const pfx = Buffer.from(secret.value, "base64");
  try {
    if (abrirPfx(pfx, "").fingerprint256 !== cert.fingerprint256) throw new Error("PFX divergente.");
  } finally {
    pfx.fill(0);
  }
}

export async function certificadoFiscal(req) {
  const empresa = new URL(req.url).searchParams.get("empresa");
  const cnpj = empresas.get(empresa);
  if (!cnpj) return Response.json({erro:"Empresa inválida."}, {status:400});
  const vault = process.env.FISCAL_KEY_VAULT_URI;
  if (!/^https:\/\/[a-z0-9-]+\.vault\.azure\.net\/?$/.test(vault || "")) {
    return Response.json({erro:"Cofre fiscal ainda não configurado."}, {status:503});
  }

  const importar = req.method === "POST";
  let dados;
  if (importar) {
    let pfx, corpo;
    try {
      corpo = await lerCorpoLimitado(req, 180_000);
      const input = JSON.parse(corpo.toString("utf8"));
      if (typeof input.pfx !== "string" || typeof input.senha !== "string" || input.senha.length > 256) throw new Error();
      pfx = Buffer.from(input.pfx, "base64");
      if (!pfx.length || pfx.length > maxPfx || pfx.toString("base64") !== input.pfx) throw new Error();
      const cert = abrirPfx(pfx, input.senha);
      if (!cert || !valido(cert, cnpj)) throw new Error();
      dados = {value:input.pfx, pwd:input.senha, policy:{
        key_props:{exportable:true, kty:"RSA", reuse_key:false},
        secret_props:{contentType:"application/x-pkcs12"},
      }};
    } catch (erro) {
      if (erro instanceof ErroRequisicao) return Response.json({erro:erro.message}, {status:erro.status});
      return Response.json({erro:"Confira a senha, a validade e o CNPJ do certificado A1 desta empresa."}, {status:400});
    } finally {
      corpo?.fill(0);
      pfx?.fill(0);
    }
  }

  try {
    credential ??= new DefaultAzureCredential();
    const token = await credential.getToken("https://vault.azure.net/.default");
    const nome = "fiscal-" + empresa + "-candidato";
    const url = new URL("/certificates/" + nome + (importar ? "/import" : ""), vault);
    url.searchParams.set("api-version", "2025-07-01");
    const remote = await fetch(url, {
      method:importar ? "POST" : "GET", redirect:"error",
      headers:{Authorization:"Bearer " + token.token, "Content-Type":"application/json"},
      body:dados && JSON.stringify(dados), signal:AbortSignal.timeout(15000),
    });
    if (!importar && remote.status === 404) return Response.json({certificado:null});
    if (!remote.ok) throw new Error();
    const {cer, attributes, id} = await remote.json();
    const cert = new X509Certificate(Buffer.from(cer, "base64"));
    if (importar) await verificarVersaoImportada(vault, nome, id, cert);
    return Response.json({certificado:{
      validade:cert.validTo, impressao:cert.fingerprint256,
      valido:attributes?.enabled === true && valido(cert, cnpj),
    }});
  } catch {
    return Response.json({erro:"Não foi possível confirmar a operação no cofre fiscal. Consulte o status antes de repetir."}, {status:502});
  }
}