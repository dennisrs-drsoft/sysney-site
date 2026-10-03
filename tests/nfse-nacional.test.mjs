import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identificadorDps, NFSE_NACIONAL_SYSNEY, pendenciasNacionais } from '../lib/nfse-nacional.ts';
test('DPS possui prefixo, município, CNPJ, série e número com tamanhos nacionais', () => {
  assert.equal(identificadorDps('3550308','00000000000000','1','1'), 'DPS355030820000000000000000001000000000000001');
});
test('recusa valores inválidos e caminhos no identificador', () => {
  for (const numero of ['0','000','-1','1.2','../nfse','1234567890123456']) assert.throws(() => identificadorDps('3550308','00000000000000','1',numero));
});
test('preparação não desbloqueia produção e não altera DRSOFT', () => {
  assert.equal(NFSE_NACIONAL_SYSNEY.transmissaoHabilitada,false);
  assert.equal(NFSE_NACIONAL_SYSNEY.homologacaoConcluida,false);
  assert.equal(NFSE_NACIONAL_SYSNEY.emissaoPrevista,'2026-11-01');
  assert.equal(NFSE_NACIONAL_SYSNEY.vencimento,'2026-12-08');
  assert.match(pendenciasNacionais('drsoft')[0],/não configurada/);
});
