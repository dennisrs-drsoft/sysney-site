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

## HTTP local para o consumidor ATP

`tests/helpers/atp-fiscal-http.mjs` inicia servidor HTTP real em loopback, porta
4319 por padrão (`PORT` opcional). Definir `ATP_FISCAL_SYNTHETIC_TOKEN` descartável
com ao menos 43 caracteres no ambiente tanto do harness como do consumidor ATP;
nunca usar token de produção. Iniciar com
`node tests/helpers/atp-fiscal-http.mjs`. BaseURL do consumidor:
`http://127.0.0.1:4319` (acrescentar caminhos `/api/integracoes/...` do contrato).
Armazenamento em memória, perdido ao reiniciar, sem infraestrutura Azure.

`node --test tests/atp-fiscal-http.test.mjs tests/atp-fiscal-v1.test.mjs` passou
10 testes, incluindo requisições HTTP reais GET/POST, autenticação, preparação,
lookup, replay e revisão. Isso não testa Azure Functions host/roteamento, Key Vault,
Table Storage ou Blob reais. Não existe URL de homologação Azure publicada.
`issued` não é alcançável via fluxo público desta fase: apenas fixtures internas
de teste podem simular esse estado; vínculo com emissão real continua pendente.

## Visão administrativa adicionada localmente

Seção `Fiscal ATP` no menu financeiro, somente SYSNEY. GET `/api/admin/atp-fiscal`
usa a autenticação administrativa existente e sua ponte para a API externa,
nunca o Bearer ATP. Lista origem, referência, competência, valor bruto, estado,
número da nota se houver e revisão de estorno. Paginação de até 50 registros com
cursor e carregamento incremental; sem agregados enganosos sobre páginas não lidas.
Não mostra tomador/endereço/XML/brutos internos. Não cria cobrança financeira.
Contrato público draft.2 permanece inalterado.

O vínculo supervisionado NÃO foi habilitado: a identidade do administrador existe,
mas os trabalhos fiscais internos atuais não carregam proveniência ATP/paymentId.
Coincidência de CNPJ/valor/competência sozinha não comprova a associação. Faltam:

1. Proveniência ATP imutável ou confirmação supervisionada explícita do período e
   objeto do serviço no trabalho fiscal já autorizado, além de emitente/tomador/
   valor/competência e retorno oficial `teste=false` conferidos.
2. Reserva única de uso da nota por solicitação (e vice-versa), transação/CAS,
   confirmação vinculada aos hashes e responsável, recuperação após timeout e
   tratamento de documento já associado sem substituir silenciosamente.
3. Cópia privada de XML autorizado e PDF oficial com proveniência, tamanho/hash e
   verificação de consistência; PDF pendente não deve desfazer `issued`.
4. Registro auditado da aprovação e projeção pública sem dados pessoais ou paths.
   Nenhuma ação aceita URL/blob arbitrário nem altera notas Compuwise/históricas.

Validações adicionais executadas: TypeScript `--noEmit` sem erros e build local da
API administrativa incluindo o novo handler. Não houve build Next completo, teste
visual ou teste autenticado de lista em Azure. Deploys de frontend e API continuam
pendentes de revisão e autorização específica; nenhuma configuração foi aplicada.

## Núcleo de vínculo supervisionado (etapa local seguinte)

`admin-api/src/services/atp-fiscal-link.mjs` implementa duas operações internas:
`reserveProvenance({requestId,workId,actor})` ANTES da autorização fiscal e
`approveLink({requestId,workId,expectedSnapshotHash,actor,confirmed:true})` após
retorno oficial. Não são rotas ATP/admin publicadas nem aceitam prova via navegador.
`actor` deve ser derivado de sessão administrativa autenticada pelo chamador interno,
nunca do corpo do pedido. A operação permanece desabilitada por default.

Proveniência imutável: origem/paymentId/referência/requestId/workId, hash congelado
dos dados/período/descrição e responsável. Reserva work e índice request-work juntos.
Vínculo exige evidência privada posterior à proveniência, identidade oficial única,
emitente SYSNEY, tomador/valor/competência/período/descrição correspondentes e
documentos com hashes conferidos. Uma nota não pode servir a dois pagamentos.

O adapter Table/Blob recebeu métodos internos de reserva, claim, armazenamento
content-addressed sem sobrescrita e commit transacional: estado da solicitação,
ETag de proveniência, claim da nota e auditoria são confirmados juntos. Concorrência
com revisão de estorno invalida ETag. Timeout após commit é recuperado por leitura
da mesma claim. PDF ausente mantém issued com XML disponível; divergência de arquivo
não autoriza substituir o conteúdo silenciosamente ou transmitir de novo.

Seis novos testes sintéticos passaram (16 no conjunto), incluindo replay, timeout,
concorrência, ausência de PDF, divergências e bloqueio de associação por coincidência.
Os XML/PDF simulados são SEM VALIDADE FISCAL e não homologam schemas/provedor.

PENDÊNCIAS mantidas: adaptador confiável `readAuthorizedEvidence(workId)` que leia e
valide XML autorizado real contra o schema/provedor e snapshot interno, chamada de
reserva no fluxo fiscal antes da emissão, ação/modal administrativo autenticado e
auditoria de sua aprovação, testes de Table/Blob isolados e homologação nacional.
O núcleo não confia em URLs/paths de clientes; não ligar sua entrada a um payload
de evidência livre. Por isso nenhum vínculo real ou endpoint de aprovação foi
liberado. O harness HTTP continua apenas preparação, sem endpoint sintético admin.

## Revisão de segurança de encerramento — 27/10/2026

Revisão por leitura do código e repetição dos testes locais, não pentest nem
auditoria independente. Sem publicação ou alteração de configuração/segredos.

- Unicidade implementada no escopo ATP: paymentId, referência, trabalho, solicitação
  e identidade oficial da nota possuem reservas/índices. A implementação Azure usa
  transações na mesma partição e ETags; os testes de concorrência usam repositório
  sintético, NÃO comprovam atomicidade no serviço Azure em execução. Reservas ATP
  não são uma garantia global sobre sistemas legados/externos não integrados.
- Bytes privados: API não aceita path/URL de documento e não devolve paths. Downloads
  usam identidade autenticada ATP, prefixo por solicitação e tamanho/SHA-256;
  uploads internos são content-addressed com If-None-Match. Estas são garantias de
  implementação. RBAC, ACL, ausência de acesso público, expiração de acesso e
  configuração real de Blob/Key Vault ainda exigem verificação no ambiente destino.
- O hash prova integridade dos bytes esperados, NÃO autenticidade fiscal sozinho.
  Assinatura, schema, autorização e metadados precisam ser comprovados pelo leitor
  confiável do provedor ainda pendente. Checks de cabeçalho PDF/XML não o substituem.
- `actor` e evidência são argumentos de código interno, NÃO credenciais verificadas
  por si mesmos. Não expor o núcleo como endpoint antes de construir a fronteira
  administrativa autenticada, confirmação por snapshot e proteção contra CSRF.
- O leitor futuro deve produzir authorityKey canônica/estável (nacional: chave oficial;
  municipal: identidade oficial normalizada de emitente/inscrição/número), bloquear
  entidades externas/DTD no XML e provar a correspondência com a origem ATP.
- Órfãos de blob após falha anterior ao commit podem existir; não significam nota
  vinculada. Retenção/limpeza segura ficam pendentes, sem apagar arquivos nesta fase.
- Timestamps: usar UTC com sufixo Z e até três casas decimais. Reusar exatamente o
  payload congelado no replay; não recalcular paymentVerifiedAtUtc a cada tentativa.

Execução final:
`node --test tests/atp-fiscal-link.test.mjs tests/atp-fiscal-http.test.mjs tests/atp-fiscal-v1.test.mjs`
Resultado: 16 testes, 16 aprovados, zero falhas. `node --check` dos módulos de
vínculo/store e `git diff --check` também passaram. Sem Azure, SQL de produção,
provedor fiscal, certificado ou envio de e-mail. Próxima etapa conjunta:
proveniência no fluxo NACIONAL homologado e enquadramento ATP aprovado pelo contador.

## Leitor e fronteira de aprovação — avanço local seguinte

`atp-authorized-xml.mjs`: leitor estrutural conservador para NFSe nacional 1.01,
namespace padrão oficial e apenas caminhos explícitos de infNFSe/DPS/infDPS.
Preserva bruto em centavos, exige tpAmb=1 e identifica emitente/tomador, competência,
descrição, chave, número e data de processamento. Não usa busca recursiva pelo
primeiro CNPJ/valor encontrado. Rejeita DTD/ENTITY/CDATA/PIs externas, UTF-8 inválido,
arrays nos campos singulares, namespace divergente, IDs duplicados e excessos de
tamanho/profundidade/elementos. Perfil conservador pode rejeitar XML legítimo fora
desse subconjunto; não chamar isso de suporte nacional completo.

Referência consultada: documentação oficial de Produção e ZIP XSD v1.01-20260209
em https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual
(ZIP inspecionado somente em memória). Não confundir com schemas de produção
restrita de outubro; schemas precisam ser fixados/homologados na próxima etapa.

O leitor autorizado exige função interna verifyAuthorization que comprove schema,
assinatura/chain e confirmação oficial não cancelada, ligadas ao SHA-256 exato,
chave e ambiente. Prova precisa ter até cinco minutos; datas futuras são bloqueadas
com tolerância de 30s. NÃO há implementação real desse verificador nesta etapa;
ausência falha fechada. Testes usam substituto explícito e XML reduzido SEM VALIDADE
FISCAL, não documento XSD válido nem assinatura fiscal de verdade.

`atp-fiscal-admin.mjs`: factory da fronteira administrativa com autenticação
injetada, checagem de Origin, corpo limitado/allowlist e ações reserve/preview/approve.
Ator não vem do corpo, Bearer ATP não substitui sessão admin. Preview inclui hashes
de bytes e ETag; aprovação compara previewHash, snapshotHash e confirmação explícita,
congela evidência da leitura e chama núcleo transacional. Mudança do XML entre
preview e approve retorna conflito. Sem registro de rota real ou botão de produção;
falta conectar authenticate à ponte administrativa protegida e ao verificador real.

Draft.2 público não mudou. Nenhuma rota externa nova ativada, nenhuma nota real lida,
copiada, vinculada, emitida ou cancelada; nenhum e-mail/pagamento foi executado.
Azurite não localizado no PATH/dependências; não criados recursos Azure nem usados
Table/Blob reais. Testes de infraestrutura isolada seguem pendentes.

Conjunto ampliado: 22 testes offline/HTTP loopback aprovados, zero falhas.
Comando: `node --test tests/atp-authorized-xml.test.mjs tests/atp-fiscal-admin.test.mjs tests/atp-fiscal-link.test.mjs tests/atp-fiscal-http.test.mjs tests/atp-fiscal-v1.test.mjs`.
Bloqueios do contador: natureza da receita, código nacional, tributos/retenções,
competência/período, tomador e tratamento de estorno. Bloqueios do provedor/infra:
schema/assinatura e consulta oficial, habilitação/certificado/DPS, DANFSe, homologação
e RBAC/storage isolado. Ainda depende de implementação nossa: verificador real,
conexão da proveniência ao fluxo nacional e rota/modal autenticados após homologação.

## Sessão, rota e modal conectados — homologação continua bloqueada

A rota existente `/api/admin/atp-fiscal?empresa=sysney` agora possui POST conectado
à fronteira administrativa pelo mesmo mecanismo de sessão/ponte protegida. Exige
papel administrador, Origin e userId derivado do principal; o corpo não escolhe
ator/emitente. A capacidade fiscal real está explicitamente `false`: mesmo
ATP_FISCAL_LINK_ENABLED=true retorna 503 antes de acessar storage ou ler XML.
Esse gate só deve mudar junto ao verificador real homologado e sua revisão.

GET com `acao=vinculo-capacidades` informa bloqueios sem documentos/dados pessoais.
O painel ganhou botão Revisar vínculo fiscal, modal detalhado e caminho de prévia/
confirmação por previewHash/snapshotHash. Enquanto indisponível, apenas explica os
requisitos; não oferece aprovar. Fixtures não estão ligadas à rota real.
Teste do handler compilado comprovou 401 sem sessão admin (inclusive Bearer ATP),
403 para Origin incorreta, 400 para DRSoft e 503 com flag ativa sem homologação.
Não substitui teste no host Functions/SWA real nem teste visual do navegador.

Correção de paginação: faixa de chaves `request-0` a `request-g` exclui índices
`request-work-*`; eles não devem ser interpretados como registros JSON de pedidos.

`createAtpFiscalEmulatorStore(connectionString)` permite testar o MESMO repository
com SDK Table/Blob e credencial pública de desenvolvimento, exclusivamente endpoints
HTTP em 127.0.0.1/portas explícitas e conta devstoreaccount1. É entrada explícita de
teste, NÃO fallback/variável de produção. Aguardando endpoints isolados Azurite do
ATP; nenhuma operação de infraestrutura foi executada nesta etapa.

Validações: TypeScript --noEmit e build da API aprovados. Conjunto de 23 testes
aprovado incluindo `tests/atp-fiscal-admin-route.test.mjs` após build; zero falhas.
Comando: `node --test tests/atp-fiscal-admin-route.test.mjs tests/atp-authorized-xml.test.mjs tests/atp-fiscal-admin.test.mjs tests/atp-fiscal-link.test.mjs tests/atp-fiscal-http.test.mjs tests/atp-fiscal-v1.test.mjs`.
Ainda não verificados: transações/RBAC no Azure ou Azurite, tela em navegador,
assinatura/schema nacional reais e homologação do provedor. Sem publish, dados
reais, envio, emissão, cancelamento, cobrança ou mudanças de gates em produção.
