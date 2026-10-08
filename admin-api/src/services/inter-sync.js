import { randomUUID, createHash } from "node:crypto";
import { DefaultAzureCredential } from "@azure/identity";
import { TableClient } from "@azure/data-tables";
import { listarCobrancasInter, consultarCobrancaInter } from "./inter.js";

const partitionKey = "inter-sync-sysney", rowKey = "controle";
const intervalo = 15 * 60_000, lease = 10 * 60_000;
export function tabelaSync() {
  const conta = process.env.ADMIN_STORAGE_ACCOUNT;
  if (!conta) throw Error("Armazenamento não configurado.");
  return new TableClient(`https://${conta}.table.core.windows.net`, "AdminDocumentos", new DefaultAzureCredential());
}
export async function lerSync(table) {
  try { return await table.getEntity(partitionKey, rowKey); }
  catch (e) { if (e.statusCode === 404) return null; throw e; }
}
export function statusSync(row, ativo = process.env.INTER_SYNC_SYSNEY_ENABLED === "true") {
  const s = row ? JSON.parse(row.json) : {};
  const travado = s.estado === "executando" && Date.parse(s.iniciadoEm) + lease < Date.now();
  return { ativa: ativo, intervaloMinutos: 15, estado: travado ? "interrompida" : s.estado || "aguardando",
    ultimaTentativa: s.iniciadoEm || "", ultimoSucesso: s.ultimoSucesso || "", finalizadoEm: s.finalizadoEm || "",
    solicitadaEm: s.solicitadaEm || "", consultadas: s.consultadas || 0, atualizadas: s.atualizadas || 0,
    erro: travado ? "Execução interrompida; a rotina tentará novamente." : s.erro || "" };
}
async function gravarControle(table, row, s) {
  const entity = { partitionKey, rowKey, json: JSON.stringify(s) };
  if (row) await table.updateEntity(entity, "Replace", { etag: row.etag });
  else await table.createEntity(entity);
}
export async function solicitarSync(table, responsavel) {
  if (process.env.INTER_SYNC_SYSNEY_ENABLED !== "true") throw Error("Sincronização SYSNEY ainda não ativada no servidor.");
  const row = await lerSync(table), s = row ? JSON.parse(row.json) : {};
  if (s.estado === "solicitada" || (s.estado === "executando" && Date.parse(s.iniciadoEm) + lease > Date.now())) return statusSync(row);
  await gravarControle(table, row, { ...s, estado: "solicitada", solicitadaEm: new Date().toISOString(), solicitadoPor: String(responsavel).slice(0,254) });
  return statusSync(await lerSync(table));
}
export function normalizarSnapshot(item) {
  const c = item?.cobranca;
  if (!c || !/^[a-zA-Z0-9-]{1,100}$/.test(c.codigoSolicitacao || "") || !c.pagador?.cpfCnpj || !c.situacao || !Number.isFinite(Number(c.valorNominal)) || Number(c.valorNominal) <= 0) throw Error("Resposta bancária incompleta; dados anteriores preservados.");
  const json = JSON.stringify(item);
  if (Buffer.byteLength(json, "utf16le") > 60000) throw Error("Registro bancário excedeu o limite de armazenamento.");
  return { partitionKey: "inter-historico-sysney", rowKey: createHash("sha256").update(c.codigoSolicitacao).digest("hex"), json, atualizadoEm: new Date().toISOString() };
}
// Banco somente GET. Merge mantém PDF e eventos manuais em suas partições originais.
export async function executarSync({ table = tabelaSync(), listar = listarCobrancasInter, consultar = consultarCobrancaInter } = {}) {
  if (process.env.INTER_SYNC_SYSNEY_ENABLED !== "true") return { desativada: true };
  const row = await lerSync(table), s = row ? JSON.parse(row.json) : {}, agora = Date.now();
  if (s.estado === "executando" && Date.parse(s.iniciadoEm) + lease > agora) return { ocupada: true };
  if (s.estado !== "solicitada" && Number.isFinite(Date.parse(s.iniciadoEm)) && agora - Date.parse(s.iniciadoEm) < intervalo) return { aguardando: true };
  const token = randomUUID(), iniciadoEm = new Date(agora).toISOString();
  try { await gravarControle(table, row, { ...s, estado: "executando", token, iniciadoEm, erro: "" }); }
  catch (e) { if ([409,412].includes(e.statusCode)) return { ocupada: true }; throw e; }
  let consultadas = 0, atualizadas = 0;
  try {
    const recentes = await listar({ empresa: "sysney", dataInicial: new Date(agora - 89 * 86400000).toISOString().slice(0,10), dataFinal: iniciadoEm.slice(0,10), maxPaginas: 3 });
    const snapshots = recentes.map(normalizarSnapshot), ids = new Set(snapshots.map(r=>r.rowKey));
    for (const snapshot of snapshots) {
      let anterior;
      try { anterior = await table.getEntity(snapshot.partitionKey,snapshot.rowKey); }
      catch(e){if(e.statusCode!==404)throw e;}
      // A listagem pode omitir dados do boleto presentes na consulta individual.
      if(anterior){const novo=JSON.parse(snapshot.json),velho=JSON.parse(anterior.json);snapshot.json=JSON.stringify({...velho,...novo,boleto:{...velho.boleto,...novo.boleto}});}
      await table.upsertEntity(snapshot, "Merge"); atualizadas++; consultadas++;
    }
    const antigos = [];
    for await (const r of table.listEntities({ queryOptions: { filter: "PartitionKey eq 'inter-historico-sysney'" } })) if (!ids.has(r.rowKey)) antigos.push(r);
    // Rotação dos registros antigos, inclusive pagos/cancelados, para detectar mudanças posteriores.
    antigos.sort((a,b)=>(a.atualizadoEm||"").localeCompare(b.atualizadoEm||""));
    for (const r of antigos.slice(0,10)) {
      if (Date.now() - agora > 150_000) break;
      const codigo = JSON.parse(r.json).cobranca?.codigoSolicitacao;
      if (!codigo) throw Error("Histórico sem código bancário; requer conferência.");
      const detalhe = await consultar("sysney", codigo); consultadas++;
      const snapshot = normalizarSnapshot(detalhe);
      if (snapshot.rowKey !== r.rowKey) throw Error("Identificação bancária divergente; registro preservado.");
      await table.upsertEntity(snapshot, "Merge"); atualizadas++;
    }
    const lock = await lerSync(table), atual = JSON.parse(lock.json);
    if (atual.token !== token) throw Error("Execução substituída; consulte o estado atual.");
    const fim = new Date().toISOString();
    await gravarControle(table, lock, { ...atual, estado: "concluida", finalizadoEm: fim, ultimoSucesso: fim, consultadas, atualizadas, erro: "" });
    return { consultadas, atualizadas };
  } catch {
    const lock = await lerSync(table), atual = JSON.parse(lock.json);
    if (atual.token === token) await gravarControle(table, lock, { ...atual, estado: "falha", finalizadoEm: new Date().toISOString(), consultadas, atualizadas, erro: "Não foi possível concluir a consulta bancária. Registros já consultados foram atualizados; os demais preservados. Tente novamente." });
    return { falha: true, consultadas, atualizadas };
  }
}
