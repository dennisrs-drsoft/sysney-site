import { NextRequest, NextResponse } from "next/server";
import { DefaultAzureCredential } from "@azure/identity";
import { TableClient, type TableEntityResult, type TransactionAction } from "@azure/data-tables";
import { createHash } from "node:crypto";
import { usuarioAdministrador } from "../_auth";
import { encaminharAdmin } from "../_remote";
import { carteira, dataValida, hojeBrasil, mesValido, pago, prevista, integrarEnvios, integrarPagamentosInter, integrarPagamentosPix, type VinculoPix, type Plano, type Cobranca, type Evento } from "@/lib/cobrancas";
import type { EmailCobranca } from "@/lib/emails-cobranca";
import { validarPlanejamentoFiscal, validarLoteRegularizacao, simularRegularizacao, type LoteRegularizacao, type RegularizacaoFiscal } from "@/lib/regularizacao-fiscal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const credential = new DefaultAzureCredential();
type Registro = { json: string };
function tabela(nome: string) {
  const conta = process.env.ADMIN_STORAGE_ACCOUNT || (process.env.NODE_ENV !== "production" ? "sysneyadm2602" : "");
  if (!conta) throw new Error("Armazenamento não configurado.");
  return new TableClient(`https://${conta}.table.core.windows.net`, nome, credential);
}
function resposta(dados: unknown, status = 200) {
  return NextResponse.json(dados, { status, headers: { "Cache-Control": "no-store" } });
}
function empresa(req: NextRequest) {
  const v = req.nextUrl.searchParams.get("empresa");
  if (v !== "sysney" && v !== "drsoft") throw new Error("Empresa inválida.");
  return v;
}
function texto(v: unknown, limite = 500) {
  if (typeof v !== "string" || !v.trim() || v.length > limite) throw new Error("Preencha os campos obrigatórios dentro do limite permitido.");
  return v.trim();
}
function inteiro(v: unknown, min: number, max: number) {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max) throw new Error("Valor ou prazo inválido.");
  return v;
}
async function ler<T>(table: TableClient, partitionKey: string) {
  const lista: T[] = [];
  for await (const e of table.listEntities<Registro>({ queryOptions: { filter: `PartitionKey eq '${partitionKey}'` } })) lista.push(JSON.parse(e.json) as T);
  return lista;
}
function falha(e: unknown) {
  const status = (e as { statusCode?: number }).statusCode;
  if (status === 409 || status === 412) return resposta({ erro: "O registro foi atualizado. Atualize a lista antes de repetir a ação." }, 409);
  if (status) return resposta({ erro: "Não foi possível acessar o registro na base. Tente novamente." }, 503);
  return resposta({ erro: e instanceof Error ? e.message : "Operação inválida." }, 400);
}
export async function GET(req: NextRequest) {
  const remote = await encaminharAdmin(req); if (remote) return remote;
  if (!usuarioAdministrador(req)) return resposta({ erro: "Não autorizado." }, 401);
  try {
    if(req.nextUrl.searchParams.get("regularizacao")==="1") {
      const emp=empresa(req);
      const rows=await ler<RegularizacaoFiscal|LoteRegularizacao>(tabela("AdminDocumentos"),`regularizacao-${emp}`);
      const registros=rows.filter((r):r is RegularizacaoFiscal=>typeof r.id==="string"&&/^[a-f0-9]{64}$/.test(r.id));
      const lotes=rows.filter((r):r is LoteRegularizacao=>"tipo" in r&&r.tipo==="lote-regularizacao");
      return resposta({registros:registros.sort((a,b)=>a.recebimento.localeCompare(b.recebimento)),lotes});
    }
    const part = `cobrancas-${empresa(req)}`;
    const mes = req.nextUrl.searchParams.get("mes") || hojeBrasil().slice(0, 7);
    if (!mesValido(mes)) throw new Error("Competência inválida.");
    const [planos, salvas] = await Promise.all([
      ler<Plano>(tabela("AdminConfiguracoes"), part), ler<Cobranca>(tabela("AdminDocumentos"), part),
    ]);
    const ate = mes > hojeBrasil().slice(0, 7) ? mes : hojeBrasil().slice(0, 7);
    const emails = await ler<EmailCobranca>(tabela("AdminDocumentos"), `emails-${empresa(req)}`);
    const projetadas=integrarEnvios(carteira(planos, salvas, ate), emails, empresa(req));
    const banco:Parameters<typeof integrarPagamentosInter>[2]=[];
    if(empresa(req)==="sysney")for await(const row of tabela("AdminDocumentos").listEntities<Registro&{atualizadoEm:string}>({queryOptions:{filter:"PartitionKey eq 'inter-historico-sysney'"}}))banco.push({...JSON.parse(row.json),consultadoEm:row.atualizadoEm});
    const vs=empresa(req)==="sysney"?(await ler<VinculoPix>(tabela("AdminDocumentos"),"pix-conciliacao-sysney")).filter(v=>v.tipo==="vinculo"):[];
    return resposta({ planos, cobrancas: integrarPagamentosPix(integrarPagamentosInter(projetadas,planos,banco,emails),planos,vs,emails), hoje: hojeBrasil() });
  } catch (e) { return falha(e); }
}
export async function POST(req: NextRequest) {
  const remote = await encaminharAdmin(req); if (remote) return remote;
  if (!usuarioAdministrador(req)) return resposta({ erro: "Não autorizado." }, 401);
  if (req.headers.get("origin") !== req.nextUrl.origin) return resposta({ erro: "Origem inválida." }, 403);
  try {
    const emp = empresa(req);
    const part = `cobrancas-${emp}`;
    const raw = await req.text();
    if (raw.length > 12000) throw new Error("Solicitação muito grande.");
    const body = JSON.parse(raw);
    if(body.acao==="preparar-lote-regularizacao") {
      if(!Array.isArray(body.recebimentos)||!body.recebimentos.length||body.recebimentos.length>40)throw Error("Selecione de 1 a 40 recebimentos.");
      const table=tabela("AdminDocumentos"), partitionKey=`regularizacao-${emp}`;
      const registros:RegularizacaoFiscal[]=[];
      const originais:TableEntityResult<Registro>[]=[];
      for(const item of body.recebimentos) {
        if(!/^[a-f0-9]{64}$/.test(item.id||""))throw Error("Recebimento inválido.");
        const original=await table.getEntity<Registro>(partitionKey,item.id);
        const r:RegularizacaoFiscal=JSON.parse(original.json);
        if(r.id!==item.id||r.atualizadoEm!==item.atualizadoEm)throw Error("O recebimento mudou. Atualize a consulta.");
        registros.push(r);originais.push(original);
      }
      validarLoteRegularizacao(registros,emp);
      for(const r of registros)validarPlanejamentoFiscal(r,{competencia:r.competencia,evidenciaCompetencia:r.evidenciaCompetencia,emissaoPlanejada:"",nota:""},hojeBrasil());
      if(typeof body.percentual!=="string")throw Error("Informe a alíquota do cenário.");
      const simulacao=simularRegularizacao(registros,body.percentual);
      if(simulacao.imposto===null)throw Error("Alíquota do cenário inválida.");
      const origemCenario=texto(body.origemCenario,1000);
      const principal=req.headers.get("x-ms-client-principal");
      const responsavel=principal?String(JSON.parse(Buffer.from(principal,"base64").toString("utf8")).userDetails||"Administrador").slice(0,254):"Administrador local";
      const id=`lote-${createHash("sha256").update(registros.map(r=>r.id).sort().join("|")).digest("hex")}`;
      const lote:LoteRegularizacao={id,tipo:"lote-regularizacao",empresa:emp,estado:"aguardando-validacao-fiscal",criadoEm:new Date().toISOString(),responsavel,dataPreparacao:hojeBrasil(),percentualCenario:body.percentual,origemCenario,total:simulacao.total,impostoEstimado:simulacao.imposto,
        recebimentos:registros.map(r=>({id:r.id,recebimento:r.recebimento,competencia:r.competencia,centavos:r.centavos,vencimentoReferencia:r.vencimentoReferencia,descricao:`${r.descricao} Referência: ${r.competencia}. PIX recebido em ${r.recebimento}. Serviço já pago; sem nova cobrança.`,status:"pago"}))};
      if(Buffer.byteLength(JSON.stringify(lote),"utf16le")>60000)throw Error("Lote muito grande. Selecione menos recebimentos.");
      // Reservas exclusivas e ETags no mesmo lote: sem dupla preparação ou revisão concorrente.
      await table.submitTransaction([
        ["create",{partitionKey,rowKey:id,json:JSON.stringify(lote)}],
        ...registros.map((r):TransactionAction=>["create",{partitionKey,rowKey:`reserva-${r.id}`,json:JSON.stringify({loteId:id})}]),
        ...originais.map((r,i):TransactionAction=>["update",{partitionKey,rowKey:registros[i].id,json:r.json},"Replace",{etag:r.etag}]),
      ]);
      return resposta({lote,emissaoExecutada:false,emailEnviado:false},201);
    }
    if(body.acao==="planejar-regularizacao") {
      if(!/^[a-f0-9]{64}$/.test(body.id || ""))throw new Error("Recebimento inválido.");
      const table=tabela("AdminDocumentos"), partitionKey=`regularizacao-${emp}`;
      const original=await table.getEntity<Registro>(partitionKey,body.id);
      const registro:RegularizacaoFiscal=JSON.parse(original.json);
      if(registro.empresa!==emp || registro.id!==body.id)throw new Error("Recebimento de outra empresa.");
      if(body.atualizadoEm!==registro.atualizadoEm)throw new Error("O planejamento mudou. Atualize antes de salvar.");
      const atualizacao=validarPlanejamentoFiscal(registro,body,hojeBrasil());
      if(atualizacao.nota) {
        const nota=JSON.parse((await table.getEntity<Registro>(`nfse-historico-${emp}`,atualizacao.nota)).json);
        if(nota.documento?.replace(/\D/g,"")!==registro.documento || nota.centavos!==registro.centavos || nota.situacao!=="N")throw new Error("A nota deve estar ativa, ser do mesmo cliente e ter o mesmo valor. Outros casos precisam de conciliação fiscal.");
        for(const r of await ler<RegularizacaoFiscal>(table,partitionKey))if(r.id!==registro.id&&r.nota===atualizacao.nota)throw new Error("Essa nota já está vinculada a outro recebimento.");
      }
      let responsavel="Administrador local";
      const principal=req.headers.get("x-ms-client-principal");
      if(principal){const p=JSON.parse(Buffer.from(principal,"base64").toString("utf8"));responsavel=String(p.userDetails||p.userId||"Administrador").slice(0,254);}
      const revisoes=registro.revisoes||[];
      if(revisoes.length>=50)throw new Error("Limite de revisões atingido. Preserve o histórico para auditoria.");
      const agora=new Date().toISOString();
      const json=JSON.stringify({...registro,...atualizacao,atualizadoEm:agora,revisoes:[...revisoes,{data:agora,responsavel,...atualizacao}]});
      if(Buffer.byteLength(json,"utf16le")>60000)throw new Error("Limite de armazenamento do histórico atingido.");
      const entidade={partitionKey,rowKey:body.id,json};
      if(atualizacao.nota&&!registro.nota) {
        // Vínculo único e atualização com ETag no mesmo lote atômico: duas revisões
        // concorrentes não podem atribuir a mesma nota a recebimentos diferentes.
        await table.submitTransaction([
          ["create",{partitionKey,rowKey:`nota-${atualizacao.nota}`,json:JSON.stringify({tipo:"vinculo-nota",recebimentoId:registro.id})}],
          ["update",entidade,"Replace",{etag:original.etag}],
        ]);
      } else await table.updateEntity(entidade,"Replace",{etag:original.etag});
      return resposta({sucesso:true});
    }
    const planosTable = tabela("AdminConfiguracoes");
    if (body.acao === "plano") {
      const clienteId = texto(body.clienteId, 100);
      if (!/^[a-zA-Z0-9-]+$/.test(clienteId)) throw new Error("Cliente inválido.");
      const cliente = await tabela(process.env.ADMIN_STORAGE_TABLE_CLIENTES || "AdminClientes").getEntity<{ nome: string; documento: string }>(emp, clienteId);
      if (!mesValido(body.inicio) || (body.fim && (!mesValido(body.fim) || body.fim < body.inicio))) throw new Error("Período da recorrência inválido.");
      if (body.inicio < dataValidaInicio()) throw new Error("Para o controle inicial, use uma competência dos últimos cinco anos.");
      const email = texto(body.email, 254);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
      const p: Plano = {
        id: createHash("sha256").update(cliente.documento).digest("hex"), clienteId,
        clienteNome: cliente.nome, documento: cliente.documento, email,
        descricao: texto(body.descricao), centavos: inteiro(body.centavos, 1, 10000000000),
        inicio: body.inicio, fim: body.fim || "", diaEnvio: inteiro(body.diaEnvio, 1, 31),
        mesEnvio: inteiro(body.mesEnvio, 0, 3), diaVencimento: inteiro(body.diaVencimento, 1, 31),
        mesVencimento: inteiro(body.mesVencimento, 0, 3), criadoEm: new Date().toISOString(),
      };
      const c = prevista(p, p.inicio);
      if (p.mesVencimento < p.mesEnvio || (p.mesVencimento === p.mesEnvio && p.diaVencimento < p.diaEnvio) || c.vencimento < c.envioPrevisto) throw new Error("O vencimento deve ser igual ou posterior ao envio previsto em todos os meses.");
      await planosTable.createEntity({ partitionKey: part, rowKey: p.id, json: JSON.stringify(p) });
      return resposta({ sucesso: true }, 201);
    }
    const id = texto(body.id, 100);
    if (!/^[a-f0-9]{64}_20\d{2}-(0[1-9]|1[0-2])$/.test(id)) throw new Error("Cobrança inválida.");
    const [planoId, competencia] = id.split("_");
    const table = tabela("AdminDocumentos");
    let original: TableEntityResult<Registro> | undefined;
    try { original = await table.getEntity<Registro>(part, id); }
    catch (e) { if ((e as { statusCode?: number }).statusCode !== 404) throw e; }
    let c: Cobranca;
    if (original) c = JSON.parse(original.json);
    else {
      const p: Plano = JSON.parse((await planosTable.getEntity<Registro>(part, planoId)).json);
      if (competencia < p.inicio || (p.fim && competencia > p.fim)) throw new Error("Competência fora do contrato.");
      c = prevista(p, competencia);
    }
    const mensagens=await ler<EmailCobranca>(table, `emails-${emp}`);
    c = integrarEnvios([c], mensagens, emp)[0];
    if(emp==="sysney"&&["pagamento","estorno"].includes(body.acao)){
      const planos=await ler<Plano>(planosTable,part);
      const vinculos=(await ler<VinculoPix>(table,"pix-conciliacao-sysney")).filter(v=>v.tipo==="vinculo");
      c=integrarPagamentosPix([c],planos,vinculos,mensagens)[0];
    }
    const operacaoId = texto(body.operacaoId, 36);
    if (!/^[a-f0-9-]{36}$/.test(operacaoId)) throw new Error("Identificador inválido.");
    if (c.eventos.some(e => e.id === operacaoId)) return resposta({ sucesso: true });
    if (c.eventos.length >= 100) throw new Error("Limite de histórico atingido para esta competência.");
    const data = body.data || hojeBrasil();
    if (!dataValida(data) || data > hojeBrasil()) throw new Error("Informe uma data válida, até hoje.");
    let responsavel = "Administrador local";
    const principal = req.headers.get("x-ms-client-principal");
    if (principal) {
      const user = JSON.parse(Buffer.from(principal, "base64").toString("utf8"));
      responsavel = String(user.userDetails || user.userId || "Administrador").slice(0, 254);
    }
    const evento: Evento = { id: operacaoId, tipo: body.acao, data, registradoEm: new Date().toISOString(), responsavel, detalhe: "" };
    switch (body.acao) {
      case "documentos":
        c.nota = texto(body.nota, 120); c.boleto = texto(body.boleto, 120);
        c.demonstrativo = body.demonstrativo === true;
        if (!c.demonstrativo) throw new Error("Confirme a preparação do demonstrativo.");
        evento.detalhe = `Documentos conferidos manualmente: NFS-e ${c.nota}; boleto ${c.boleto}.`;
        break;
      case "envio":
        if (!c.nota || !c.boleto || !c.demonstrativo) throw new Error("Confira demonstrativo, nota e boleto antes de registrar o envio.");
        evento.detalhe = `Envio informado manualmente: ${texto(body.detalhe)}`;
        break;
      case "recebimento":
        if (!c.eventos.some(e => e.tipo === "envio" && e.data <= data)) throw new Error("Registre primeiro o envio com data anterior ou igual.");
        evento.detalhe = `Recebimento confirmado manualmente: ${texto(body.detalhe)}`;
        break;
      case "pagamento":
        evento.centavos = inteiro(body.centavos, 1, c.centavos - pago(c));
        evento.detalhe = `Pagamento informado manualmente: ${texto(body.detalhe)}`;
        break;
      case "estorno": {
        const pagamento = c.eventos.find(e => e.id === body.referencia && e.tipo === "pagamento");
        if (!pagamento || c.eventos.some(e => e.tipo === "estorno" && e.referencia === pagamento.id)) throw new Error("Pagamento não disponível para correção.");
        evento.referencia = pagamento.id;
        evento.detalhe = `Correção de registro no acompanhamento, sem devolução ou movimentação bancária: ${texto(body.detalhe)}`;
        break;
      }
      default: throw new Error("Ação inválida.");
    }
    c.eventos.push(evento); c.persistida = true;
    const json = JSON.stringify(c);
    if (Buffer.byteLength(json, "utf16le") > 60000) throw new Error("Limite de histórico atingido.");
    const entity = { partitionKey: part, rowKey: id, json };
    if (original) await table.updateEntity(entity, "Replace", { etag: original.etag });
    else await table.createEntity(entity);
    return resposta({ sucesso: true });
  } catch (e) { return falha(e); }
}
function dataValidaInicio() {
  const ano = Number(hojeBrasil().slice(0, 4)) - 5;
  return `${ano}-01`;
}
