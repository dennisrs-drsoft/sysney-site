// Regras puras compartilhadas pelo servidor e pelos testes. Nenhuma chamada bancária.
const digitos = v => String(v || "").replace(/\D/g, "");
const numero = v => digitos(v).replace(/^0+/, "");
const dia = v => /^20\d{2}-\d{2}-\d{2}/.test(v || "") ? v.slice(0, 10) : "";

export function normalizarPix(t, consultadoEm) {
  const d = t?.detalhes;
  if (t?.tipoTransacao !== "PIX" || t.tipoOperacao !== "C" || !d?.endToEndId || !t.idTransacao || /devolu|estorno/i.test(`${t.titulo || ""} ${t.descricao || ""}`)) return null;
  const centavos = Math.round(Number(t.valor) * 100), documento = digitos(d.cpfCnpjPagador), data = dia(t.dataTransacao);
  if (!Number.isSafeInteger(centavos) || centavos <= 0 || !data || !Number.isFinite(Date.parse(data)) || new Date(data).toISOString().slice(0,10)!==data || ![11,14].includes(documento.length)) return null;
  return { id: String(d.endToEndId), transacao: String(t.idTransacao), documento, cliente: String(d.nomePagador || t.descricao || ""), centavos, data, horario: String(t.dataInclusao || ""), txid: String(d.txId || ""), consultadoEm };
}

export function compativelPix(c, regra, pix) {
  return !!regra && !c.boleto && c.centavos === regra.centavos && c.vencimento === regra.vencimento &&
    pix.documento === regra.documento && pix.centavos === c.centavos && pix.data >= regra.inicio && pix.data <= regra.fim &&
    !(c.eventos || []).some(e => ["pagamento", "estorno"].includes(e.tipo));
}

export function regraPixDoEnvio(c, email) {
  if (email.status !== "aceito" || email.aviso || email.formaPagamento !== "pix" ||
      email.fluxo?.cobrancaId !== c.id || !c.nota || email.fluxo.nota !== c.nota ||
      email.centavos !== c.centavos || email.vencimento !== c.vencimento || !dia(c.vencimento)) return null;
  const tentativa = email.tentativas?.find(t => t.status === "aceito" &&
    /^(?:\d{11}|\d{14})$/.test(t.documentoConciliacaoPix || "") && Number.isFinite(Date.parse(t.data)));
  if (!tentativa) return null;
  const inicio = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo", year:"numeric", month:"2-digit", day:"2-digit"}).format(new Date(tentativa.data));
  const fim = new Date(Math.min(
    Math.max(Date.parse(c.vencimento), Date.parse(inicio)) + 30 * 86400000,
    Date.parse(inicio) + 89 * 86400000,
  )).toISOString().slice(0, 10);
  return {tipo:"regra", cobrancaId:c.id, documento:tentativa.documentoConciliacaoPix, centavos:c.centavos,
    vencimento:c.vencimento, inicio, fim, automatica:true, em:tentativa.data, responsavel:"Sistema — cobrança por PIX"};
}

export function paresPix(cobrancas, regras, recebimentos, usados = []) {
  const livres = recebimentos.filter(p => !usados.includes(p.id));
  const candidatos = cobrancas.flatMap(c => {
    const regra = regras.find(r => r.cobrancaId === c.id && r.automatica === true);
    return livres.filter(p => compativelPix(c, regra, p)).map(p => ({ cobrancaId: c.id, pixId: p.id }));
  });
  // Unicidade nos dois sentidos: nunca escolher arbitrariamente entre parcelas/mensalidades.
  return candidatos.filter(p => candidatos.filter(x => x.cobrancaId === p.cobrancaId).length === 1 && candidatos.filter(x => x.pixId === p.pixId).length === 1);
}

export function paresNotas(banco, notas, cobrancas = [], emails = []) {
  const ativos = notas.filter(n => n.situacao === "N");
  const candidatos = banco.flatMap(b => {
    const d = b.cobranca;
    if (!d || ["CANCELADO", "EXPIRADO"].includes(d.situacao)) return [];
    const locais = cobrancas.filter(c => numero(c.boleto) && numero(c.boleto) === numero(b.boleto?.nossoNumero));
    const mensagens = emails.filter(e => numero(e.fluxo?.boleto) && numero(e.fluxo.boleto) === numero(b.boleto?.nossoNumero));
    const referencias = [...locais.map(c => c.nota), ...mensagens.map(e => e.fluxo?.nota)].filter(Boolean);
    if (/^\d+$/.test(d.seuNumero || "")) referencias.push(d.seuNumero);
    const ns = [...new Set(referencias.map(numero))];
    if (ns.length !== 1) return [];
    return ativos.filter(n => numero(n.numero) === ns[0] && digitos(n.documento) === digitos(d.pagador?.cpfCnpj) && digitos(n.documento).length >= 11 && n.centavos === Math.round(Number(d.valorNominal) * 100) && dia(n.emissao) && dia(n.emissao) <= dia(d.dataEmissao)).map(n => ({ bancoId: b.id, numero: n.numero, documento: digitos(n.documento), centavos: n.centavos, emissao: n.emissao, referencia: d.seuNumero || "" }));
  });
  return candidatos.filter(p => candidatos.filter(x => x.bancoId === p.bancoId).length === 1 && candidatos.filter(x => x.numero === p.numero).length === 1);
}
