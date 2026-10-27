# Integração ATP — fase 1 local, não publicada

Contrato autoritativo: `postman/atp-fiscal-v1.openapi.yaml`, draft.2.
Fixture exclusivamente sintética: `postman/fixtures/atp-fiscal-v1.synthetic.json`.
Não usar estes dados para transmissão fiscal. Não importar pagamentos antigos,
teste de R$ 5 já estornado ou cortesias por inferência.

## Implementado e limites

A fachada está na API Azure Functions, não na aplicação Next.js. O prefixo `/api`
é acrescentado pelo host Functions. Não há rota de proxy no site institucional.
Base de produção NÃO configurada para ATP nesta etapa. Não existe emissão,
cancelamento, cobrança bancária ou envio de e-mail nesta fachada.

Preparações são persistidas em AdminDocumentos, partição
`integracao-fiscal-atp-v1`. Documento por hash de `ATP + NUL + paymentId` e índice
por SHA-256 da referência são criados em transação atômica na mesma partição.
Repetições usam hash do payload JSON canônico (ordem das propriedades irrelevante;
valores, precisão textual de timestamps e campos opcionais são preservados).
Consumidor deve persistir o payload original e reutilizá-lo sem recalcular horários.
Após timeout consultar a referência antes de repetir. Nunca usar ID do evento Asaas
ou assinatura como identidade de pagamento. Mesma referência e pagamento com
conteúdo divergente retornam conflito. Não existe atualização pública do tomador.

paymentVerifiedAtUtc é a hora da verificação pelo ATP. paidAtUtc é opcional e só
deve existir se a fonte informar timestamp real. DueDate/confirmedDate sem hora
não viram timestamps inventados. Competência e período são explícitos para revisão.

Novos registros ficam `pending_review`. Não são cobranças/e-mails internos.
Consulta não devolve tomador, hashes, endereço, chave fiscal, paths de blobs ou
dados de outras origens. Estorno mantém estado fiscal e acrescenta revisão pendente;
refundId é correlação ATP da revisão, não necessariamente ID fornecido pelo Asaas.

Downloads só acessam bytes já aprovados, armazenados privadamente sob prefixo ATP
da solicitação, com tamanho e SHA-256 conferidos. O endpoint não transmite ao
provedor e não recupera PDF por nova emissão. XML/PDF oficial não recebem branding.
Erros de armazenamento/download nunca alteram `issued` nem recriam solicitação.

PENDENTE: fluxo interno supervisionado para vincular uma emissão existente à
preparação ATP, validar emitente/tomador/valor/período, copiar arquivos oficiais,
registrar hashes e auditoria e projetar estado consolidado no painel SYSNEY.
Não há endpoint externo para forçar `issued` ou apontar blob. Assim, no estado
atual, pedidos novos permanecem pendentes e seus downloads retornam 409.

## Segurança e configuração (não aplicada)

`ATP_FISCAL_V1_ENABLED=true` seria habilitação explícita futura, nunca default.
`KEY_VAULT_URI` e `ATP_FISCAL_V1_TOKEN_SECRET_NAME` devem apontar a um segredo
exclusivo cujo nome comece com `atp-fiscal-v1-`. Valor aleatório com ao menos
32 bytes de entropia, codificado sem espaços com 43–512 caracteres. O comprimento
não comprova entropia: gerar criptograficamente fora do histórico e guardar no cofre.
O ATP guarda sua cópia/referência no seu cofre; não usa chave master ou admin.

O host usa authLevel anonymous para não exigir function key compartilhada;
o handler exige Bearer exclusivo antes de acesso ao storage, sem confiar em Origin,
CORS ou principal enviado pelo cliente. Flags/segredo ausentes fecham com 503.
Comparação via hash constante. Contador distribuído existente limita a identidade
ATP a 40 requisições/minuto nesta fase conservadora, inclusive polling/download;
429 inclui Retry-After. Indisponibilidade do limitador fecha com 503.
Corpo máximo 16 KiB em streaming e prazo 20 s; falhas não registram payload/token.
Antes de publicação revisar exposição na borda, rotação e limitação pré-autenticação.
Não alegar proteção completa de DDoS/brute force.

## Homologação nacional e aprovações pendentes

O adaptador nacional continua desabilitado. Confirmar com Dennis/contador:

1. Emitente contratual SYSNEY, situação ME/EPP e regime vigente, município e inscrição.
2. Natureza exata da receita ATP (licença/assinatura/serviço/intermediação), código
   nacional e municipal aplicável; não copiar 03158 nem os 6% comerciais Compuwise.
3. Regime de tributação, local de incidência, retenções/ISS, competência, descontos,
   campos e classificações IBS/CBS exigidos no leiaute nacional vigente.
4. Tomador fiscal distinto de titular do cartão/customer Asaas, inclusive CPF se
   aplicável; documento, nome e endereço confirmados pelo contratante.
5. Tratamento de estorno, cancelamento/substituição e prazo conforme caso fiscal;
   pagamento estornado não cancela NFS-e automaticamente.

Obter contrato/schema nacional oficial vigente, validar habilitação/certificado e
série/sequência DPS independente, assinar sem exportar chave privada, homologar
transmissão/consulta por DPS, timeout e recuperação, XML autorizado/DANFSe e erros.
Somente depois revisar aprovação interna e liberação específica de produção.
Referência oficial consultada em 27/10/2026:
https://www.gov.br/nfse/pt-br/noticias/comite-gestor-do-simples-nacional-prorroga-a-obrigatoriedade-de-emissao-de-notas-fiscais-de-servico-pelo-emissor-nacional-da-nfs-e/

## Evidências e próximos testes

`node --test tests/atp-fiscal-v1.test.mjs`: nove testes offline com armazenamento
em memória controlado. Cobrem auth, flag, isolamento, replay/conflito, concorrência,
timeout após commit, lookup, renovação, revisão e PDF falhando sem reemissão.
Não comprovam transação Azure real, Functions routing, RBAC, Key Vault, rede ou
disponibilidade fiscal. Sintaxe dos três módulos conferida com node --check.
Sem chamadas a HTTP externo, provedor fiscal ou serviço de e-mail nos testes.

Antes de publicar: testes do adapter em storage isolado/Azurite, limites e erros,
revisão de segurança, teste do registro/rotas Functions e download autenticado,
integração com outbox ATP em ambiente separado e homologação nacional. Callbacks
assinados com deduplicação ficam para fase 2; fase 1 usa polling.
