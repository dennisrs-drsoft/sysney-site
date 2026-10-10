import { createHash } from 'node:crypto';

const numero = v => String(v || '').replace(/^0+/, '');
const hash = v => createHash('sha256').update(v).digest('hex');

// Não presume datas de recebimento, vencimento, competência do serviço ou envio.
// Data de emissão serve apenas para indexar o histórico, nunca como data do pagamento.
export function planejarHistoricoRecebido(notas, cobrancas, { empresa, excluidas, em, responsavel }) {
  if (empresa !== 'drsoft' || !Array.isArray(excluidas) || !excluidas.length || !responsavel || !Number.isFinite(Date.parse(em))) throw Error('Autorização histórica incompleta.');
  const excluir = new Set(excluidas.map(numero)), vistos = new Set();
  const operacoes = [], resumo = { canceladas: 0, excluidas: 0, jaRecebidas: 0, criar: 0, atualizar: 0, centavos: 0 };
  for (const n of notas) {
    const nf = numero(n.numero);
    if (!/^[1-9]\d{0,14}$/.test(nf) || vistos.has(nf) || !['N', 'C'].includes(n.situacao)) throw Error('Identificação ou situação fiscal não confirmada.');
    vistos.add(nf);
    if (n.situacao === 'C') { resumo.canceladas++; continue; }
    if (excluir.has(nf)) { resumo.excluidas++; continue; }
    if (!Number.isSafeInteger(n.centavos) || n.centavos <= 0 || !/^20\d{2}-(0[1-9]|1[0-2])-\d{2}/.test(n.emissao) || !/^\d{14}$/.test(n.documento) || !n.xmlBlob) throw Error('Dados da nota insuficientes para gerar cobrança histórica.');
    const matches = cobrancas.filter(c => numero(c.nota) === nf);
    if (matches.length > 1) throw Error('Mais de uma cobrança vinculada à mesma nota.');
    const anterior = matches[0];
    if (anterior && anterior.centavos !== n.centavos) throw Error('Valor da cobrança existente diverge da nota.');
    if (anterior?.eventos.some(e => e.tipo === 'estorno')) throw Error('Cobrança possui estorno: exige revisão individual.');
    const recebido = anterior?.eventos.filter(e => e.tipo === 'pagamento').reduce((s, e) => s + (e.centavos || 0), 0) || 0;
    if (recebido >= n.centavos) { resumo.jaRecebidas++; continue; }
    const planoId = hash(`historico-nfse:${empresa}:${nf}`), competencia = n.emissao.slice(0, 7);
    const plano = anterior ? null : { id: planoId, clienteId: `historico-${n.documento}`, clienteNome: n.cliente, documento: n.documento,
      email: '', descricao: n.descricao || `Histórico da NFS-e ${nf}`, centavos: n.centavos, inicio: competencia, fim: competencia,
      diaEnvio: 1, mesEnvio: 0, diaVencimento: 1, mesVencimento: 0, criadoEm: em, origem: 'historico-fiscal', competenciaConfirmada: false };
    const c = anterior ? structuredClone(anterior) : { id: `${planoId}_${competencia}`, planoId, competencia, clienteNome: n.cliente, email: '',
      descricao: n.descricao || `Histórico da NFS-e ${nf}`, centavos: n.centavos, envioPrevisto: '', vencimento: '', nota: nf, boleto: '',
      demonstrativo: false, eventos: [], persistida: true, origem: 'historico-fiscal', competenciaConfirmada: false };
    if (!anterior) c.eventos.push({ id: `nfse-historico-${nf}`, tipo: 'documentos', data: n.emissao.slice(0, 10), registradoEm: em,
      responsavel: 'Sistema — consulta da Prefeitura', detalhe: 'Nota fiscal histórica importada. Vencimento, competência do serviço e envio não comprovados.' });
    c.eventos.push({ id: `recebido-titular-${empresa}-${nf}`, tipo: 'pagamento', data: '', registradoEm: em, responsavel,
      centavos: n.centavos - recebido, detalhe: 'Recebimento integral confirmado expressamente pelo titular na importação do histórico. Data efetiva desconhecida; não confirmado pelo banco. Não comprova pontualidade, envio ou pagamento de impostos.' });
    operacoes.push({ nota: nf, anterior: !!anterior, plano, cobranca: c });
    resumo[anterior ? 'atualizar' : 'criar']++; resumo.centavos += n.centavos - recebido;
  }
  if ([...excluir].some(n => !vistos.has(n))) throw Error('Nota atual excluída não encontrada no histórico completo.');
  return { operacoes, resumo };
}
