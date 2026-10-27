# Implantação técnica ATP/SYSNEY — 27/10/2026

Autorização humana: configurar a integração, aplicar a migração 49 no ATP e implantar o worker, preservando vendas desligadas, emissor nacional desligado e cortesia da Casa Praia. O chat ATP cuida de seus recursos/migração; esta frente cuida exclusivamente da API SYSNEY e da DRServer. Não emitir documentos, transmitir teste fiscal, enviar e-mail ou reprocessar histórico nesta implantação.

## Recursos e fronteiras

- Function App existente `sysney-admin-api-2602`, grupo `sysney`: base do consumidor `https://sysney-admin-api-2602.azurewebsites.net`. Fachada dedicada em `/api/integracoes/atp/v1/solicitacoes-fiscais`.
- Preparação/idempotência, consulta, revisão de estorno e documentos privados; a capacidade pública continua `automaticIssuance=false`, `nationalAdapterReady=false`, `emailHandledBy=ATP`.
- Key Vault existente `sysney-admin-kv-2602`: segredo exclusivo `atp-fiscal-v1-production-20261027`, gerado aleatoriamente, carregado pela identidade gerenciada existente da API. Nenhum fallback para chave administrativa. Valor nunca incluído neste relatório, no chat ou em commit.
- Armazenamento existente `sysneyadm2602`: orquestrador usa `AdminDocumentos`/`admin-anexos`; worker usa somente partição ATP de `FiscalFila`. API já tem Table/Blob Contributor e Secrets User; VM já tem Table Contributor apenas em `FiscalFila`, além de leitura em `AdminDocumentos`. Nenhum novo grant é necessário.
- DRServer, grupo `DEVELOPER`: worker isolado em `C:\ProgramData\SYSNEY\AtpMunicipal\releases\<commit>`, configuração separada em `C:\ProgramData\SYSNEY\AtpMunicipal\config.json`, tarefa nova `SYSNEY-ATP-Municipal-Isolado`, inicialmente **Disabled**. Não alterar tarefas, certificados/ACL ou configuração legados.

## Estado pretendido da implantação

`ATP_FISCAL_V1_ENABLED=true` habilita somente a fachada de preparação autenticada. `ATP_FISCAL_LINK_ENABLED`, `ATP_MUNICIPAL_QUEUE_ENABLED`, `ATP_MUNICIPAL_EXECUTOR_ENABLED` e `ATP_MUNICIPAL_ISSUANCE_ENABLED` permanecem false. `SYSNEY_ALLOW_NATIONAL_RESTRICTED_SEND=false`; nenhum emissor nacional foi registrado/ativado. Não modificar os gates municipais legados usados pelos clientes atuais.

O worker novo exige `paused=false` **e** autorização de chamadas fiscais antes de consumir fila; ambos permanecem bloqueados nesta implantação. A tarefa também fica desabilitada. O bootstrap verifica hashes do runner/runtime e assinatura Authenticode do Node portátil existente; não instala Node global ou serviço. Quando futuramente autorizado a executar, seus gates são exclusivamente do processo, restaurados em `finally`; este bootstrap mantém emissão false.

Troca do token por arquivo temporário local em diretório novo com ACL restrita a Dennis/SYSTEM; o consumidor ATP deve confirmar gravação/validação antes de excluir a cópia. Nenhuma chave privada de certificado é exportada. A configuração protegida do worker não contém token ATP.

## Verificações e encerramento

A implantação deve comprovar GET sem credencial recusado, GET de ID inexistente com Bearer correto retornando 404, sem criar preparação/nota/cliente; verificação de tarefa Disabled, flags pausadas, hashes e configuração legada preservada. Não usar POST fiscal ou e-mail como smoke test. Resultados e hashes efetivos serão registrados após publicação. O ensaio oficial não emissor anterior permanece documentado em `ATP-FISCAL-V1.md`; não será repetido.

## Pré-publicação validada

O preflight detectou advisories altos/crítico novos que impediam o job `security_checks` do workflow. Foram atualizados Next.js/third-parties/eslint-config-next para 16.4.3 e Undici para 8.12.3. Azure Identity foi fixado em 4.13.0, mantendo a API compatível com o ramo MSAL 3, fora do advisory alto observado nos ramos 5–7.0.2. Não foi aplicado `audit fix --force` nem override de major do MSAL. Auditoria de produção da raiz e da API: **zero altos/críticos**, com três moderados transitivos na cadeia UUID/MSAL/Identity ainda registrados; não há afirmação de ausência total de vulnerabilidades.

A validação utilizou o checkout físico isolado `C:\Users\denni\sysney-atp-release-qa`, com `npm ci --ignore-scripts` na raiz e na API. O `node_modules` compartilhado com a outra frente não foi alterado. `next build` padrão com Turbopack 16.4.3 passou, incluindo TypeScript; 89/89 testes passaram, zero skips, após gerar os handlers da API. Smoke local GET: home, contato, admin, sitemap e robots 200; admin com noindex; endpoint administrativo anônimo 401. Nenhum formulário foi enviado.

Runner municipal recompilado com as dependências corrigidas e modo de readiness somente leitura, para comprovar SDK/identidade gerenciada sem consumir fila, assinar ou transmitir. SHA-256 local `db609aa518d23455f27632a83093bbb7be4270c7b6ff3b1f76cc82cd56f730c1`, 1.804.195 bytes. Dry-run confirmou chamadas e emissões desligadas. A publicação da API preservará as configurações Inter/SendGrid e alterará somente os nomes/gates ATP descritos acima.
