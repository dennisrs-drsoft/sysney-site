// Execução opcional: iniciar postman/simulations/inter-read.sim.yaml na porta 4900.
// O cliente HTTP real é exercitado; apenas o cofre é substituído por dados fictícios.
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
let source=readFileSync(new URL("../admin-api/src/services/inter.js",import.meta.url),"utf8");
source=source.replace('"@azure/keyvault-secrets"',JSON.stringify(uri(`export class SecretClient{async getSecret(name){return {value:name.endsWith('client-id')?'id-ficticio':name.endsWith('client-secret')?'secret-ficticio':name.endsWith('conta-corrente')?'123':'ficticio'}}}`)));
for(const mod of ["@azure/identity","@azure/data-tables","undici"])source=source.replace(JSON.stringify(mod),JSON.stringify(import.meta.resolve(mod)));
process.env.KEY_VAULT_URI="https://cofre-ficticio.invalid";process.env.INTER_DRSOFT_ENABLED="true";
process.env.INTER_TOKEN_URL="http://127.0.0.1:4900/cobranca/v2/token";process.env.INTER_API_URL="http://127.0.0.1:4900";
const client=await import(uri(source));
for(const empresa of ["sysney","drsoft"]){
 const list=await client.listarCobrancasInter({empresa,dataInicial:"2026-10-01",dataFinal:"2026-10-17"});assert.equal(list.length,1);
 const pdf=await client.consultarCobrancaInter(empresa,"fake-123",true);assert.ok(Buffer.from(pdf.pdf,"base64").subarray(0,5).equals(Buffer.from("%PDF-")));
}
console.log("Cliente HTTP real consultou listagem e PDF das duas empresas pela simulação local; nenhuma credencial ou operação real.");
