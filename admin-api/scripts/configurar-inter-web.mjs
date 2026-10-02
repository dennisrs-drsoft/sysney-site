import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import AdmZip from "adm-zip";
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

const HOST = "127.0.0.1";
const PORT = 3111;
const VAULT_URL =
  process.env.KEY_VAULT_URI || "https://sysney-admin-kv-2602.vault.azure.net/";
const zipPath = process.argv[2];

if (!zipPath || path.extname(zipPath).toLowerCase() !== ".zip") {
  throw new Error("Informe o caminho do ZIP da integração como primeiro argumento.");
}

const zipBuffer = await readFile(zipPath);
const zip = new AdmZip(zipBuffer);
const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
const certificateEntry = entries.find((entry) =>
  [".crt", ".pem"].includes(path.extname(entry.entryName).toLowerCase())
);
const privateKeyEntry = entries.find(
  (entry) => path.extname(entry.entryName).toLowerCase() === ".key"
);

if (!certificateEntry || !privateKeyEntry) {
  throw new Error("O ZIP não contém certificado cliente e chave privada.");
}

const certificate = certificateEntry.getData().toString("utf8");
const privateKey = privateKeyEntry.getData().toString("utf8");
if (!certificate.includes("BEGIN CERTIFICATE")) {
  throw new Error("Certificado cliente inválido.");
}
if (!/BEGIN .*PRIVATE KEY/.test(privateKey)) {
  throw new Error("Chave privada inválida.");
}

const nonce = randomBytes(24).toString("hex");
const route = `/${nonce}`;
let utilizado = false;

const headers = {
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "Content-Type": "text/html; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function pagina(conteudo) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Configurar Inter · SYSNEY</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#07111f;color:#0f172a;font:16px system-ui,-apple-system,Segoe UI,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(560px,100%);background:#fff;border-radius:24px;padding:32px;box-shadow:0 24px 80px #0008}.tag{display:inline-block;border-radius:999px;background:#dbeafe;color:#1d4ed8;padding:7px 12px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}h1{margin:18px 0 8px;font-size:30px}p{color:#64748b;line-height:1.6}label{display:block;margin-top:20px;font-weight:750;color:#334155}input{width:100%;margin-top:8px;border:1px solid #cbd5e1;border-radius:12px;padding:14px;font:inherit}input:focus{outline:3px solid #dbeafe;border-color:#2563eb}button{width:100%;margin-top:24px;border:0;border-radius:999px;padding:14px;background:#2563eb;color:#fff;font:inherit;font-weight:800;cursor:pointer}.safe{margin-top:20px;border-radius:14px;background:#ecfdf5;color:#047857;padding:14px;font-size:13px}.error{margin-top:20px;border-radius:14px;background:#fff1f2;color:#be123c;padding:14px}.ok{text-align:center}.ok strong{display:block;color:#047857;font-size:24px;margin-bottom:12px}
  </style>
</head>
<body><main class="card">${conteudo}</main></body>
</html>`;
}

function formulario() {
  return pagina(`
    <span class="tag">Configuração local segura</span>
    <h1>Inter Empresas · SYSNEY</h1>
    <p>O certificado cliente e a chave privada já foram validados. Informe as credenciais exibidas no detalhe da integração ativa.</p>
    <form method="post" autocomplete="off">
      <label>Client ID<input name="clientId" required autocomplete="off" spellcheck="false"></label>
      <label>Client Secret<input name="clientSecret" type="password" required autocomplete="new-password" spellcheck="false"></label>
      <button type="submit">Salvar no cofre seguro</button>
    </form>
    <div class="safe">Os dados são enviados apenas para este servidor local em 127.0.0.1, gravados no Azure Key Vault e não permanecem no navegador ou no projeto.</div>
  `);
}

function sucesso() {
  return pagina(`
    <div class="ok"><strong>Configuração armazenada</strong>
    <p>Certificado, chave, Client ID e Client Secret foram enviados ao Azure Key Vault. A página local será encerrada e as consultas ao Inter continuam bloqueadas até o teste de autenticação.</p></div>
  `);
}

async function lerCorpo(request) {
  const partes = [];
  let tamanho = 0;
  for await (const parte of request) {
    tamanho += parte.length;
    if (tamanho > 16_384) throw new Error("Requisição excede o limite permitido.");
    partes.push(parte);
  }
  return Buffer.concat(partes).toString("utf8");
}

async function salvarNoCofre(clientId, clientSecret) {
  const client = new SecretClient(VAULT_URL, new DefaultAzureCredential());
  await client.setSecret("inter-sysney-client-id", clientId);
  await client.setSecret("inter-sysney-client-secret", clientSecret);
  await client.setSecret("inter-sysney-certificado-crt", certificate);
  await client.setSecret("inter-sysney-chave-privada", privateKey);
}

const server = createServer(async (request, response) => {
  if (request.url !== route || utilizado) {
    response.writeHead(404, headers).end(pagina("<h1>Página indisponível</h1>"));
    return;
  }

  if (request.method === "GET") {
    response.writeHead(200, headers).end(formulario());
    return;
  }

  if (request.method !== "POST") {
    response.writeHead(405, headers).end(pagina("<h1>Método não permitido</h1>"));
    return;
  }

  try {
    const params = new URLSearchParams(await lerCorpo(request));
    const clientId = params.get("clientId")?.trim();
    let clientSecret = params.get("clientSecret")?.trim();
    if (!clientId || !clientSecret || clientId.length > 200 || clientSecret.length > 500) {
      throw new Error("Client ID ou Client Secret inválido.");
    }

    await salvarNoCofre(clientId, clientSecret);
    clientSecret = null;
    utilizado = true;
    response.writeHead(200, headers).end(sucesso());
    server.close(() => process.exit(0));
  } catch (error) {
    console.error(`Falha ao armazenar a configuração: ${error.message}`);
    response
      .writeHead(500, headers)
      .end(
        pagina(
          '<h1>Não foi possível salvar</h1><div class="error">Verifique as credenciais e tente novamente.</div>'
        )
      );
  }
});

server.listen(PORT, HOST, () => {
  console.log(`CONFIG_URL=http://${HOST}:${PORT}${route}`);
});
