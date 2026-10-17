import {readFile} from "node:fs/promises";
import {X509Certificate,createPrivateKey,createPublicKey} from "node:crypto";
import AdmZip from "adm-zip";
import {AzureCliCredential} from "@azure/identity";
import {SecretClient} from "@azure/keyvault-secrets";

const [empresa,zipPath,credPath]=process.argv.slice(2);
try {
 if(!["sysney","drsoft"].includes(empresa)||!zipPath||!credPath)throw Error();
 const text=(await readFile(credPath,"utf8")).replace(/^\uFEFF/,"");
 const value=label=>text.match(new RegExp(`^\\s*Client[ _-]*${label}\\s*[:=]\\s*(\\S+)\\s*$`,"im"))?.[1];
 const id=value("ID"),secret=value("Secret");if(!id||!secret||id.length<8||secret.length<8)throw Error();
 const entries=new AdmZip(await readFile(zipPath)).getEntries().filter(e=>!e.isDirectory);
 const certEntry=entries.find(e=>/\.(crt|pem)$/i.test(e.entryName)),keyEntry=entries.find(e=>/\.key$/i.test(e.entryName));
 if(!certEntry||!keyEntry)throw Error();
 const certificate=certEntry.getData().toString("utf8"),privateKey=keyEntry.getData().toString("utf8");
 const cert=new X509Certificate(certificate),key=createPrivateKey(privateKey);
 if(!createPublicKey(key).export({type:"spki",format:"der"}).equals(cert.publicKey.export({type:"spki",format:"der"}))||Date.parse(cert.validTo)<=Date.now())throw Error();
 const vault=new SecretClient(process.env.KEY_VAULT_URI||"https://sysney-admin-kv-2602.vault.azure.net/",new AzureCliCredential());
 for(const [name,val] of [["client-id",id],["client-secret",secret],["certificado-crt",certificate],["chave-privada",privateKey]])await vault.setSecret(`inter-${empresa}-${name}`,val);
 console.log(JSON.stringify({empresa,credenciaisNoCofre:true,certificadoValidoAte:cert.validTo,chaveConfere:true}));
} catch {
 console.error("Não foi possível concluir a configuração. Confira formato do arquivo, certificado/chave e acesso ao cofre. Nenhuma credencial será exibida.");process.exitCode=1;
}
