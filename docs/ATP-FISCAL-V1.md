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

## Armazenamento validado no Azurite isolado

Azurite oficial 3.37.0 disponibilizado pela frente ATP em loopback Blob11000,
Table11002 (Queue11001 não usado), sem conexão Azure real. Log confirmou listeners
127.0.0.1; consultas HTTP sem credencial responderam 403 Blob/400 Table, não prova
isolada de autorização. O teste autenticado usa somente chave pública devstoreaccount1
lida das constantes do pacote local, sem registrar chave/conexão em logs ou Git.

`tests/atp-fiscal-azurite.test.mjs` usa SDKs reais com tabela/container de nomes QA
únicos aleatórios. O mesmo repository operacional recebe esses clients isolados.
Foram verificados:

- criação atômica de solicitação+índice e rollback quando referência conflita;
- ETag obsoleto recusado, mantendo revisão de estorno;
- uma única criação concorrente e reserva work/request única;
- upload imutável/repetição de bytes idênticos, identidade e download por hash;
- commit transacional de solicitação, proveniência, claim e auditoria;
- negação de caminho fora do prefixo e detecção de blob adulterado;
- container privado e negação HTTP anônima para o próprio XML QA.

Recursos QA recém-criados foram removidos no finally, por nomes validados; não se
apagaram tabelas/containers existentes, pasta do emulador nem recursos ATP/produção.
O teste é opt-in: ATP_AZURITE_PACKAGE aponta a instalação local oficial; sem essa
variável é skip explícito, não sucesso de integração.

Rodada conjunta: 24 testes aprovados, zero falhas, zero skips; comando anterior
ampliado com `tests/atp-fiscal-azurite.test.mjs`, `--test-concurrency=1` e timeout
120000. Repetição isolada do teste Azurite também valida negação anônima após sua
inclusão. Atomicidade no Azurite não substitui homologação Azure real/RBAC/Key Vault.
Continuam bloqueados: schema/assinatura/autorização nacional confiáveis, código e
enquadramento aprovados pelo contador, emissão real, rota/modal com capacidade real
e revisão pré-publicação. Nenhum desses gates foi habilitado.

## Simplificação aprovada: parâmetros externos e consulta oficial confiável

A orientação posterior do titular separa definição tributária externa da operação
do software. Não implementar campo de parecer contábil, chamada ao contador nem
aprovação contábil por nota. O sistema exige parâmetros técnicos preenchidos e
coerentes (emitente, código nacional, tributação, competência etc.), não um documento
de aprovação de contador. Não inferir código/alíquota; fornecer configuração por
serviço/emitente com versão e vigência quando os valores forem informados.
As listas anteriores de pendências contábeis são orientação externa, não gates de
workflow ou pré-requisito de integração com outro serviço de contabilidade.

Novo caminho preferido `createOfficialQueryEvidenceReader` usa consulta privada
autenticada ao emissor oficial e os próprios bytes devolvidos por ele. Dispensa
serviço customizado de assinatura e flags signatureValid/schemaValid desse caminho.
Continua exigindo chave exata, ambiente, situação autorizada e estado conhecido de
cancelamento/substituição, confirmação recente, bytes/hash consistentes e identidade
do emitente/tomador/valor correlacionada pelo núcleo. Upload arbitrário não é fonte.

consultOfficial é interface INTERNA normalizada, não contrato HTTP oficial inventado:
o cliente autenticado ainda precisa ser implementado/homologado com resposta e
eventos reais do provedor. `status=unknown`, apenas HTTP200, campo ausente ou
consulta desatualizada não autorizam vínculo. Teste usa substituto sintético explícito,
sem afirmar que houve consulta oficial mTLS. O caminho antigo de verificador fica
como alternativa interna, não como exigência operacional/serviço a contratar.

Capacidades nacionais efetivamente existentes: preparação/pendências, formador do
identificador DPS, leitor estrutural restrito e núcleo/fachada ATP testados. Há script
operacional antigo de diagnóstico GET no checkout principal (não versionado nessa
branch), mas não prova emissão nacional. Não existem ainda transmissão DPS nacional,
assinatura DPS e consulta de eventos/DANFSe homologadas ou automação real ATP.

Configuração técnica pendente: seleção do certificado fiscal válido/acesso à chave
privada no processo seguro, cliente autenticado oficial para ambiente restrito e
produção, confirmação de acesso do emitente, schemas/layout efetivamente usados,
código e parâmetros informados externamente, série/sequência DPS própria e persistida,
normalização de resposta/eventos e recuperação de DANFSe. Não foi comprovada a
necessidade de contratar serviço terceiro ou obter nova API key comercial. Não
reutilizar série/cadeia/códigos municipais por inferência.

Homologação nacional significa TESTE TÉCNICO no ambiente de produção restrita:
enviar DPS sintética adequada, receber aceitação/rejeição, consultar a mesma DPS/chave,
conferir documento e PDF, eventos e recuperação após timeout, sem duplicação. Não é
uma contratação nem parecer contábil; condições cadastrais de acesso podem existir,
mas precisam ser verificadas em vez de presumidas. Esses testes não foram executados
contra a Receita nesta etapa e produção fiscal permanece fechada.

Draft.2 público e credenciais permanecem inalterados. Nenhuma aprovação contábil
foi adicionada ao sistema; mensagens dos gates passaram a descrever as capacidades
técnicas oficiais ainda ausentes, não a contratação de um verificador customizado.

Rodada desta simplificação: 25 testes aprovados, zero falhas/skips, incluindo
Azurite isolado e handlers administrativos compilados. TypeScript --noEmit e
build da API aprovados. Cliente nacional real não foi chamado nos testes; a
consulta oficial normalizada é substituída por evidência sintética controlada.

## Avanço nacional restrito — 27/10/2026

Esta seção atualiza o estado técnico anterior, sem habilitar produção. Contrato
`1.0.0-draft.2`, `nationalAdapterReady:false`, fronteira administrativa e flags de
produção permanecem inalterados. Não houve push, deploy de worker ou emissão real.

Implementados gerador DPS 1.01 com endereço confirmado, assinatura Windows com
certificado do vínculo seguro SYSNEY (sem exportar chave), transporte mTLS de hosts
fixos restritos, consulta DPS/chave e evento específico, recuperação de DANFSe,
ledger insert-only anterior ao POST e armazenamento privado com hash. Composição
interna `createWindowsNationalRestrictedRuntime` conecta essas peças à solicitação
ATP e à reserva de proveniência existente. Preparar e executar exigem administrador,
ambiente homologacao, hash aprovado e autorização restrita explícita. Depois de uma
reserva, inclusive timeout, só consulta; sem repetição automática do POST. A VM exige
também gate de envio restrito e faz sua própria reserva durável antes da transmissão.

O runner não foi instalado nem registrado no worker/rotas. Sua implantação controlada,
uma forma operacional de selecionar a preparação e reservar a sequência DPS própria,
e homologação oficial são pendências nossas. Não confundir uma factory interna
testada com automação on-line concluída. Documentos restritos ficam em
`qa/nacional-restrita`, nunca tornam a solicitação pública ATP `issued` e não são
entregues como XML/PDF de produção. Não há rotina de e-mail nesta composição.

Evidência efetiva na DRServer: certificado SYSNEY válido, chave privada acessível,
GET autenticado ao Swagger SEFIN restrito HTTP200. Sem certificado, a mesma consulta
é recusada. DPS sintética assinada no Windows PowerShell5.1 com o certificado real,
assinatura conferida e XSD oficial restrito validado, sem exportação de chave, sem
gravar XML assinado e sem transmissão. Certificado observado expira em 10/11/2026;
renovar antes dessa data para manter as integrações. Nenhum certificado foi instalado
ou alterado neste trabalho. Arquivos públicos XSD usados no QA da VM ficam em pasta
nova privada de homologação, sem alteração do serviço municipal.

Schemas públicos fixados no repositório: pacote oficial restrito 20/10/2026,
SHA256 `25fdcecc651a67a216496ab10d7566631e6ed10f721e37d62c7845dadb0ea267`.
O leiaute contém `finNFSe` obrigatório, `toma`, e ordem de `cServ` diferente de
exemplos antigos. Algoritmo de assinatura segue o exemplo do manual nacional
publicado (RSA-SHA1/SHA1); validação XSD e assinatura local não provam aceitação
atual pelo provedor. A aceitação oficial ainda deve ser testada.

### Cadastro real consultado, sem alterações

Leitura de `AdminConfiguracoes` na conta financeira: emitentes, regimes e perfis
`nfse-perfil-sysney` existem. Os três perfis consultados são municipais: regime
simples, codigoServico03158, aliquota0, issRetidofalse. Não contêm cTribNac, codigoNBS
ou cClassTrib. Não foi localizado perfil nacional ATP nas partições consultadas.
Na VM, `C:\ProgramData\SYSNEY\FiscalTeste\config.json` contém modo, emitentes,
storage e producaoEmitentes; busca de nomes nos config*.json dessa pasta SYSNEY não
encontrou os parâmetros nacionais. Não houve leitura de chave privada, despejo de
segredos nem cópia de dados de outro cliente para o ATP.

O cadastro municipal existente não foi descartado. Os campos nacionais ainda não
localizados são: `issuer.opSimpNac`, `issuer.regEspTrib`, condicionalmente
`issuer.regApTribSN`, `service.cTribNac`, `service.tribISSQN`,
`service.tpRetISSQN`, `service.totTrib`. Série DPS é configuração técnica própria.
Município/CNPJ/certificado vêm do emitente, tomador/valor/período vêm da preparação
ATP; não inferir código nacional, regime especial, transparência tributária ou
alíquota a partir de03158 ou dos6% da Compuwise. Não existe aprovação contábil por
nota ou requisito de contratar verificador: perfil externo versionado é suficiente
quando disponível. IBS/CBS/isenções/exportação e outros perfis não suportados devem
falhar explicitamente, não ser silenciosamente convertidos em prestação normal.

### Limites da homologação

Testes locais HTTP/Postman passaram para caminho integrado e falhas, com XML/PDF
fictícios; assinatura nativa e armazenamento Azurite são verificações separadas.
Nenhuma NFS-e nacional foi autorizada oficialmente nesta rodada. A fixture contém
cTribNac000000 e `NAO TRANSMITIR`, e permanece bloqueada na saída nativa. A página
oficial de São José dos Campos confirma ambiente sem validade fiscal, mas não fornece
um conjunto preenchido de parâmetros DPS para o caso de teste. Não transformar
exemplo de blog em perfil oficial nem parâmetros de outro município em dados ATP.

DANFSe GET está modelado conforme o manual oficial ADN, mas a documentação indicada
no catálogo retornou404 com certificado; nenhum PDF oficial foi recuperado sem uma
chave autorizada. Consulta de evento específico implementada não normaliza a situação
global de cancelamento/substituição. Normalização completa ADN, validação de documento
autorizado e vínculo de produção continuam pendentes de desenvolvimento/homologação;
nunca interpretar evento404, apenas HTTP200 ou XML sintético como autorização fiscal.

Consulta oficial adicional: GET de DPS fictícia inexistente no host SEFIN restrito,
com o certificado SYSNEY, respondeu HTTP404 em27/10; nenhuma transmissão foi feita.
O diagnóstico só registrou código HTTP/validade do certificado, sem XML ou segredos.

Validação final: 29 testes Node aprovados, sem falhas/skips, incluindo armazenamento
real no emulador isolado e fluxo HTTPsim. Teste PowerShell de assinatura/XSD,
TypeScript --noEmit, import da composição runtime, análise de sintaxe PowerShell e
build da API aprovados. A instância Azurite compartilhada11000 retornou500 ao PUT QA;
para não alterá-la, a rodada final usou outra instância loopback11010/11012 com pasta
absoluta privada. Foram criados/removidos somente recursos QA de nomes aleatórios.
Não atribuir essa falha do emulador à API financeira de produção.

### Runner sob demanda e sequência concluídos — complemento 27/10

As pendências de desenvolvimento de sequência e entrada operacional acima foram
resolvidas no código, sem instalação de serviço. `createRestrictedDpsSequence`
mantém contador por emitente SYSNEY, ambiente homologacao e série normalizada, e
atribuição por solicitação ATP. Contador + atribuição são gravados atomicamente na
mesma partição de FiscalFila; concorrência usa ETag/insert-only. Reinício, replay
e timeout após commit recuperam número e instante da preparação originais, sem
consumir novo número. Perfil/série alterados para a mesma solicitação são recusados.
Não existe expiração, reset ou reaproveitamento automático de número reservado.
A primeira atribuição da série própria inicia em1; usar série exclusivamente nova
de homologação, nunca série nacional já usada por outro sistema sem migrar contador.

Entrada executável: `admin-api/scripts/nacional-restrita.mjs`, modos `dry-run`,
`prepare`, `run`. O módulo não faz nada ao importar. Configuração explícita:

- `ADMIN_STORAGE_ACCOUNT`: conta privada já provisionada e autorizada.
- `SYSNEY_NATIONAL_RESTRICTED_ENVIRONMENT=homologacao`: qualquer outro valor recusa.
- `SYSNEY_NATIONAL_RESTRICTED_RUNNER=true`: habilita só a operação local sob demanda.
- `SYSNEY_ALLOW_NATIONAL_RESTRICTED_SEND=true`: exigido adicionalmente para `run`.

O perfil JSON privado contém apenas os grupos issuer/service/dps documentados,
sem certificado/chave/token. Usar caminho absoluto privado fora do Git. Exemplos
operacionais, com IDs e caminhos substituídos pelo operador:

```powershell
node admin-api/scripts/nacional-restrita.mjs dry-run --profile C:/pasta-privada/perfil.json --request-id ID_HEX_64
node admin-api/scripts/nacional-restrita.mjs prepare --profile C:/pasta-privada/perfil.json --request-id ID_HEX_64
node admin-api/scripts/nacional-restrita.mjs run --work-id WORK_HEX_64 --approved-hash HASH_HEX_64 --confirm-restricted SIM
```

`dry-run` lista NOMES de campos ausentes; perfil incompleto nem abre armazenamento.
Com perfil completo, apenas lê a preparação e valida a estrutura do gerador. Não
reserva sequência, não assina, não cria runtime e não faz POST. Não é homologação
tributária nem confirmação de aceite governamental. `prepare` reserva número/
proveniência e guarda DPS assinada privada, sem enviar. `run` exige hash exato da
preparação, confirmação explícita e gates restritos; replay usa somente GET depois
da reserva do POST. Saída imprime apenas IDs/hashes/status, nunca XML ou credenciais.
Identidade do ator vem da conta local do processo, não de parâmetro HTTP. Executar
somente na sessão operacional Windows autorizada, com identidade Azure já permitida;
o runner não cria grants, tarefas, serviços ou ACLs e não oferece endpoint público.

Para operação na VM, copiar os módulos/scripts/schemas revisados e dependências em
pasta operacional aprovada e testar o `dry-run` antes de habilitar gates locais.
Não foi feita essa cópia/instalação neste trabalho. Nenhuma instalação de worker
permanente é necessária para o ensaio sob demanda. Não habilitar produção a partir
de sucesso restrito. Integração administrativa/publicação e rotina permanente só
depois de homologação oficial positiva e revisão da operação.

Resultado governamental restrito é guardado com `authorityStatus=unknown` e
`requiresReview=true` enquanto a situação global ADN não estiver comprovada.
Evento específico404 nunca permite concluir ausência de cancelamento/substituição
nem promover pedido ATP para issued. Vínculo de produção permanece fechado.

Validação deste complemento: 31 testes Node aprovados, zero falhas/skips. Inclui
oito reservas simultâneas do mesmo pedido, oito pedidos concorrentes distintos,
nova instância do cliente após reinício, timeout depois de commit, séries isoladas,
perfil conflitante, preparação HTTP concorrente e `dry-run` sem acesso de escrita
ou transporte. Assinatura/XSD, TypeScript, build API e verificação de segredos
também aprovados. Toda a evidência de emissão continua simulada; nenhum POST fiscal
oficial adicional foi executado.

### Candidato disponibilizado na DRServer — 27/10/2026

Código4bf89f0 copiado em pasta NOVA
`C:\ProgramData\SYSNEY\NacionalCandidatos\4bf89f0`, sem substituir FiscalTeste.
29 arquivos de fontes/scripts/XSD/documentação, ZIP de transporte conferido por
SHA256 `00a5e960ccf881d8ec644ba2c098a155fb1f8a98e9e77a00fbd60f4673d1797c`.
Nenhum certificado ou segredo incluído. Preservados candidatos e artefatos anteriores.

Inventário nativo confirmou Windows Server2016 Datacenter x64, versão10.0.14393,
e Node global10.16.0, insuficiente para estes módulos. A matriz oficial Node22 inclui
Windows10/Server2016 ou superior:
https://github.com/nodejs/node/blob/v22.x/BUILDING.md#platform-list

Foi disponibilizado Node PORTÁTIL22.23.4 somente dentro do candidato, sem MSI,
registro, PATH, serviço, tarefa, ACL ou grants novos. Release LTS Jod publicada em
20/10/2026, obtida de `https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip`.
SHA256 oficial lido e conferido na VM:
`cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20`.
Authenticode do node.exe: Valid, titular OpenJS Foundation. Node global10.16.0
permaneceu igual. Não desabilitada qualquer proteção ou verificação de assinatura.

Bundle ESM com dependências já revisadas: Azure Tables13.3.2, Identity4.13.3,
Blob12.34.0. SHA256 do bundle:
`f9deacd7b0977e84dea7f53257c7507c51e8de5aed5d909d44e7650d84740307`.
Tamanho1278985 bytes; gzip330231 bytes. Build reproduzível pelo comando
`node deploy/build-national-restricted-runner.mjs`; manifestos/artefatos em output
ignorado pelo Git. Não precisa instalar npm/node_modules na VM para este bundle.
Posição no candidato mantém a resolução dos scripts nativos relativa ao módulo.

Dry-run REAL executado nessa cópia da VM, com caminhos absolutos:

```powershell
& 'C:\ProgramData\SYSNEY\NacionalCandidatos\4bf89f0\runtime\node-v22.23.4-win-x64\node.exe' 'C:\ProgramData\SYSNEY\NacionalCandidatos\4bf89f0\admin-api\src\services\nacional-restrita-runner.mjs' dry-run
```

Resultado: readyfalse, transmittedfalse, writesfalse. Listou os NOMES
ADMIN_STORAGE_ACCOUNT, SYSNEY_NATIONAL_RESTRICTED_ENVIRONMENT=homologacao,
--profile, --request-id, issuer.opSimpNac, issuer.regEspTrib, service.cTribNac,
service.tribISSQN, service.tpRetISSQN, service.totTrib e dps.serie. regApTribSN é
adicionalmente obrigatório quando opSimpNac3. Não foram fornecidos valores fiscais
nem configuração municipal convertida. Nenhum número foi reservado, nenhuma DPS
assinada ou transmitida pelo runner, nenhum acesso ao storage fiscal de escrita.
Prepare/run desabilitados no processo. Esse teste comprova runtime/imports/entrada,
não autorização oficial de NFS-e. Perfil/configuração restrita explícita e ensaio
governamental com XML/PDF/situação ADN seguem pendentes; a cópia do runner/runtime
e dependências já não é uma pendência. Nenhuma publicação Next/API ou worker instalado.
