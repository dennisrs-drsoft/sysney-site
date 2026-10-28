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

Todos os ensaios usam identidades/arquivos sintéticos e endpoints loopback. Nenhuma nota fictícia oficial, TesteEnvio, emissão nacional, cobrança ou e-mail real. Segredos, certificados, PDF/XML, scripts operacionais e artefatos ficam fora do Git.

## Implantação pausada

Fonte `2eee6bf9740d0786c005712d2d98a4a6866bfac0`, branch `codex/atp-manual-control-20261028`, integrada emmain após229 testes/builds aprovados. [CI40727498239](https://github.com/dennisrs-drsoft/sysney-site/actions/runs/40727498239) **SUCCESS**, incluindo segurança/build/deploy; a frente institucional confirmou ausência de deploy concorrente.

- API `sysney-admin-api-2602`, grupo `sysney`: pacote ZIP SHA256 `ace6aaf11758adc4d2f9aaa8e8fa8ee445f9d96ba9f3be947802c136db8f8c8d`, publicação com build remoto concluída e marcador de fonte2eee6bf. Triggers sincronizados; ARM confirmou `atp-fiscal-manual` ativo e `atp_municipal_automation` Disabled.
-38 configurações preexistentes, excluindo somente marcador de release, permaneceram idênticas: SHA256 `91b8ea0a8401a9452912b01457fd6da7aa7409f5dafd6fccf930bf4178911992`. Inter/SendGrid/KeyVault e demais rotinas não foram reconfigurados.
-`ATP_FISCAL_V1_ENABLED=true` para preparar/consultar/assumir manualmente; `ATP_FISCAL_LINK_ENABLED=false`. Todos `ATP_MUNICIPAL_AUTOMATION_ENABLED`, `ATP_MUNICIPAL_QUEUE_ENABLED`, `ATP_MUNICIPAL_EXECUTOR_ENABLED`, `ATP_MUNICIPAL_ISSUANCE_ENABLED`, `ATP_MUNICIPAL_OPERATOR_ENABLED`, `ATP_MUNICIPAL_READINESS_ENABLED` e `SYSNEY_ALLOW_NATIONAL_RESTRICTED_SEND` false. `AzureWebJobs.atp_municipal_automation.Disabled=true`.
-Health200, fachada semBearer401, POST de controle manual semBearer401. Nenhuma solicitação fictícia em produção para testar o novo controle.
-Smoke após CI: home/contato200, administração e ponte privada anônimas302 para autenticação. Isso não comprova sessão administradora real nem envio de e-mail; nenhum envio foi usado como teste.
-Worker DRServer na release `C:\ProgramData\SYSNEY\AtpMunicipal\releases\2eee6bf9740d0786c005712d2d98a4a6866bfac0`; ZIP SHA256 `9f9704fd04c0792f440dacf1a24302d426c8d502d743024fb122abefbcff4cf3`; runner SHA256 `43707481898dcaf056014673b56090e381b8793a3d137046ecf1beb064a883a2`.
-Readiness real antes/depois: fila0/preparações0/storageWritesfalse/transmittedfalse; `installed_paused`, tarefaDisabled, pausa ativa e todos gates do workerfalse. Hash/ACL da configuração fiscal legada e ACL da raizATP idênticos; nenhum grantRBAC, SQL, firewall ou certificado alterado. Backup privado da configuração anterior preservado.

O consumidor ATP possui seu próprio ciclo de validação/publicação, documentado naquela frente. Este relatório não afirma que vendas/e-mailsATP foram ativados. Automação municipal não foi liberada: política global ausente e alinhamento fiscal/novembro continuam explícitos; a contingência manual é o caminho preparado para seguir com a operação.

## ACK do consumidor e encerramento do QA

O chatATP confirmou5/5 testes, zero skips:4SQL/HTTP e1C# interoperável contra a fachada4327. Contadores do arquivo privado `.qa/manual-fiscal-20261028/manual-protocol.trx` foram lidos e conferidos nesta frente: total/executados/aprovados5, falhas/nãoexecutados0. Teste interoperável em `tests/AgoraTemPlay.Api.Tests/FiscalManualHarnessTests.cs`, no repositórioATP.

O ensaio fez PREPARE sintético e perdeu a resposta no cliente **após ACK200 remoto real**. Sem ACK no consumidor, retry com o mesmo claimId recuperou hash/fence/confirmação iguais; replay manteve a identidade. Outro claim409 e revisão de estorno409 bloqueados. Canonicalização de Unicode/acentos/HTML/ampersand coincidiu entre C# e JavaScript. O consumidor declarou nenhuma chamada governamental nesse ensaio; o harness é vinculado somente a endpoints loopback.

Após autorização de limpeza do consumidor: harness4327, Postman5239 e Azurite11010/11011/11012 próprios encerrados; teste TCP confirmou todas essas portas sem listener. Token **sintético** temporário removido, ausência confirmada. Nenhuma configuração, credencial ou serviço de produção foi tocado nesta conclusão. Nenhum token de produção foi recuperado localmente.

A exclusão recursiva da pasta de dados sintéticos do Azurite foi bloqueada pela revisão automática, sem razão específica além de política. A pasta foi preservada; não houve tentativa alternativa de contornar esse bloqueio. Ela não contém credenciais de produção. Relatórios de teste e hashes operacionais foram mantidos fora do Git para rastreabilidade. Não há pendência de execução ou credencial do harness; apenas esses dados locais sintéticos permanecem em disco.
