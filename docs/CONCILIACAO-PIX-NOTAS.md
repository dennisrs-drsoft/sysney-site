# Conciliação PIX e vínculo fiscal — SYSNEY

## PIX direto

A consulta de boletos não identifica PIX avulso. O servidor agora também consulta o extrato enriquecido dos últimos 90 dias, limitado a cinco páginas de 100 transações por execução. Somente créditos PIX com identificador end-to-end, CPF/CNPJ do pagador, data e valor válidos são armazenados; débitos e descrições de devolução/estorno não geram baixa. Extrato incompleto não executa conciliação automática.

Em **Acompanhamento e recorrências → Acompanhar**, cobranças SYSNEY persistidas e sem boleto exibem **Conciliação PIX**. O e-mail vinculado precisa usar a forma de pagamento PIX.

1. Confira o CPF/CNPJ do cliente, valor integral e período esperado (até 90 dias).
2. Salve a regra com ou sem autorização de baixa automática. A autorização é individual por cobrança, não se propaga às próximas mensalidades.
3. A consulta periódica existente de 15 minutos cruza CNPJ/CPF, valor e período. Só baixa quando houver exatamente um recebimento para a cobrança e exatamente uma cobrança elegível para o recebimento. Pagamentos parciais, outro pagador ou duplicidade exigem revisão.
4. Se houver mais de uma possibilidade, selecione o recebimento e confirme o vínculo em modal. O botão atualiza recebimentos já consultados; a consulta bancária pode ser solicitada na Visão geral.

Reservas da transação, cobrança e versão da regra são gravadas atomicamente na mesma partição `pix-conciliacao-sysney`. Campos da cobrança e documento atual do cliente são validados novamente na projeção do pagamento; alterações incompatíveis não produzem baixa. Pagamentos e estornos manuais existentes são preservados, sem soma em duplicidade. Correção de registro no acompanhamento não devolve dinheiro no banco. Vínculo bancário reservado não é reutilizado silenciosamente depois de uma correção.

Limites: não gera QR Code/TxId dedicado, não recebe webhook, não automatiza PIX parcial nem devoluções posteriores. Uma devolução efetiva deve ser conferida e corrigida manualmente no acompanhamento. Pagamentos anteriores à janela consultada requerem importação separada. Não presume pagamento por nome, chave da empresa ou envio do e-mail.

## Notas históricas

O cruzamento exige uma referência explícita da nota (`seuNumero` numérico ou referência registrada pelo próprio fluxo da cobrança), documento do cliente, valor integral e data fiscal compatíveis. A nota deve estar ativa e o boleto não cancelado/expirado. Nota/boletos repetidos ou parcelamentos não são vinculados automaticamente.

O vínculo é gravado como metadado `nfseVinculo` no snapshot do Inter, com critério, data e responsável. PDFs/XML permanecem privados, em sua localização original. Cancelamento posterior de uma nota invalida sua exibição como associação ativa. A carteira recebe o número e a data fiscal; isso não altera o recebimento bancário, competência, tributação, aprovação de e-mail ou documentos emitidos.

O timer repete o cruzamento depois da sincronização. O botão **Vincular notas ao histórico**, na Visão geral, permite repetir apenas a conciliação fiscal mediante confirmação.

## Execução autorizada em 08/10/2026

- 57 snapshots bancários e 52 notas históricas avaliados.
- 28 vínculos seguros gravados, incluindo a NFS-e 48 da Devanlay. Segunda execução deve ser idempotente.
- 29 registros preservados sem associação automática, incluindo cancelados, expirados, parcelamentos e referências divergentes.
- Extrato real consultado: 8 créditos PIX identificáveis; nenhuma baixa executada e nenhuma regra automática ativada implicitamente.
- Nenhuma emissão fiscal/bancária, cancelamento ou envio de e-mail realizado para validar esta alteração.

Publicação autorizada separadamente pelo usuário nesta conversa. Registrar a confirmação da release após verificar a implantação, sem confundir build local com publicação.
