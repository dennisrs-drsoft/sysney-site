import { randomUUID, createHash } from "node:crypto";
import { DefaultAzureCredential } from "@azure/identity";
import { TableClient } from "@azure/data-tables";
import { listarCobrancasInter, consultarCobrancaInter } from "./inter.js";
import { sincronizarPix, cruzarNotas } from "./conciliacao-inter.js";

const rowKey = "controle";
function part(empresa) { if(!["sysney","drsoft"].includes(empresa))throw Error("Empresa inválida."); return `inter-sync-${empresa}`; }
export const syncAtiva = (empresa="sysney") => {part(empresa);return process.env[`INTER_SYNC_${empresa.toUpperCase()}_ENABLED`]==="true";};
const intervalo = 15 * 60_000, lease = 10 * 60_000;
export function tabelaSync() {
  const conta = process.env.ADMIN_STORAGE_ACCOUNT;
  if (!conta) throw Error("Armazenamento não configurado.");
  return new TableClient(`https://${conta}.table.core.windows.net`, "AdminDocumentos", new DefaultAzureCredential());
}
export async function lerSync(table, empresa="sysney") {
  try { return await table.getEntity(part(empresa), rowKey); }
  catch (e) { if (e.statusCode === 404) return null; throw e; }
}
export function statusSync(row, ativo = syncAtiva()) {
  const s = row ? JSON.parse(row.json) : {};
  const travado = s.estado === "executando" && Date.parse(s.iniciadoEm) + lease < Date.now();
  return { ativa: ativo, intervaloMinutos: 15, estado: travado ? "interrompida" : s.estado || "aguardando",
    ultimaTentativa: s.iniciadoEm || "", ultimoSucesso: s.ultimoSucesso || "", finalizadoEm: s.finalizadoEm || "",
    solicitadaEm: s.solicitadaEm || "", consultadas: s.consultadas || 0, atualizadas: s.atualizadas || 0,
    erro: travado ? "Execução interrompida; a rotina tentará novamente." : s.erro || "" };
}
async function gravarControle(table, row, s, empresa="sysney") {
  const entity = { partitionKey:part(empresa), rowKey, json: JSON.stringify(s) };
  if (row) await table.updateEntity(entity, "Replace", { etag: row.etag });
  else await table.createEntity(entity);
}
export async function solicitarSync(table, responsavel, empresa="sysney") {
  if (!syncAtiva(empresa)) throw Error("Sincronização bancária ainda não ativada no servidor.");
  const row = await lerSync(table,empresa), s = row ? JSON.parse(row.json) : {};
  if (s.estado === "solicitada" || (s.estado === "executando" && Date.parse(s.iniciadoEm) + lease > Date.now())) return statusSync(row,syncAtiva(empresa));
  await gravarControle(table, row, { ...s, estado: "solicitada", solicitadaEm: new Date().toISOString(), solicitadoPor: String(responsavel).slice(0,254) },empresa);
  return statusSync(await lerSync(table,empresa),syncAtiva(empresa));
}
export function normalizarSnapshot(item, empresa="sysney") {
  part(empresa);
  const c = item?.cobranca;
  if (!c || !/^[a-zA-Z0-9-]{1,100}$/.test(c.codigoSolicitacao || "") || !c.pagador?.cpfCnpj || !c.situacao || !Number.isFinite(Number(c.valorNominal)) || Number(c.valorNominal) <= 0) throw Error("Resposta bancária incompleta; dados anteriores preservados.");
  const json = JSON.stringify(item);
  if (Buffer.byteLength(json, "utf16le") > 60000) throw Error("Registro bancário excedeu o limite de armazenamento.");
  return { partitionKey: `inter-historico-${empresa}`, rowKey: createHash("sha256").update(c.codigoSolicitacao).digest("hex"), json, atualizadoEm: new Date().toISOString() };
}
// Banco somente GET. Merge mantém PDF e eventos manuais em suas partições originais.
export async function executarSync({ empresa="sysney", table = tabelaSync(), listar = listarCobrancasInter, consultar = consultarCobrancaInter, pix = sincronizarPix, notas = cruzarNotas } = {}) {
  if (!syncAtiva(empresa)) return { desativada: true };
  const row = await lerSync(table,empresa), s = row ? JSON.parse(row.json) : {}, agora = Date.now();
  if (s.estado === "executando" && Date.parse(s.iniciadoEm) + lease > agora) return { ocupada: true };
  if (s.estado !== "solicitada" && Number.isFinite(Date.parse(s.iniciadoEm)) && agora - Date.parse(s.iniciadoEm) < intervalo) return { aguardando: true };
  const token = randomUUID(), iniciadoEm = new Date(agora).toISOString();
  try { await gravarControle(table, row, { ...s, estado: "executando", token, iniciadoEm, erro: "" },empresa); }
  catch (e) { if ([409,412].includes(e.statusCode)) return { ocupada: true }; throw e; }
  let consultadas = 0, atualizadas = 0;
  try {
    const recentes = await listar({ empresa, dataInicial: new Date(agora - 89 * 86400000).toISOString().slice(0,10), dataFinal: iniciadoEm.slice(0,10), maxPaginas: 3 });
    const snapshots = recentes.map(item=>normalizarSnapshot(item,empresa)), ids = new Set(snapshots.map(r=>r.rowKey));
    for (const snapshot of snapshots) {
      let anterior;
      try { anterior = await table.getEntity(snapshot.partitionKey,snapshot.rowKey); }
      catch(e){if(e.statusCode!==404)throw e;}
      // A listagem pode omitir dados do boleto presentes na consulta individual.
      if(anterior){const novo=JSON.parse(snapshot.json),velho=JSON.parse(anterior.json);snapshot.json=JSON.stringify({...velho,...novo,boleto:{...velho.boleto,...novo.boleto}});}
      await table.upsertEntity(snapshot, "Merge"); atualizadas++; consultadas++;
    }
    const antigos = [];
    for await (const r of table.listEntities({ queryOptions: { filter: `PartitionKey eq 'inter-historico-${empresa}'` } })) if (!ids.has(r.rowKey)) antigos.push(r);
    // Rotação dos registros antigos, inclusive pagos/cancelados, para detectar mudanças posteriores.
    antigos.sort((a,b)=>(a.atualizadoEm||"").localeCompare(b.atualizadoEm||""));
    for (const r of antigos.slice(0,10)) {
      if (Date.now() - agora > 150_000) break;
      const codigo = JSON.parse(r.json).cobranca?.codigoSolicitacao;
      if (!codigo) throw Error("Histórico sem código bancário; requer conferência.");
      const detalhe = await consultar(empresa, codigo); consultadas++;
      const snapshot = normalizarSnapshot(detalhe,empresa);
      if (snapshot.rowKey !== r.rowKey) throw Error("Identificação bancária divergente; registro preservado.");
      await table.upsertEntity(snapshot, "Merge"); atualizadas++;
    }
    // Conciliação adicional não apaga os boletos quando uma fonte fica indisponível.
    let conciliacaoErro="", recebimentosPix=0, baixasPix=0, notasVinculadas=0;
    try { const r=await pix(table,undefined,empresa);recebimentosPix=r.recebimentos;baixasPix=r.baixas; }
    catch { conciliacaoErro="Consulta de boletos concluída, mas a conciliação PIX não pôde ser concluída. Confira o extrato antes de registrar o pagamento."; }
    try { notasVinculadas=(await notas(table,undefined,empresa)).vinculadas; }
    catch { conciliacaoErro+=" Vínculos fiscais não atualizados; dados anteriores preservados."; }
    const lock = await lerSync(table,empresa), atual = JSON.parse(lock.json);
    if (atual.token !== token) throw Error("Execução substituída; consulte o estado atual.");
    const fim = new Date().toISOString();
    await gravarControle(table, lock, { ...atual, estado: conciliacaoErro?"parcial":"concluida", finalizadoEm: fim, ultimoSucesso: fim, consultadas, atualizadas, recebimentosPix, baixasPix, notasVinculadas, erro: conciliacaoErro },empresa);
    return { consultadas, atualizadas, recebimentosPix, baixasPix, notasVinculadas };
  } catch {
    const lock = await lerSync(table,empresa), atual = JSON.parse(lock.json);
    if (atual.token === token) await gravarControle(table, lock, { ...atual, estado: "falha", finalizadoEm: new Date().toISOString(), consultadas, atualizadas, erro: "Não foi possível concluir a consulta bancária. Registros já consultados foram atualizados; os demais preservados. Tente novamente." },empresa);
    return { falha: true, consultadas, atualizadas };
  }
}
