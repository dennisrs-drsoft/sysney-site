# Ordens de serviço

Módulo privado separado por empresa. Contrato: `postman/ordens-servico.openapi.json`. Rota Next/SWA e backend externo compartilham o mesmo handler; ambos precisam ser publicados para uso on-line. Sem mudanças na VM fiscal ou integrações bancárias.

## Cálculo e regras

Por cliente: hora/diária em centavos (null indica não configurada), mínimo por atendimento, incremento de arredondamento em minutos e acréscimo comercial em pontos-base. O lançamento congela a regra; editar uma regra não recalcula atendimentos existentes. Alteração de atendimento aberto mantém o snapshot original. Quantidades de diárias têm duas casas decimais; valor fixo em centavos.

Hora: duração entre data/hora inicial e final menos intervalo. Aplica mínimo e arredonda para cima conforme incremento. Virada de dia exige data final explícita; limite de sete dias por lançamento. O cálculo usa frações inteiras de centavo (denominador 300) e BigInt para preservar frações de hora. Arredonda subtotal e total no fechamento; o adicional apresentado é a diferença entre total e subtotal. Não é motor de DAS ou apuração fiscal.

## Persistência e proteção

O registro de regras aceita `preferencias` opcional com `email`, `cc`, `pixChave` e `pixBeneficiario`, strings editáveis, validadas e segregadas por empresa/cliente. `acao=regras` usa a mesma versão/ETag para evitar perda concorrente. Omissão preserva preferências existentes; strings vazias removem o padrão. Não modifica regras congeladas, lotes nem cobranças anteriores. A tela preenche novos formulários com os padrões salvos e envia os valores revisados explicitamente em `acao=cobrar` (incluindo `cc`). O rascunho congela esses dados; salvar preferências não envia mensagens nem cria cobranças. Não armazenar contatos reais no código ou contrato público.

AdminDocumentos, partição `os-{empresa}`: regras, atendimentos, índices de identidade, reservas de lote e marcador de importação histórica. UUID de operação para gravações e controle de versão/ETag. Identidade repetida de cliente/data/horários/tipo/descrição é bloqueada transacionalmente. Cancelamento é lógico e mantém esse índice e o histórico.

Somente atendimentos abertos, do mesmo cliente e com as mesmas regras entram numa cobrança; máximo 40. Histórico já faturado, reservados, cancelados e já vinculados ficam bloqueados. Relatórios históricos podem ser consultados sem nova cobrança.

A preparação reserva lote e atendimentos numa única transação. Em seguida cria plano avulso, cobrança e rascunho com relatório PDF em registros de IDs determinísticos. O rascunho exige emissão/conferência da nota e, quando aplicável, boleto antes de aprovação/envio. Não há chamadas a emissão fiscal, banco ou SendGrid no módulo. Persistência entre tabelas não é transação distribuída: em falha os atendimentos permanecem reservados e `retomar` conclui o mesmo lote. Não sobrescreve destino diferente nem repete POST com novo ID automaticamente.

`POST acao=retomar` exige id do lote, confirmado=true e operacaoId UUID. Nunca libera reserva sem revisão; não há exclusão física ou cancelamento automático de documento fiscal.

## Histórico e arquivos

### Importação de novos atendimentos por Excel

POST binário na mesma rota, `acao=prever-excel` ou `acao=importar-excel`, `clienteId` obrigatório e MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Limite de 2 MB, 40 atendimentos, 2.000 linhas XML, 200 entradas ZIP, 4 MB por entrada descompactada e 20 MB totais declarados. Inflação limitada, CRC conferido, sem extração em disco; macros, conteúdo externo, DTD e entidades customizadas rejeitados. Não executa fórmulas nem interpreta conteúdo como instruções.

Formato inicial: aba OSS, A=data (Excel 1900/1904 ou dd/mm/aaaa), B=início, C=fim; descrição em A na linha seguinte. Importa por hora, intervalo zero; diárias/fixos e intervalos precisam do formulário manual. Não inventa virada de dia, data ou descrição. Fórmulas em entradas são bloqueadas; valores calculados de G, quando disponíveis, servem apenas para aviso de divergência. Recalcula pelas regras atuais do cliente. Mantém dias reais, independentemente do nome do arquivo.

Validação local: TypeScript, lint dos arquivos alterados, bundle da API e sintaxe OpenAPI aprovados. Testes de domínio/store/importador e barreiras de segurança aprovados; incluem limites, XML externo/macros, datas inválidas, versões, repetição e confirmação. Prévia do arquivo original, sem gravação, reconheceu seis serviços existentes, zero novos e zero erros. Handler compilado da API confirmou 401 sem papel, 403 para origem externa, 413 acima do limite, 400 para arquivo falso e 200 na prévia autenticada por contexto local de teste. Isso não simula sessão visual SWA; publicação e teste da interface em produção ainda pendentes para esta extensão.

Prévia não grava. Confirmação envia novamente o mesmo arquivo, `versao` das regras, `operacaoId` UUID e `confirmado=true`. Linhas inválidas bloqueiam o arquivo inteiro. Repetições exatas e horários já cadastrados aparecem como ignorados, sem sobrescrita; possíveis repetições por horário com descrição diferente pedem conferência manual. A transação cria todos os novos atendimentos e índices, marcador SHA256 por cliente/empresa e verifica ETag da regra. Até 82 ações por transação, abaixo do limite Azure. Reimportar o mesmo arquivo não duplica. Não cria plano, cobrança, nota, boleto, e-mail ou pagamento. A origem de cada registro mantém hash e linha; o XLSX original não é armazenado pelo importador.

Importação histórica operacional não é ação exposta na API: valida cliente, regras, total e nota; cria atendimentos imutáveis e índice de importação, sem plano/cobrança/pagamento novo. Documentos e dados reais ficam na base privada/saídas ignoradas, não no repositório público.

Relatório gerado com pdf-lib, texto quebrado por largura e páginas adicionais. Arquivos novos de cobrança ficam no contêiner privado `admin-anexos`, caminho próprio por lote; links passam por autenticação. GET de relatório não salva nem emite nada. Bytes de PDF não são assinatura digital fiscal nem substituem a NFS-e oficial.

## Validação

Testes de domínio e store exercitam frações, minutos, mínimo, diária ausente, valor fixo, snapshots, versão antiga, deduplicação, reserva, falha parcial/retomada, histórico idempotente e criação apenas de rascunho. Store é exercitado com repositório transacional e blobs em memória; isso não prova transporte/concorrência do Azure real. A importação autorizada foi conferida separadamente no armazenamento real, sem gerar cobrança. Conferência visual do relatório real realizada. Homologação da interface e preparação de nova cobrança em produção continuam dependentes de publicação e aprovação separadas.

## Publicação — 21/10/2026

Publicação autorizada pelo usuário e concluída: versão `2026.10.21.001`, código `eacf89f`, workflow SWA `39672362894` com sucesso. API externa `sysney-admin-api-2602` publicada separadamente pelo script revisado, sem implantação na VM fiscal. Base anterior `c24eed2` preservada.

Quarenta testes aprovados nesta release; build Next.js, bundle da API, TypeScript e verificações locais anteriores aprovados. Auditorias de dependências de produção de ambos os projetos sem alertas; isso não equivale a ausência de alertas nas ferramentas de desenvolvimento. Contrato OpenAPI validado sintaticamente; governança Postman não executada por exigir login.

Verificação on-line somente leitura: versão pública correta; home, contato, links, pequenas marcas, robots e sitemap HTTP 200. Admin e sua API sem sessão redirecionam ao login; API externa sem chave HTTP 401 confirmado por uma asserção Postman. Pelo canal de servidor autorizado, ordens e status existentes das duas empresas retornaram HTTP 200; seis registros históricos vinculados à nota 49 e relatório privado com assinatura PDF válida. Nenhum POST financeiro, emissão fiscal, boleto, envio de e-mail ou registro de pagamento foi executado. Não foi simulada sessão visual do usuário no SWA; validação funcional da interface pelo usuário continua recomendada.

### Extensão publicada — importação Excel e padrões de cobrança

Autorizada e publicada em 21/10/2026: versão `2026.10.21.002`, implementação `64eff56`, SHA de release `6aba6a403932621b215c9c9424fd3ea6392f4431`, workflow `39682819661` concluído com sucesso. API externa publicada separadamente, sem alteração na VM fiscal. Quarenta e cinco testes locais aprovados, lint/TypeScript/bundle e contrato sintático aprovados; auditorias de produção dos dois projetos sem alertas. A compilação e as barreiras CI também passaram. Avisos de atualização das actions/runner continuam acompanhamento separado, sem mudança nesta release.

Produção conferida por canal autorizado de servidor: preferências privadas do cliente corretas; prévia XLSX HTTP 200 com seis registros repetidos, zero novos e zero erros; importação NÃO confirmada. PDF privado e status das duas empresas HTTP 200. Site público, contato, links, pequenas marcas, robots e sitemap HTTP 200, versão pública correta, admin e API SWA sem sessão HTTP 302/login. Não foram criados atendimentos de teste, cobranças, notas, boletos ou mensagens. A validação não simula a sessão visual do usuário no SWA; o usuário fará o teste da interface/importação de novos serviços.
