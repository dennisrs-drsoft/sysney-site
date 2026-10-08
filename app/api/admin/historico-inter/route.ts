import { DefaultAzureCredential } from "@azure/identity";
import { TableClient } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";
import { NextRequest, NextResponse } from "next/server";
import { usuarioAdministrador } from "../_auth";
import { encaminharAdmin } from "../_remote";
import { tabelaSync, lerSync, statusSync, solicitarSync } from "@/admin-api/src/services/inter-sync.js";
import { registros, partPix, chavePix, vincularPix, cruzarNotas } from "@/admin-api/src/services/conciliacao-inter.js";
import { compativelPix } from "@/admin-api/src/services/conciliacao-regras.mjs";
import { dataValida, pago, type Cobranca, type Plano } from "@/lib/cobrancas";
import type { EmailCobranca } from "@/lib/emails-cobranca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const remote = await encaminharAdmin(req); if (remote) return remote;
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!usuarioAdministrador(req)) return reply({ erro: "Não autorizado." }, 401);
  const empresa = req.nextUrl.searchParams.get("empresa");
  if (empresa !== "sysney" && empresa !== "drsoft") return reply({ erro: "Empresa inválida." }, 400);
  const conta = process.env.ADMIN_STORAGE_ACCOUNT || (process.env.NODE_ENV !== "production" ? "sysneyadm2602" : "");
  if (!conta) return reply({ erro: "Armazenamento não configurado." }, 503);
  try {
    const table = new TableClient(`https://${conta}.table.core.windows.net`, "AdminDocumentos", new DefaultAzureCredential());
    if(req.nextUrl.searchParams.get("pix")==="1"){
      if(empresa!=="sysney")return reply({erro:"PIX disponível somente para SYSNEY."},400);
      const id=req.nextUrl.searchParams.get("id")||"";
      if(!/^[a-zA-Z0-9_-]{1,140}$/.test(id))return reply({erro:"Cobrança inválida."},400);
      const c=JSON.parse((await table.getEntity<{json:string}>("cobrancas-sysney",id)).json) as Cobranca;
      const plano=JSON.parse((await new TableClient(`https://${conta}.table.core.windows.net`,"AdminConfiguracoes",new DefaultAzureCredential()).getEntity<{json:string}>("cobrancas-sysney",c.planoId)).json) as Plano;
      const [controles,pixs]=await Promise.all([registros(table,partPix),registros(table,"inter-pix-sysney")]);
      const regra=controles.find(r=>r.tipo==="regra"&&r.cobrancaId===id);
      const recebimentos=pixs.filter(p=>p.documento===plano.documento.replace(/\D/g,"")&&p.centavos===c.centavos&&!controles.some(v=>v.tipo==="reserva"&&v.pixId===p.id)).map(p=>({id:p.id,data:p.data,horario:p.horario,cliente:p.cliente,documento:p.documento,centavos:p.centavos,compativel:compativelPix(c,regra,p)}));
      return reply({regra:regra?{inicio:regra.inicio,fim:regra.fim,automatica:regra.automatica}:null,vinculo:controles.find(v=>v.tipo==="vinculo"&&v.cobrancaId===id)||null,consulta:controles.find(v=>v.tipo==="consulta")?.em||"",documento:plano.documento,recebimentos});
    }
    if(req.nextUrl.searchParams.get("sync")==="1")return reply({sincronizacao:empresa==="sysney"?statusSync(await lerSync(table)):{ativa:false,estado:"indisponivel",erro:"Integração DRSOFT ainda em validação."}});
    if(req.nextUrl.searchParams.get("arquivo")==="pdf"){
      const id=req.nextUrl.searchParams.get("id")||"";
      if(!/^[a-f0-9]{64}$/.test(id))return reply({erro:"Boleto inválido."},400);
      const row=await table.getEntity<{pdfBlob?:string}>(`inter-historico-${empresa}`,id);
      if(!row.pdfBlob?.startsWith(`historico/${empresa}/inter/`))return reply({erro:"PDF ainda não importado."},404);
      const bytes=await new BlobServiceClient(`https://${conta}.blob.core.windows.net`,new DefaultAzureCredential()).getContainerClient("admin-anexos").getBlockBlobClient(row.pdfBlob).downloadToBuffer();
      return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=\"boleto.pdf\"","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
    const cobrancas = [];
    const notas=await registros(table,`nfse-historico-${empresa}`);
    for await (const entity of table.listEntities<{ json: string; atualizadoEm: string; pdfBlob?:string;nfseVinculo?:string }>({ queryOptions: { filter: `PartitionKey eq 'inter-historico-${empresa}'` } })) {
      const { cobranca: c, boleto } = JSON.parse(entity.json);
      if (!c) continue;
      const vinculo=entity.nfseVinculo?JSON.parse(entity.nfseVinculo):null;
      const n=vinculo?notas.find(n=>n.numero===vinculo.numero&&n.situacao==="N"&&n.documento.replace(/\D/g,"")===String(c.pagador?.cpfCnpj||"").replace(/\D/g,"")&&n.centavos===Math.round(Number(c.valorNominal)*100)):undefined;
      cobrancas.push({ id: entity.rowKey, nota:n?.numero||"",emissaoNota:n?.emissao||"",cliente: c.pagador?.nome || "Não informado", documento: c.pagador?.cpfCnpj || "", numero: c.seuNumero || "", nossoNumero: boleto?.nossoNumero || c.nossoNumero || "", emissao: c.dataEmissao || "", vencimento: c.dataVencimento || "", valor: Number(c.valorNominal), valorRecebido: Number.isFinite(Number(c.valorTotalRecebido)) && c.valorTotalRecebido !== null && c.valorTotalRecebido !== undefined ? Number(c.valorTotalRecebido) : undefined, situacao: c.situacao || "Não informada", dataSituacao: c.dataSituacao || "", consultadoEm: entity.atualizadoEm, pdf:!!entity.pdfBlob });
    }
    cobrancas.sort((a, b) => b.vencimento.localeCompare(a.vencimento));
    const sincronizacao = empresa === "sysney" ? statusSync(await lerSync(table)) : { ativa:false, estado:"indisponivel", erro:"Integração DRSOFT ainda em validação." };
    return reply({ cobrancas, sincronizacao });
  } catch {
    return reply({ erro: "Não foi possível consultar o histórico importado." }, 503);
  }
}

export async function POST(req: NextRequest) {
  const remote = await encaminharAdmin(req); if (remote) return remote;
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!usuarioAdministrador(req)) return reply({ erro:"Não autorizado." },401);
  if (req.headers.get("origin") !== req.nextUrl.origin) return reply({erro:"Origem inválida."},403);
  if (req.nextUrl.searchParams.get("empresa") !== "sysney") return reply({erro:"Sincronização disponível apenas para SYSNEY."},400);
  try {
    const raw = await req.text();
    if (raw.length > 1500) return reply({erro:"Operação inválida."},400);
    const body=JSON.parse(raw);
    const principal = req.headers.get("x-ms-client-principal");
    const responsavel = principal ? JSON.parse(Buffer.from(principal,"base64").toString("utf8")).userDetails : "Administrador local";
    const table=tabelaSync();
    if(body.acao==="cruzar-notas")return reply(await cruzarNotas(table,responsavel));
    if(["regra-pix","vincular-pix"].includes(body.acao)){
      if(!/^[a-zA-Z0-9_-]{1,140}$/.test(body.id||""))return reply({erro:"Cobrança inválida."},400);
      const row=await table.getEntity<{json:string}>("cobrancas-sysney",body.id),c=JSON.parse(row.json) as Cobranca;
      const plano=JSON.parse((await new TableClient(`https://${process.env.ADMIN_STORAGE_ACCOUNT}.table.core.windows.net`,"AdminConfiguracoes",new DefaultAzureCredential()).getEntity<{json:string}>("cobrancas-sysney",c.planoId)).json) as Plano;
      const emails=await registros(table,"emails-sysney") as EmailCobranca[];
      if(c.boleto||pago(c)>0||c.eventos.some(e=>e.tipo==="estorno")||!emails.some(e=>e.formaPagamento==="pix"&&e.fluxo?.cobrancaId===c.id&&e.centavos===c.centavos&&e.vencimento===c.vencimento))return reply({erro:"A cobrança deve estar configurada como PIX, sem boleto nem pagamento manual."},400);
      const rk=`regra-${chavePix(c.id)}`,doc=plano.documento.replace(/\D/g,"");
      if(body.acao==="regra-pix"){
        if(!dataValida(body.inicio)||!dataValida(body.fim)||body.inicio>body.fim||Date.parse(body.fim)-Date.parse(body.inicio)>89*86400000||typeof body.automatica!=="boolean"||![11,14].includes(doc.length))return reply({erro:"Informe um período válido de até 90 dias."},400);
        let anterior;try{anterior=await table.getEntity(partPix,rk);}catch(e){if((e as {statusCode?:number}).statusCode!==404)throw e;}
        const entidade={partitionKey:partPix,rowKey:rk,json:JSON.stringify({tipo:"regra",cobrancaId:c.id,documento:doc,centavos:c.centavos,vencimento:c.vencimento,inicio:body.inicio,fim:body.fim,automatica:body.automatica,em:new Date().toISOString(),responsavel})};
        if(anterior)await table.updateEntity(entidade,"Replace",{etag:anterior.etag});else await table.createEntity(entidade);
        return reply({sucesso:true});
      }
      if(typeof body.pixId!=="string"||body.pixId.length>100)return reply({erro:"Identificador PIX inválido."},400);
      const regraRow=await table.getEntity<{json:string}>(partPix,rk),regra=JSON.parse(regraRow.json);
      if(regra.documento!==doc)return reply({erro:"Documento do cliente mudou; revise a regra."},409);
      const p=JSON.parse((await table.getEntity<{json:string}>("inter-pix-sysney",chavePix(body.pixId))).json);
      const v=await vincularPix(table,c,{...regra,_rowKey:rk,_etag:regraRow.etag},p,responsavel,"confirmado pelo administrador");
      return reply({sucesso:true,vinculo:v});
    }
    if(body.acao!=="sincronizar")return reply({erro:"Operação inválida."},400);
    return reply({sincronizacao:await solicitarSync(tabelaSync(),responsavel)},202);
  } catch (e) {
    const code=(e as {statusCode?:number}).statusCode;
    return reply({erro:[409,412].includes(code||0)?"Outra consulta foi solicitada. Atualize o estado antes de repetir.":"Não foi possível solicitar a sincronização. Confira se ela está ativa no servidor."},[409,412].includes(code||0)?409:503);
  }
}
