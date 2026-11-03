# Perfil fiscal reutilizável e transição de emissor — 02/11/2026

## Problema e comportamento corrigido

O formulário reutilizava apenas o último perfil gravado após um teste aceito. Uma nota importada do portal, emitida manualmente ou anexada como PDF não criava esse perfil; por isso uma cobrança do mesmo cliente podia abrir sem código/endereço, apesar do histórico disponível.

O GET administrativo passa a usar, em ordem: trabalho fiscal já existente; perfil explicitamente salvo; sugestão extraída do XML individual mais recente, normal e arquivado da mesma empresa e do mesmo tomador. A sugestão valida CNPJ/CCM/nota/tomador, situação e estrutura do XML. Não escreve durante GET, não reserva RPS, não consulta o governo e não aprova/emite documentos. Falhas de identidade, duplicidade, DTD/entidades, cancelamento e XML fora do limite deixam o caso para revisão. A leitura do blob é limitada e condicionada ao ETag.

Recupera código municipal, alíquota e endereço. Nunca reutiliza série/número de nota ou RPS antigo, datas de pagamento ou valores de retenção de outra cobrança. O regime vem da configuração vigente da própria empresa. Retenções/deduções históricas especiais no Simples exigem revisão individual. Perfil de Lucro Presumido extraído do histórico não pressupõe novas retenções ou percentuais. O formulário identifica a fonte e mantém as confirmações desmarcadas. A vigência mostrada é a salva, não a data de abertura da tela.

O cadastro específico solicitado foi recuperado na base privada a partir do XML oficial, por createEntity e sem sobrescrever perfil existente. Contador de RPS preservado; não houve emissão ou envio. XML, endereço, documentos, hashes operacionais e scripts de execução permanecem em output privado, fora do Git.

## Critério oficial confirmado

- [Prefeitura de São Paulo, 19/10/2026](https://notadomilhao.sf.prefeitura.sp.gov.br/noticias/migracao-de-contribuintes-do-simples-nacional-para-o-ambiente-nacional/): migração das ME/EPP do Simples para o Nacional em novembro; portal municipal preservado para consultas e emissão relativa a fatos geradores até 31/10/2026.
- [Portal Nacional, diretrizes de 29/10/2026](https://www.gov.br/nfse/pt-br/noticias/nfs-e-informa-diretrizes-sobre-a-obrigatoriedade-da-emissao-da-nfs-e-nacional-para-optantes-do-simples-nacional/): a competência fiscal distingue documentos novos dos anteriores ao corte, inclusive em municípios com emissor próprio. Referência comercial e fim do acesso a um produto não substituem essa data fiscal.

O texto antigo bloqueava apenas pela data atual de emissão, sem explicar as competências antigas. O painel agora diferencia competência nova, competência comercial anterior ao corte e outros regimes. Para competência anterior, informa a possibilidade municipal e a necessidade de confirmar o fato gerador. **A integração administrativa ainda não modela separadamente esse fato gerador e a data do RPS**: permanece bloqueada a transmissão retroativa por esse fluxo, orientando emissão no portal e vínculo do documento existente. Não foi liberada data fictícia, conversão automática do mês comercial em fato gerador nem backdating do RPS.

## Política ATP e novembro

A política operacional de acesso aprovada em outubro não é autorização para substituir o emissor legal de competência nova. A candidata bloqueia competência >=2026-11 no modelo municipal ATP e no worker, além de data do RPS >=01/11 no transporte nativo, preservando consultas/recuperação. O acesso pode terminar em novembro se a competência e a emissão fiscal forem de outubro; isso não autoriza uma emissão municipal de competência novembro.

Essas alterações de código/worker ainda **não foram publicadas ou ativadas nesta entrega**. Nenhum gate ou política produtiva foi alterado. Leitura privada em02/11 não encontrou solicitações fiscais ATP (zero pendentes e zero emitidas). A configuração municipal de outubro precisa receber a proteção desta candidata antes de se permitir processamento de competências novas. Nacional permanece desligado; não usar liberação municipal como fallback.

## O que falta para Nacional em produção

Já existem gerador/assinatura de DPS, sequência durável, cliente HTTP restrito, consulta/reconciliação XML e armazenamento privado para o fluxo de homologação ATP. O gerador atual fixa ambiente2; não é um emissor nacional produtivo do painel administrativo.

Faltam: perfil nacional real por emitente/serviço (opção e apuração do Simples, regime especial, cTribNac e códigos municipais/NBS quando aplicáveis, ISS/retenções/transparência); série DPS produtiva própria; integração ao cadastro/cobrança e datas fiscais do painel; homologação governamental com perfil habilitado, XML, status e DANFSe oficiais; configuração e habilitação produtivas com travas/revisão/recuperação. Código municipal e série RPS não devem ser simplesmente copiados para campos nacionais.

O último ensaio restrito documentado, de27/10, foi rejeitado por parametrização E0312; não comprova homologação produtiva, nem que o mesmo bloqueio externo persista hoje. Validar novamente o cadastro/cenário e o perfil antes de uma nova transmissão autorizada. O certificado vinculado foi confirmado com validade até10/11/2026; planejar renovação antes dessa data.

## Validação e publicação

Testes sintéticos cobrem extração/isolamento/identidade/status/XXE, não reutilização de retenções e numeração, prioridade do perfil salvo e GET sem escrita/emissão. As orientações de competência têm casos antes/depois do corte e para os demais regimes. A regressão fiscal e os ensaios simulados não usam certificado real nem enviam notas, cobranças ou mensagens.

Componentes de uma eventual publicação: Next.js (formulário), API administrativa (GET/orientação/guard) e worker ATP (guard municipal), em releases coordenadas. Não atualizar SQL, MySQL, firewall, certificados ou rotinas de negócio por rotina desta publicação.

Validação final: 240/240 testes Node, zero falhas/skips; lint dos arquivos alterados; build Next16.4.3/Turbopack/TypeScript; API e runner compilados; XSD/assinatura sintética municipal CPF/CNPJ e guard de ensaio oficial, todos aprovados. A primeira regressão encontrou versão de API não suportada pelo Azurite local; a execução foi interrompida e repetida após iniciar o emulador próprio com skipApiVersionCheck, sem tocar no Azure produtivo. A regressão final inclui SDK Table/Blob e HTTP de governo/Asaas simulados.

O comando postman status desta instalação retornou unknown command; não foi usado como prova de configuração. O serviço postman simulation existente funcionou e foi exercitado nos testes HTTP. Os processos de QA próprios foram encerrados ao final, preservando seus dados/evidências locais. Não houve publicação, migração de banco, atualização do serviço fiscal ou ativação nacional nesta entrega.
