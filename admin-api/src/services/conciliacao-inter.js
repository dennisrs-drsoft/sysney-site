import { createHash } from "node:crypto";
import { consultarPaginaExtratoInter } from "./inter.js";
import { normalizarPix, paresPix, paresNotas, compativelPix } from "./conciliacao-regras.mjs";

export const partPix = "pix-conciliacao-sysney";
export const chavePix = id => createHash("sha256").update(id).digest("hex");
export async function registros(table, partitionKey) {
  const result = [];
  for await (const r of table.listEntities({ queryOptions: { filter: `PartitionKey eq '${partitionKey}'` } })) result.push({ ...JSON.parse(r.json), _rowKey: r.rowKey, _etag: r.etag });
  return result;
}
export async function vincularPix(table, c, regra, pix, responsavel, modo) {
  if (!compativelPix(c, regra, pix)) throw Error("Recebimento incompatível ou cobrança já movimentada. Atualize e confira os dados.");
  const vinculo = { tipo: "vinculo", cobrancaId: c.id, pixId: pix.id, documento: pix.documento, centavos: pix.centavos, vencimento:c.vencimento, data: pix.data, em: new Date().toISOString(), responsavel, modo };
  // Reserva de cobrança e transação no mesmo lote; nenhum PIX pode baixar duas cobranças.
  await table.submitTransaction([
    ["create", { partitionKey: partPix, rowKey: `c-${chavePix(c.id)}`, json: JSON.stringify(vinculo) }],
    ["create", { partitionKey: partPix, rowKey: `p-${chavePix(pix.id)}`, json: JSON.stringify({ tipo: "reserva", cobrancaId: c.id, pixId: pix.id }) }],
    ["update", { partitionKey: partPix, rowKey: regra._rowKey, json: JSON.stringify(Object.fromEntries(Object.entries(regra).filter(([k]) => !k.startsWith("_")))) }, "Replace", { etag: regra._etag }],
  ]);
  return vinculo;
}
export async function cruzarNotas(table, responsavel = "Sistema — conciliação Inter") {
  const [rows, notas, cobrancas, emails] = await Promise.all([registros(table,"inter-historico-sysney"),registros(table,"nfse-historico-sysney"),registros(table,"cobrancas-sysney"),registros(table,"emails-sysney")]);
  const pares = paresNotas(rows.map(r => ({ ...r, id:r._rowKey })), notas, cobrancas, emails);
  let vinculadas = 0;
  for (const p of pares) {
    const row = await table.getEntity("inter-historico-sysney",p.bancoId);
    const anterior = row.nfseVinculo ? JSON.parse(row.nfseVinculo) : null;
    if (anterior?.numero === p.numero) continue;
    if (anterior) continue; // Vínculo existente não é substituído silenciosamente.
    await table.updateEntity({ partitionKey:row.partitionKey,rowKey:row.rowKey,nfseVinculo:JSON.stringify({...p,em:new Date().toISOString(),responsavel,criterio:"Referência explícita + documento + valor + data fiscal compatível"}) },"Merge",{etag:row.etag});
    vinculadas++;
  }
  return { vinculadas, confirmadas:pares.length, semVinculo:rows.length-pares.length };
}
export async function sincronizarPix(table, consultar = consultarPaginaExtratoInter) {
  const fim = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const inicio = new Date(Date.parse(fim)-89*86400000).toISOString().slice(0,10), em = new Date().toISOString();
  const todas = [];
  for (let pagina=0;pagina<5;pagina++) {
    const r = await consultar({empresa:"sysney",dataInicial:inicio,dataFinal:fim,pagina});
    if (!Array.isArray(r.transacoes) || !Number.isSafeInteger(r.totalPaginas) || r.totalPaginas < 0 || (r.totalPaginas > 0 && !r.transacoes.length)) throw Error("Extrato incompleto; conciliação PIX não executada.");
    todas.push(...r.transacoes);
    if (pagina+1 >= r.totalPaginas && r.ultimaPagina === true) break;
    if (pagina === 4) throw Error("Extrato excedeu o limite de páginas; não executar baixas parciais.");
  }
  const pix = todas.map(t=>normalizarPix(t,em)).filter(Boolean);
  if(pix.some(p=>p.data<inicio||p.data>fim))throw Error("Extrato fora do período solicitado; conciliação não executada.");
  const ids = new Set();
  for(const p of pix){if(ids.has(p.id))throw Error("PIX duplicado no extrato; requer conferência.");ids.add(p.id);}
  // Guarda somente créditos PIX identificáveis, não o extrato inteiro nem débitos pessoais.
  for(const p of pix)await table.upsertEntity({partitionKey:"inter-pix-sysney",rowKey:chavePix(p.id),json:JSON.stringify(p)},"Merge");
  const [cobrancas, controles, emails] = await Promise.all([registros(table,"cobrancas-sysney"),registros(table,partPix),registros(table,"emails-sysney")]);
  const usadas = controles.filter(r=>r.tipo==="reserva").map(r=>r.pixId);
  const elegiveis = cobrancas.filter(c=>emails.some(e=>e.formaPagamento==="pix"&&e.fluxo?.cobrancaId===c.id&&e.centavos===c.centavos&&e.vencimento===c.vencimento)&&!controles.some(v=>v.tipo==="vinculo"&&v.cobrancaId===c.id));
  let baixas=0;
  for(const par of paresPix(elegiveis,controles.filter(r=>r.tipo==="regra"),pix,usadas)) {
    try { await vincularPix(table,elegiveis.find(c=>c.id===par.cobrancaId),controles.find(r=>r.tipo==="regra"&&r.cobrancaId===par.cobrancaId),pix.find(p=>p.id===par.pixId),"Sistema — Banco Inter","automatico");baixas++; }
    catch(e){if(![409,412].includes(e.statusCode))throw e;}
  }
  await table.upsertEntity({partitionKey:partPix,rowKey:"consulta",json:JSON.stringify({tipo:"consulta",inicio,fim,em,recebimentos:pix.length,baixas})},"Merge");
  return { recebimentos:pix.length, baixas };
}
