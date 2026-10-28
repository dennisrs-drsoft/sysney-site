# ATP — contingência fiscal com exclusão mútua

Pedido humano no chat “Retomar desenvolvimento ATP V2”: concluir contratação/recorrência e deixar nota não emitida na fila administrativa para emissão manual, upload de PDF e envio. A frente ATP implementa sua fila/interface/arquivo/e-mail. Esta frente SYSNEY fornece a confirmação durável que impede emissão automática concorrente. Nacional e cortesia da Casa Praia permanecem preservados; não ativar transmissão nesta entrega.

## Contrato draft.4

`POST /api/integracoes/atp/v1/solicitacoes-fiscais/{id}/assumir-manual`, mesmo Bearer exclusivo da integração. Corpo fechado:

```json
{"claimId":"identidade-estavel-da-operacao","externalReference":"ATP:referencia-do-pagamento","reason":"Motivo da contingência"}
```

Resposta200 contém `requestId`, `replayed`, projeção `request` usual e:

```json
{"manualControl":{"claimId":"identidade-estavel-da-operacao","externalReference":"ATP:referencia-do-pagamento","acknowledged":true,"automationPaused":true,"requestHash":"sha256-do-payload-original","acknowledgedAtUtc":"2026-10-28T12:00:00Z","controlFence":1,"protocolVersion":"1"}}
```

Exemplo de formato, não prova de operação em produção. `requestHash` é SHA256 do JSON canônico da preparação original: chaves ordenadas recursivamente, UTF8, sem espaços extras e escape conforme JSON.stringify. Confirmar também identidade/campos da solicitação, claimId e externalReference. A resposta de consulta normal não ganha campos novos; repetir o POST original consulta/reobtém a mesma confirmação durável.

Somente200 com ACK íntegro permite continuar a etapa manual no consumidor.503, timeout, corpo inválido ou ausência de resposta não são autorização. Repetir exatamente o mesmo claimId/payload; não gerar novo identificador a cada tentativa. Outro claim ou mesmo identificador com conteúdo diferente retorna409 `MANUAL_CLAIM_CONFLICT`; referência incompatível409 `IDEMPOTENCY_CONFLICT`.

Se já houver nota, estado incerto, estorno, intenção durável de transmissão ou ledger de envio:409 `MANUAL_RECONCILIATION_REQUIRED`. Não emitir nova nota. Preservar documento/resultado e consultar/revisar a tentativa. O sistema não declara uma nota inexistente por timeout nem apaga a tentativa para permitir outro envio.

## Garantia técnica

1. A reserva automática de dispatch e a tomada manual disputam **o mesmo ETag da mesma solicitação**, na mesma partição Table. Reserva e auditoria são transacionais. O dispatch ocorre antes do ledger e da fila.
2. Se manual vencer, controle persistente `mode=manual`, fence e ACK ficam gravados; automação não transmite e o agendamento não consegue sobrescrever a pausa. Não expira nem retorna automaticamente ao modo automático.
3. Se dispatch vencer, manual não recebe ACK. A solicitação pendente entra em revisão, conserva a intenção original e incrementa o fence. Ainda que a chamada já esteja em voo, o operador não é autorizado a emitir outra nota.
4. Worker verifica política/lease/fencing existentes e também reserva de dispatch, hash e fence do controle imediatamente antes do executor nativo. Payload sem permit não emite. Permissão Reader em AdminDocumentos é suficiente; nenhuma nova permissão Azure é necessária.
5. Ledger anterior à mudança também impede ACK, mesmo sem o novo campo de dispatch. Não se pressupõe ausência de envio porque o campo novo está ausente.

ACK confirma exclusão mútua técnica, **não aprovação fiscal de competência, data, descrição ou imposto**. Revisão pré-emissão sem nota/ledger/dispatch pode passar ao controle manual, preservando o aviso fiscal para conferência humana. Estorno e evidência/tentativa existente bloqueiam. Não há API para remover essa pausa ou apagar a reserva.

## Claim somente local no ATP

Pode ser feito sem criar solicitação remota apenas quando a transação local comprova que nunca reservou/despachou uma preparação: nenhum intent/attempt/outbox anterior, lease livre e fencing que impede replay futuro. `ProviderId=null` isoladamente não é prova; POST pode ter persistido remotamente antes de timeout. `FirstDispatchAtUtc` deve ser persistido **antes de qualquer HTTP**, e a regra deve abranger versões anteriores/dados migrados.

Havendo qualquer tentativa/dúvida, usar consulta por externalReference e claim remoto.404 após timeout não prova que não existe requisição em voo. O consumidor ATP é responsável por congelar sua preparação/outbox antes da chamada e exigir ACK antes da emissão/upload/envio manuais. Upload manual no ATP não se transforma artificialmente em XML autorizado ou `issued` na SYSNEY.

## Prontidão real em28/10

- API municipal/fila/executor/emissão/operador/automação/readiness desligados; timer Disabled. Preparação/consulta existentes continuam disponíveis.
- DRServer: tarefa `SYSNEY-ATP-Municipal-Isolado` Disabled, configpausedtrue, allowFiscalCalls/issuance/automation/nationalfalse. SDK/identidade gerenciada reais leram fila0/preparações0, sem writes/transmissão.
- Certificado vinculado ao emitenteSYSNEY, válido na data, chave privada acessível pelo contextoSYSTEM. Desafio local RSA/SHA256 foi assinado/verificado sem exportar chave e sem XML ou chamada fiscal. Vencimento10/11/2026,22:39:49UTC.
- A linha `AdminConfiguracoes / atp-municipal-automation / sysney-v1` **não existe**. Não há política global versionada/aprovada persistida para ativação automática. Perfil municipal anteriormente testado não substitui aprovação de série exclusiva/corte/notBefore/perfil. Nenhuma política foi inventada ou ativada.
- Novembro e nacional continuam bloqueados. A contingência manual não altera essas regras do emissor automático nem presume orientação contábil.

## Validação do candidato

-20/20 testes direcionados de automação/worker/claim/SDK municipal;5/5 de contingência, incluindo quatro corridas HTTP entre claim e dispatch com SDK Azure/Azurite real e governo stand-in local.
- Timeout depois de commit recuperado, replay estável, claim divergente, referência incorreta, Bearer/payload, ledger legado, issued, estorno, retorno sem ACK e preservação do GET testados. Resposta real do handler validada com Ajv contra o OpenAPI.
-229/229 na regressão Node completa, zero falhas/skips. BuildNext16.4.3/Turbopack/TypeScript e API/runner aprovados. Dependências físicas do checkoutQA usadas sem modificar os node_modules compartilhados.
- Audit de produção: raiz/API zero altos/críticos; raiz4baixos/3moderados e API3moderados transitivos. Não alegar ausência total de vulnerabilidades.

Todos os ensaios usam identidades/arquivos sintéticos e endpoints loopback. Nenhuma nota fictícia oficial, TesteEnvio, emissão nacional, cobrança ou e-mail real. Segredos, certificados, PDF/XML, scripts operacionais e artefatos ficam fora do Git. Hashes/publicação/provas finais serão registrados após implantação pausada.
