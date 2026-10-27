# ATP — automação municipal preparada, execução real desligada

## Escopo e limites

Pedido humano no chat ATP: concluir pagamento confirmado → emissão municipal → documentos → e-mail, preservando vendas desligadas, nacional desligado e cortesia integral da Casa Praia. Esta frente implementa somente SYSNEY. O consumidor, outbox e envio ATP pertencem ao chat “Retomar desenvolvimento ATP V2”.

Nenhuma nota, cobrança, e-mail, TesteEnvio ou chamada fiscal oficial integra esta validação. Não há backfill. Novembro continua exigindo revisão: não foi alterada a regra de competência/data do fato gerador para acomodar testes.

## Execução privada

- Timer privado `atp_municipal_automation` e runtime retornam antes de credenciais/storage se automação, emissão ou fila não estiverem explicitamente habilitados. A implantação mantém todos esses gates false e o timer Disabled. O nome usa sublinhados para permitir o app setting `AzureWebJobs.atp_municipal_automation.Disabled` no Azure.
- A política versionada protegida fica em `AdminConfiguracoes`, partição `atp-municipal-automation`, linha `sysney-v1`. Exige aprovação global, perfil fiscal, série ATP exclusiva, semente inicial e `notBeforeUtc` explícito. Não é criada nem aprovada implicitamente pelo deploy. Não há aprovação humana por nota quando uma política válida estiver futuramente ativada.
- Varredura somente de solicitações novas com metadados elegíveis, sem inferir pagamentos antigos. Checkpoints e próxima tentativa persistidos evitam monopolizar a primeira página com documentos concluídos ou falhas transitórias.
- Lease por solicitação, claim único e fencing monotônico; ETag controla disputa. Snapshot e política divergentes exigem revisão. Fila e ledger reservados antes da transmissão; timeout não libera novo envio do mesmo RPS: consulta/recuperação são o caminho de retomada.
- O worker relê política, solicitação, revisão de estorno, provenance, XML/hash e fence imediatamente antes da execução nativa. Não confia apenas no payload enfileirado. Configuração local pausada, gates próprios, tarefa Disabled e hashes do runner/runtime continuam sendo barreiras independentes.
- Cancelamento oficial ou mudança de identidade retornada pela consulta revogam disponibilidade pública: `reviewStatus=fiscal_review_required`, documentos pending, GET de documento409. Número histórico permanece preservado; não se inventa reembolso nem se cancela nota automaticamente.
- PDF pode chegar depois do XML; nova consulta/anexação preserva o XML e a emissão original. Falha de download não autoriza reemitir.

## Contrato draft.3

`capabilities.automaticIssuance=false` continua significando que o chamador Bearer só prepara/consulta. Ele não recebe rota de emissão. Automação é responsabilidade privada do servidor. O consumidor ATP foi ajustado para reconhecer `fiscal_review_required` sem chamar indevidamente a API de estorno.

## PDF municipal

Leitura offline do PDF49 existente confirmou uma página, fontes TrueType WinAnsi não simbólicas e streams DEFLATE completos cujo produtor omite Adler32. O perfil limitado aceita esse formato, com limite de expansão e consumo integral do stream. Continua rejeitando checksum inválido, DEFLATE truncado, conteúdo ativo, fontes/CMap não reconhecidos, filtros desconhecidos e estruturas fora do perfil. O vínculo ainda exige número, verificador, emitente, tomador e valor compatíveis. Compatibilidade de leitura não equivale a homologação geral ou prova de autenticidade por si só.

Nenhum PDF/XML financeiro foi incluído no Git. O teste automatizado usa fixture sintética em memória; o arquivo histórico foi somente lido localmente, sem upload.

## QA isolado

Harness HTTP em loopback4327, SDK Azure real com Azurite11010/11012 e governo stand-in HTTP com credencial somente de QA. Tabelas/contêineres aleatórios exclusivos, sem credencial Azure ou token de produção. Relógio setembro explícito permite ensaiar período setembro→outubro sem relaxar guardas de competência. Documentos gerados a partir do RPS real do workflow; não se injeta DTO `issued` pronto.

Casos: CPF/CNPJ, concorrência, replay, timeout depois de commit, PDF503/incorreto/tardio, estorno antes da emissão, cancelamento, identidade substituída e bloqueio de novembro antes do governo. Testes separados verificam lease/fencing e checagem do worker.

## Validação do candidato

- 11/11 testes direcionados, sem skips, incluindo revisão por política divergente e retry por storage indisponível.
- Repetição final no consumidor C# ATP: 2/2 E2E aprovados contra o harness atualizado, com orquestrador/SDK/HTTP reais e renderizador/outbox/e-mail stand-in. O root ATP também informou sua bateria SQL/HTTP31/31; são provas separadas desta suíte Node.
- Build Next16.4.3/Turbopack e TypeScript aprovados; API compilada e runner empacotado com dependências físicas atualizadas no checkout de QA. Os `node_modules` compartilhados não foram alterados.
- Audit de produção raiz e API: zero altos/críticos; três moderados transitivos permanecem, conforme a release anterior. Não alegar ausência total de vulnerabilidades.
- A primeira regressão completa encontrou222/223 aprovados: um bloco `role=status` preexistente dentro do modal ATP contrariava o padrão do administrativo. Corrigido sem remover conteúdo; o estado `fiscal_review_required` agora aparece na listagem. Regressão final **224/224 aprovada, zero falhas/skips**, incluindo o novo teste de política/retry. O ajuste posterior do identificador do timer teve sintaxe e teste do gate OFF repetidos e aprovados.
- Revisão adicional: a consulta oficial posterior pode serializar o mesmo XML com whitespace diferente. A recuperação de PDF mantém os bytes/hash do XML original já vinculado, validando o retorno atual sem substituir o arquivo. Novo caso HTTP/SDK confirmou PDF tardio com XML reformatado e nenhuma nova emissão;7/7 testes direcionados de automação/armazenamento municipal/prévia aprovados após esse ajuste. Ele é executado no orquestrador da API, não na ação worker da VM.
- Consulta posterior inválida preserva também o resultado autorizado privado; não apaga o XML/PDF original ao registrar a divergência. Teste HTTP com retorno inválido e comparação integral do resultado confirmou essa preservação;17/17 testes municipais/automação/SDK aprovados após esse reforço.

## Implantação comprovada

Fonte funcional `a4cffb1d3ab72d6f8c42c00c9a55975309062b9e`; ajuste do nome do timer `4bfb11ccbc3713f8fe9acde9abc45e522b4583db`; preservação do XML autorizado `e2efcb2a1e51033c97b93a1ce27250f3f07fe29c` e `8ed0cc400be1ab5b48598b98ee8fbed8a57343fa` (fonte final da API). Integrados sequencialmente em `origin/main` e na branch isolada. CIs40598116176 e40598697172 aprovados em security_checks/build/deploy. **CI final [40599273512](https://github.com/dennisrs-drsoft/sysney-site/actions/runs/40599273512) aprovado em segurança/build/deploy**, concluído em27/10/2026,20:07 BRT. O worker permanece identificado pela fonte a4cffb1: os ajustes posteriores são no timer/orquestrador API, não na ação worker em execução na VM.

### API financeira

- App `sysney-admin-api-2602`, grupo `sysney`, fonte final8ed0cc4; pacote ZIP SHA256 `62db4f7a6dc4720b0948f9cb5c282e8d6c9b466e95e6ff27c8dca8ebd0717da7`. Publicação com build remoto concluída. Após o pacote final, marcador8ed0cc4, triggers sincronizados e enumeração ARM confirmou `atp_municipal_automation` com `isDisabled=true`; os36 settings anteriores continuam com o mesmo hash.
- `ATP_FISCAL_V1_ENABLED=true` apenas preparação/consulta. `ATP_FISCAL_LINK_ENABLED`, `ATP_MUNICIPAL_AUTOMATION_ENABLED`, `ATP_MUNICIPAL_QUEUE_ENABLED`, `ATP_MUNICIPAL_EXECUTOR_ENABLED`, `ATP_MUNICIPAL_ISSUANCE_ENABLED`, `ATP_MUNICIPAL_OPERATOR_ENABLED`, `ATP_MUNICIPAL_READINESS_ENABLED` e `SYSNEY_ALLOW_NATIONAL_RESTRICTED_SEND` **false**. `AzureWebJobs.atp_municipal_automation.Disabled=true`.
- Hash das36 configurações preexistentes, excluindo somente marcador de release e dois novos gates, idêntico antes/depois: `a72fc5a93b1e78a86b4bc98de1486d1b5b5d58476779d738880b0ed828e09a10`. Não foram alterados Inter, SendGrid ou suas referências de credenciais. Valores secretos não foram registrados no relatório.
- Health público200, fachadaATP semBearer401. Site comwww200, apex301 parawww, contato200; `/admin` e APIponte anônimos302 para loginGitHub. Isso não substitui teste com sessão administradora real.

### Worker DRServer

- Release `C:\ProgramData\SYSNEY\AtpMunicipal\releases\a4cffb1d3ab72d6f8c42c00c9a55975309062b9e`; pacote SHA256 `807896ea8e84394500ad2e60141390625b7215071c72484f09f1aa09b2c5b283`.
- Runner SHA256 `e5b925d70bb7a93fefa8c40c28f21c53035f1e2ed1e4ad26d1fe6a0016a043d8`; Node portátil existente SHA256 `dccc52de28d8df2ee22d2062424f8c563070d95d8ad70c54c4bf01d590dec14f`, Authenticode válido.
- Tarefa `SYSNEY-ATP-Municipal-Isolado` **Disabled**, config `paused=true`, `allowFiscalCalls=false`, `issuanceEnabled=false`, `automationEnabled=false`, `nationalEnabled=false`. Readiness `installed_paused`; chamadaOnce retorna `paused` sem fiscal/storagewrites.
- SDK/identidade gerenciada reais antes/depois: `queueJobs=0`, `preparations=0`, `storageReadable=true`, `storageWrites=false`, `transmitted=false`. Nenhuma preparação fictícia em produção.
- Nova leitura de encerramento confirmou outra vez `installed_paused`, todos os gatesfalse, tarefaDisabled e fila/preparações0 após a publicação final da API.
- Configuração anterior preservada em backup privado na mesma pasta. Hash/ACL da configuração fiscal legada e ACL da raizATP idênticos. Sem alteração de RBAC, SQL, firewall, certificados, chave privada, serviços ou tarefas legados. Certificado existente vence10/11/2026; renovação não fez parte desta etapa.

### Encerramento do QA

Após ACK final2/2 do consumidorATP, listener4327 encerrado e token **sintético** temporário removido. Nova regressão completa sobre a fonte8ed0cc4:224/224, sem falhas/skips; buildNext/TypeScript repetido e aprovado. ServidoresQA próprios (Next3147/Postman5239/Azurite11010–11012) encerrados após a validação. Nenhum token de produção foi recriado/recuperado localmente nesta etapa. Os documentos/artefatos operacionais de saída permanecem fora do Git.

## Próxima ativação

Infraestrutura implementada e instalada; operação real permanece deliberadamente pausada. Não habilitar por inferência da palavra “pronto”. Antes de ativar: confirmar política fiscal versionada/exclusividade da série/corte explícito, alinhar competência e novembro, conferir certificado vigente e obter autorização específica para emissão real. Nacional continua bloqueado. Cortesia/vendas/e-mailATP são controlados e comprovados pela frenteATP; esta implantação não os altera.
