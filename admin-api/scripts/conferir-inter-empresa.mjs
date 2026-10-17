import {executarSync,tabelaSync} from "../src/services/inter-sync.js";
import {integrarPagamentosInter} from "../../lib/cobrancas.ts";
import {TableClient} from "@azure/data-tables";
import {DefaultAzureCredential} from "@azure/identity";
const empresa=process.argv[2];if(!["sysney","drsoft"].includes(empresa))throw Error("Empresa inválida.");
const r=await executarSync({empresa});console.log(JSON.stringify({empresa,sincronizacao:r}));
const table=tabelaSync(),historico=[],cobrancas=[],emails=[],planos=[],situacoes={};
const ler=async(t,part)=>{const rows=[];for await(const row of t.listEntities({queryOptions:{filter:`PartitionKey eq '${part}'`}}))rows.push({...JSON.parse(row.json),consultadoEm:row.atualizadoEm});return rows;};
historico.push(...await ler(table,`inter-historico-${empresa}`));
cobrancas.push(...await ler(table,`cobrancas-${empresa}`));emails.push(...await ler(table,`emails-${empresa}`));
const config=new TableClient(`https://${process.env.ADMIN_STORAGE_ACCOUNT}.table.core.windows.net`,"AdminConfiguracoes",new DefaultAzureCredential());
planos.push(...await ler(config,`cobrancas-${empresa}`));
for(const h of historico){const k=h.cobranca.situacao;situacoes[k]=(situacoes[k]||0)+1;}
const result=integrarPagamentosInter(cobrancas,planos,historico,emails);
console.log(JSON.stringify({empresa,historico:historico.length,situacoes,baixasManuaisPreservadas:cobrancas.filter(c=>c.eventos?.some(e=>e.tipo==="pagamento")).length,novasConfirmacoesBancarias:result.filter((c,i)=>c.eventos.length!==cobrancas[i].eventos.length).length,emissoes:0,cancelamentos:0,envios:0}));
