// Verifica arquivos versionados; não imprime o segredo encontrado e não lê .env local.
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
const regras=[
 ["chave-privada",/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/],
 ["token-sendgrid",/\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/],
 ["token-github",/\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{36,}\b/],
 ["storage-account-key",/AccountKey=[A-Za-z0-9+/]{60,}={0,2}/],
];
let falhas=0;
for(const arquivo of execFileSync("git",["ls-files","-z"],{encoding:"utf8",maxBuffer:10_000_000}).split("\0").filter(Boolean)){
 if(/\.(?:pfx|p12|key|pem)$/i.test(arquivo)||/(?:^|\/)\.env(?:\.|$)/.test(arquivo)&&!arquivo.endsWith(".example")){
  console.error(`Arquivo sensível versionado: ${arquivo}`);falhas++;continue;
 }
 const buffer=readFileSync(arquivo);if(buffer.includes(0))continue;
 const linhas=buffer.toString("utf8").split(/\r?\n/);
 for(const [regra,regex] of regras){const linha=linhas.findIndex(v=>regex.test(v));if(linha>=0){console.error(`Possível segredo: ${arquivo}:${linha+1} (${regra}); conteúdo omitido.`);falhas++;}}
}
if(falhas)process.exitCode=1;else console.log("Nenhum segredo reconhecido nos arquivos versionados. Não substitui revisão e rotação de credenciais.");
