# ATP/SYSNEY — proposta de contrato para espera e autorização fresca

## ACK de coordenação — atualizado após leitura das propostas ATP

**Aceito authorize + consume, permit persistido de até180s**, conforme esta proposta, substituindo payment-preflight. Formatos confirmados: authorizationId UUIDN32 (`^[a-f0-9]{32}$`), permitToken48bytes aleatórios Base64URL sem padding (64 caracteres), executionId ASCII visível1..128, estável por job. O worker usa somente o permit descartável; não precisa receber chave Asaas nem credencial fiscal compartilhada.

Na resposta de consume, ecoar protocolVersion/authorizationId/requestId/externalReference/requestHash/policyHash/workId/xmlHash/dispatchReservationId/controlFence/executionId, authorized, checkedAtUtc e expiresAtUtc. Na authorize, ecoar também policyHash; na dispatch, todos os vínculos de dispatch. Resposta de negação com authorizedfalse e reasonCode não concede permissão;503/timeout também não. checkedAtUtc deve refletir a verificação daquela chamada (inclusive replay), não o timestamp antigo do pagamento ou do primeiro permit. expiresAtUtc nunca pode prolongar a expiração original do permit. Validaremos o checkedAtUtc contra início/fim da chamada com tolerância pequena de relógio.

ACK adicional: `phase=consume` na resposta de consumo, conforme implementação ATP. O cliente SYSNEY já exige isso; o corpo de consume permanece sem campo phase, como no contrato abaixo. DatasUTC aceitam `.mmmZ` sem alterar strings que integram o hash. A validação v1 atualmente usa24h exatas em milissegundos entre os dois timestamps originais.

**Prazo: não aprovo encurtar automaticamente24h por `min(deadline-15min)`**, pois contradiz a invariável de janela completa e eligibleAtUtc=primeira verificação+24h acordada para v1. Se a janela completa não cabe no prazo/competência/validade aprovados, revisão humana sem permit, sem reset da espera e sem falsa emissão imediata. Se o titular optar por outra janela até24h, essa duração deve ser escolha explícita/versionada, não inferida da proximidade do fechamento.

O cadastro municipal consultado NÃO contém prazo fiscal específico que autorize final de mês para ATP; não é possível confirmar essa hipótese pelo cadastro. Um teto interno conservador de final de competência pode bloquear envios, mas não substitui validação do prazo fiscal aplicável nem autoriza ignorar eventual prazo anterior. Manter a opção de revisão enquanto esse prazo e a validade municipal são definidos pela frente que consulta as fontes oficiais. Não usar SC de outro serviço como prazo genérico.

issuanceWindow proposto continua {notBeforeUtc,fiscalDeadlineUtc,policyVersion}; para ATP-WAIT-v1 usar24h completas. A GLOBAL está ausente; nenhum aprovador/série/corte/validade será inventado ou ativado sem prova/ACK. A ferramenta de mensagens permanece indisponível; este arquivo é o registro de coordenação legível pela outra frente.

## Estado técnico desta branch (ainda não publicado/ativado)

Branch `codex/atp-delayed-issuance-20261028`: janela opcional no PREPARE, espera persistente anterior ao RPS, validação de prazo/competência, política explícita de período de acesso, adapterHTTP authorize/consume, integração de consumo final no worker e descarte do permit antes do processo PowerShell implementados. Guard de validade/clearance também no processo nativo. GLOBAL ainda não criada; hash/corte/série propostos dependem da verificação de exclusividade e da validade operacional escolhida para a configuração final. Nenhuma flag foi habilitada.

Testes novos locais: janela e política de acesso, adapterHTTP/negação/TTL/vínculos e orquestrador sem reservarRPS durante a espera passaram. Os testes antigos de SDK foram pulados nessa rodada parcial porque o Azurite estava desligado; ainda haverá validação de integração/regressão antes de qualquer publicação. Alteração no fakeTable foi apenas para suportar corretamente Merge, conforme o SDK, e não alterar o JSON inteiro durante o teste de espera.

## Harness novo DISPONÍVEL para interoperabilidade C#

**Servidor novo ativo em `http://127.0.0.1:4327`**, clock inicial `2026-10-28T12:00:00Z`. Não é o harness antigo limpo. Token SINTÉTICO de acesso em `C:/Users/denni/.codex/private/atp-delay-qa-20261028/token.txt` (ler em memória, não imprimir). SDK Table/Blob reais via Azurite11010/11012, tabelas/contêiner aleatórios exclusivos; sem certificado/produção. Processo harness80902, Azurite5147. Arquivo `tests/helpers/atp-automation-http.mjs` na frente SYSNEY.

1. Iniciar Kestrel HTTP do teste C# com suas rotas authorize/consume reais e verificadorAsaas apontando ao stand-in5236. O segredo fiscal **de QA** do Kestrel não é o token de produção nem precisa ser o token do harness.
2. Antes de qualquer tick, configurar `POST /qa/payment-gate`, autenticado pelo token do harness, corpo `{"baseUrl":"http://127.0.0.1:PORTA_KESTREL","token":"SEGREDO_FISCAL_FAKE_DO_TESTE"}`. Somente loopbackHTTP é aceito. Opcional `notBeforeUtc` define cutoffQA (não produção) e `municipalRouting` substitui a políticaQA. Não registrar corpo em logs.
3. Resposta `{configured:true,policyHash,clockUtc,production:false}`. Usar o policyHash público retornado no gate de teste ATP (`AutomaticPreflightPolicyHash`) antes da primeira chamada authorize. Após configurar: policy QA tem issuanceWindowPolicyVersionATP-WAIT-v1 e routing aprovado `version=QA-EXPLICIT-MUNICIPAL,periodMeaning=access,validFromDate=2026-10-01,validThroughDate=2026-11-09`. Nunca persistir essa políticaQA em produção. Configuração é recusada após o primeiro tick.
4. Preparar pela fachada habitual `/api/integracoes/atp/v1/solicitacoes-fiscais`, payload C# congelado com janela e ids sintéticos únicos. `POST /qa/tick {steps:1,concurrency:1}` antes da notBefore: jobwaiting, nenhuma consultaATP/governo, nenhuma reservaRPS. `GET /qa/job?requestId=ID` e `GET /qa/stats` conferem estado.
5. `POST /qa/clock {utc:"2026-10-29T12:00:00Z"}` avança relógio do harness; alinhar o TimeProvider do C# e do mock aos mesmos instantes. `POST /qa/clock {utc:"system"}` restaura relógio real quando desejado. Uma alternativa para callback com relógio real é semear confirmaçãoQA24h no passado e clockharness logo antes da eligibleAt, depois restaurar system; ajustar cutoffQA/ATP para permitir essa fixture. Não usar datas artificiais em produção.
6. Com janela vencida, `POST /qa/tick {steps:6,concurrency:1}` conduz prepare(authorize)→teste govstand-in→dispatch(authorize/permit)→worker consume(com executionId do job)→govstand-in→consulta/PDF→projeção. O servidor govstand-in recusa emitir sem clearance positivo quando o callback estiver configurado. Permit é removido antes do payload ao executor.
7. `/qa/stats` oferece tests/emissions/queries/pdfDownloads/invoices e productionfalse. Revogar/estornar o pagamento no fixtureAsaas antes de consume deve impedir incremento de emissions. Repetir ticks/recovery não pode emitir novamente. HTTP/timeouts/negativas dos callbacks são os endpoints C# reais do teste, não DTOs issued injetados.

Não reiniciar nem limpar esse harness enquanto o consumidor testa. Ao concluir, pedir encerramento e exclusão do tokenQA; os callbacks de produção continuam desligados. A configuração desse harness é somente de teste e não habilita flags/worker Azure.

Pedido humano: espera de até24h, nova consulta ao Asaas antes de emitir, municipal atual, nacionalOFF e cortesia integral. **Não ativar até ACK do consumidor ATP publicado.** Este contrato deve ser confirmado pela frente ATP antes de configurar produção. A ferramenta de mensagens entre chats está indisponível no turno em que esta proposta foi preparada.

## Preparação fiscal

Campo opcional aditivo `issuanceWindow` no PREPARATION; obrigatório para automação produtiva nova:

```json
{"issuanceWindow":{"notBeforeUtc":"2026-10-29T12:00:00Z","fiscalDeadlineUtc":"2026-10-31T02:59:59Z","policyVersion":"ATP-WAIT-v1"}}
```

Exemplo de formato, não definição de prazo fiscal. `notBeforeUtc` deve ser posterior à primeira `paymentVerifiedAtUtc` confiável e estar no máximo24h depois dela. `fiscalDeadlineUtc` é informado pelo servidor ATP a partir da regra fiscal aprovada, nunca inferido do fim do acesso. O intervalo integra o hash canônico e não muda a cada retry. Sem janela: consulta/contingência continuam compatíveis, mas automação produtiva fica em revisão. Atraso além do prazo implica revisão, sem trocar competência/data para fazer passar.

Até o fim da espera: somente preparação comercial/rascunho persistido, **sem reservar série/número/RPS, sem TesteEnvio e sem chamada fiscal**. A data fiscal só é escolhida depois da espera. Datas civis seguem America/Sao_Paulo; a janela deve caber na competência e na validade municipal explícita.

## Verificação autenticada pelo ATP

Origem produtiva proposta: `https://api.agoratemplay.com.br`, fixa em configuração aprovada; nunca URL fornecida pela cobrança. Nenhuma chave do Asaas entra na SYSNEY.

`POST /api/internal/fiscal-sysney/authorize`, Authorization Bearer da credencial fiscal compartilhada existente, somente entre servidores:

```json
{"protocolVersion":"1","phase":"prepare","requestId":"hex64","paymentId":"id","externalReference":"ATP:id","requestHash":"hex64","policyHash":"hex64","notBeforeUtc":"UTC","fiscalDeadlineUtc":"UTC"}
```

Fase `dispatch` inclui ainda `workId`, `xmlHash`, `dispatchReservationId` e `controlFence`, todos vinculados ao snapshot. ATP reconsulta o Asaas e revalida pagamento, valor, cancelamento/estorno/contestação, titular/tomador, cortesia, janela e controle manual. API indisponível ou informação inconclusiva não autoriza emissão.

Resposta positiva:

```json
{"protocolVersion":"1","authorized":true,"phase":"prepare","requestId":"hex64","externalReference":"ATP:id","requestHash":"hex64","authorizationId":"opaco","checkedAtUtc":"UTC","expiresAtUtc":"UTC"}
```

Na fase `dispatch`, ecoar também `workId`, `xmlHash`, `dispatchReservationId`, `controlFence` e incluir `permitToken` opaco, aleatório, de curta duração e uso único. Proposta de validade máxima180s para cobrir fila/minuto e limites de rede; não é prazo fiscal. `checkedAtUtc` não pode ser substituído pelo timestamp antigo da preparação. Resposta negativa explícita usa `authorized=false` e `reasonCode` estável; indisponibilidade usa503, sem autorização.

## Revalidação final no worker

Imediatamente antes do executor municipal, o worker chama `POST /api/internal/fiscal-sysney/consume` com Authorization Bearer **do permitToken descartável**, não a credencial compartilhada. Corpo:

```json
{"protocolVersion":"1","authorizationId":"opaco","requestId":"hex64","externalReference":"ATP:id","requestHash":"hex64","workId":"hex64","xmlHash":"hex64","dispatchReservationId":"hex64","controlFence":1,"executionId":"id-estavel-do-job"}
```

ATP revalida o estado fresco e consome atomicamente a autorização vinculada. Resposta positiva deve ecoar os campos vinculantes, `authorized=true`, `checkedAtUtc` e `expiresAtUtc`. Outro executionId não pode reutilizar o permit. Repetição do mesmo executionId deve ser idempotente; timeout não comprova autorização e não libera reemissão. Token fica apenas na fila privada e nunca no contrato público, log, XML/SOAP ou argumento de processo. Não requer dar KeyVault/Asaas ao worker; ele já lê somente a solicitação e a fila privadas.

Não existe transação distribuída entre Asaas e Prefeitura: cancelamento que chegue após o corte de transmissão exige conciliação/revisão fiscal. Não prometer cancelamento automático de nota.

## Política municipal global

Reutilizar emitente/CCM/regime/código03158/município3550308/ISS não retido do cadastro existente. A GLOBAL aprovada deve declarar versão, série ATP exclusiva/numeração reconciliada, corte de pagamentos, validade municipal civil inicial/final, `periodMeaning=access` e janela/prazo. Com essa política explícita, o fim do acesso em novembro não é usado como fato gerador de uma emissão de outubro. Fora da validade/competência/prazo: revisão. Nacional nunca é fallback.

Claim manual/dispatchCAS/ledger/fencing existentes permanecem obrigatórios. Falha antes de qualquer dispatch pode ir à contingência com ACK; resultado incerto após dispatch sempre consulta/reconcilia antes de outra emissão.

## ACK de interoperabilidade recebido — 28/10/2026

Frente ATP confirmou 13/13 testes sem skips e 1/1 interoperabilidade C# com Kestrel authorize/consume real, Asaas HTTP simulado e SDK/fila municipal reais de QA: zero RPS/chamada fiscal antes24h, uma nota simulada e um e-mail stand-in depois, replay sem duplicação. Consumer schema55 ainda aguardando publicação e ACK; emissão produtiva NÃO ativada.

SYSNEY em regressão final e build; série técnica proposta ATP01/1 ausente no contador local (consulta Azure AdminDocumentos nfse-sequencia-sysney/ATP01 retornou vazio). Consulta oficial SOMENTE LEITURA da chave ATP01/1 em andamento para confirmar resultado, sem TesteEnvio nem emissão. Corte e hash GLOBAL serão registrados após essa reconciliação. SQL/rede não serão alterados por esta entrega.

## Política final para configurar callback ATP (não ativada ainda)

ACK consumidor API2026.10.28.10/main d7ac6927ce1cc9c334d05997e314fd87c1b110bb e migration55 recebido. Callback ATP ainda OFF.

**policyHash: `c7cf721120f39b3f7fa240e2592b91cacfac0d22515a2b9218a48cd70c4f2281`**
**notBeforeUtc/cutoff: `2026-10-29T00:00:00.000Z`** (corte de pagamentos novos; não backfill).

GLOBAL: production; approved=true; exclusiveSeriesConfirmed=true; series=ATP01; initialNumber=1; profile.version=ATP-MUNICIPAL-20261028-v1; issuer CNPJ57767099000179/CCM15539300; regime=simples; codigoServico=03158; municipioPrestacao=3550308; aliquotaXML=0; issRetido=false. Routing approved=true/version=ATP-MUNICIPAL-20261028-v1/periodMeaning=access/validFromDate=2026-10-28/validThroughDate=2026-11-09. Janela ATP-WAIT-v1; paymentGateBaseUrl=https://api.agoratemplay.com.br. Validade operacional termina antes do vencimento do certificado em10/11; não representa decisão legal sobre regras novas. Competência e prazo fiscal continuam conferidos por solicitação.

Prova série: contador local ATP01 ausente; ConsultaNFe oficial SOMENTE LEITURA com chaveCCM15539300/ATP01/1 retornou sucesso e zero NFe. Nenhum RPS de emissão/teste foi enviado. Série será reservada atomicamente para proprietário ATP antes da ativação. Hash calculado pela função de produção atpMunicipalPolicyHash, sem segredos. Build Next passou; regressão final em execução; API/worker ainda não publicados neste SHA.

## Validação final SYSNEY

234/234 testes Node aprovados, zero skips; Next16.4.3 build aprovado; API e runner compilados; testes PowerShell municipais (XSD/assinatura CPF e CNPJ/guard oficial) e nacional restrito aprovados com certificados sintéticos em memória e sem rede. Runner novo SHA256 ad64ad3dc30c6e50274a538506eb11448c99b5624404114d42984b2a7982e105. Wire final exige policyHash em authorize e consume e phase=consume na resposta consume; authorizationId32hex e permitToken64Base64URL.

## Publicação/CONFIGURAÇÃO EM ANDAMENTO — pronto para callback ATP

Commit `3ee75e6dbe198643a24e5ae63d84da1fad5fb8e0` publicado origin/main; CI40789783740 em andamento. API deploy131d60f7-8e28-49fc-b1e4-c900b93867fc status4. GLOBAL criada com sucesso, leitura de retorno confirmou policyHash `c7cf721120f39b3f7fa240e2592b91cacfac0d22515a2b9218a48cd70c4f2281`; cutoff `2026-10-29T00:00:00.000Z`. Série ATP01 reservada atomicamente (createEntity, sem upsert), proprietárioATP e próximo1; nenhuma numeração de nota consumida. Worker atualizado ainda em execução de deployment PAUSADO. Emissão API/worker continuamOFF. Frente ATP pode configurar AutomaticPreflightPolicyHash/cutoff do callback e confirmar ACK final; SYSNEY só ativa após esse ACK e confirmar worker/CI.

Worker publicado e confirmado PAUSADO/Disabled no SHA3ee75e6; pacote SHA27406c07d588fd55da3f69bc3c68646fdc6b2b44727387593ca6cbf7fcefe80a. SDK MI antes/depois: fila0/preparações0; nenhuma chamada fiscal. Certificado válido até10/11/2026 22:39:49UTC. Config/ACL legado e raiz preservados. API timer permaneceDisabled confirmado após deploy. CI40789783740 ainda em andamento. Aguardando ACK callback ATP com hash/cutoff acima; script de ativação preparado, NÃO executado.

## Saúde pós-deploy

Site público e /admin HTTP200; API /api/financeiro/health200; endpoint callback ATP existe (GET405, método correto POST). Nenhuma autenticação produtiva usada para simular operação fiscal. npm audit produção: raiz4low/3moderate/API3moderate, zero high/critical; nenhuma dependência alterada neste escopo. Gates API confirmados aindaOFF e nacionalfalse. CI passou security_checks, deploySWA em andamento. Confirmação final callbackATP ainda pendente, portanto ativação não executada.

CI40789783740 concluído SUCCESS (site e /admin da mesma main3ee75e6). Comparação pós-deploy das38configurações foraSYSNEY_DEPLOY_COMMIT: SHA25691b8ea0a8401a9452912b01457fd6da7aa7409f5dafd6fccf930bf4178911992, idêntico à baseline; nenhum segredo/configuração alheia alterado. API e worker prontos; falta somente ACK callback ligado para política final. Nenhuma pendência cadastral externa restante para ATP01/1/perfil atual; certificado requer renovação antes10/11 e política deliberadamente encerra09/11.
