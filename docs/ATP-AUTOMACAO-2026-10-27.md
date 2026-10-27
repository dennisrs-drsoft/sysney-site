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

Casos: CPF/CNPJ, concorrência, replay, timeout depois de commit, PDF503/incorreto/tardio, estorno antes da emissão, cancelamento, identidade substituída e bloqueio de novembro antes do governo. Testes separados verificam lease/fencing e checagem do worker. Provas, SHA e publicação serão acrescentados após conclusão.

## Validação do candidato

- 11/11 testes direcionados, sem skips, incluindo revisão por política divergente e retry por storage indisponível.
- Repetição final no consumidor C# ATP: 2/2 E2E aprovados contra o harness atualizado, com orquestrador/SDK/HTTP reais e renderizador/outbox/e-mail stand-in. O root ATP também informou sua bateria SQL/HTTP31/31; são provas separadas desta suíte Node.
- Build Next16.4.3/Turbopack e TypeScript aprovados; API compilada e runner empacotado com dependências físicas atualizadas no checkout de QA. Os `node_modules` compartilhados não foram alterados.
- Audit de produção raiz e API: zero altos/críticos; três moderados transitivos permanecem, conforme a release anterior. Não alegar ausência total de vulnerabilidades.
- A primeira regressão completa encontrou222/223 aprovados: um bloco `role=status` preexistente dentro do modal ATP contrariava o padrão do administrativo. Corrigido sem remover conteúdo; o estado `fiscal_review_required` agora aparece na listagem. Os testes direcionados de diálogo passaram depois da correção. Regressão final em andamento antes da publicação.
