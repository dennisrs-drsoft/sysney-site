# SYSNEY — base compartilhada de site e financeiro

## Consolidação de 08/10/2026

Produção anterior: `90cb4c7` (institucional), baseado em `df544c3`.
Administrativo: `588e8ff`, `e51534a`, `7ad12cc`, posteriores à base comum e ainda fora da produção anterior.
Foi feita mesclagem dos históricos, sem recriar o commit institucional nem descartar os commits administrativos.
Também foram incorporados o painel privado PGDAS-D, consulta/download autenticados, comparação com notas fiscais e testes. Os documentos originais permanecem no armazenamento privado, não no Git.

O painel diferencia receita fiscal, receita declarada, impostos apurados, pagamentos e dívida. Valores das declarações não comprovam quitação nem dívida atualizada. Não transmite apurações, emite DAS ou repete automaticamente uma alíquota para meses futuros.

## Responsabilidade por frente

| Frente | Responsabilidade |
| --- | --- |
| Criação do financeiro SYSNEY | Administração, cobranças, histórico, fiscal e PGDAS |
| Melhore a comunicação para moda | Institucional, conteúdo comercial e SEO |
| Compartilhado / coordenado | Layout global, dependências, autenticação, configurações, workflows e publicação |

Ambas as frentes usam o repositório `dennisrs-drsoft/sysney-site`. A versão oficial é `origin/main`; o nome de um chat não determina a versão publicada.

## Fluxo de trabalho e publicação

1. Verificar alterações locais e histórico antes de editar; preservar trabalhos de terceiros.
2. Partir de `origin/main` atualizado e separar trabalhos concorrentes em worktrees. Não modificar a branch de outro chat durante execução.
3. Revisar e commitar somente o escopo autorizado, sem segredos e documentos financeiros.
4. Reunir as alterações aprovadas numa base de release descendente do `origin/main` atual, sem sobrescrever a outra frente.
5. Executar testes, TypeScript/lint/build e verificações de site público, contato, SEO, admin e segurança. Não usar envio real ou emissão real como smoke test.
6. Reservar a publicação entre os chats. O push de `main` aciona o workflow Azure Static Web Apps para TODO o Next.js, inclusive `/admin` e suas rotas-ponte.
7. Acompanhar o workflow até sucesso e conferir a versão pública e endpoints. Uma resposta 401/403 anônima de um endpoint privado é esperada; não prova que uma sessão administradora funciona.
8. Registrar SHA, workflow, resultados e limitações. Uma publicação bem-sucedida não equivale a homologação de emissão/envio fiscal.

## Componentes com publicação distinta

- Next.js institucional + `/admin` + rotas `app/api`: Azure Static Web Apps, workflow GitHub Actions.
- API financeira externa: `sysney-admin-api-2602`, script `deploy/publish-admin-api.ps1`. Publicar apenas se o runtime backend precisar mudar; imports operacionais não fazem parte do runtime.
- Serviço fiscal da DRServer: processo próprio. Não reinstalar, reiniciar ou alterar certificados numa publicação de frontend.

## Arquivos locais preservados

Scripts operacionais ainda não revisados, `output/`, documentos financeiros e scripts de instalação SSL alheios à release não devem entrar nela. A cópia compartilhada pode ter esses arquivos locais sem que sejam parte de produção. Nunca usar `git add .` indiscriminadamente.

## Evidências da release

Resultados e identificação da publicação devem ser registrados em `docs/RELEASE-2026-10-08.md` após as validações. Não confundir versão preparada com versão confirmada no Azure.

## Reforço de segurança — 18/10/2026 (implementação, ainda não publicada)

### Confirmado na produção por consultas somente leitura

- `/admin` e `/api/admin/*` exigem papel administrador no Azure Static Web Apps; a API externa exige chave privada de servidor e valida papel/origem novamente. Login GitHub sozinho não concede administração. Bloqueio anônimo confirmado em 18/10 (302/login no site, 401 na API).
- API e armazenamento exigem HTTPS; armazenamento sem acesso público a blobs, TLS mínimo 1.2. Segredos Inter/SendGrid no Key Vault, não no JavaScript do navegador.
- Documentos com versionamento, recuperação de exclusões de arquivos e contêineres por 30 dias. Cofre com RBAC, soft delete por 90 dias e purge protection. Isso NÃO protege sozinho contra perda de conta, invasor privilegiado nem perda/corrupção das tabelas.
- Aprovações, hashes, reserva de operações, controle de concorrência e histórico financeiro reduzem emissão/envio duplicados. Não constituem firewall nem teste de invasão.
- Contato institucional já exige Turnstile validado no servidor, ação/hostname, limites de campos, honeypot e tempo de preenchimento. HTML de e-mail tem escape; prévias usam iframe sem permissão de scripts.

### Novas proteções implementadas

- `seguranca-http.mjs`: leitura de upload em streaming, até 5,5 MB e 20 segundos, inclusive sem Content-Length ou com tamanho declarado falso. 400 para tamanho inválido, 408 para envio lento e 413 para excesso. As rotas conservam o limite de PDF de 5 MB.
- API externa: contador distribuído no Table Storage, com ETag, por identidade/método (300 GET/minuto e 40 POST/minuto, janela fixa). Mesma identidade nas duas empresas compartilha limite. Não usa IP nem corpo como identidade. 429 inclui Retry-After; indisponibilidade/concorrência do contador retorna 503 sem executar operação financeira. Não repetir POST automaticamente. Esta proteção NÃO é mitigação completa de DDoS nem substitui WAF/proteção na borda.
- IDs de requisição e logs estruturados para falhas/limites, sem corpo, consulta, destinatário, tokens ou senha. Headers de Retry-After e correlação preservados na ponte. Logs não incluem chave privada.
- Headers de navegador: CSP com origens restritas, bloqueio de objetos, restrição de base/formulário e incorporação por sites externos, nosniff, referrer policy, permissões sensíveis desativadas e HSTS apenas no host (sem preload/includeSubDomains). Prévia e Turnstile preservados. Scripts inline ainda permitidos para compatibilidade com shell estático Next.js; NÃO chamar essa CSP de estrita ou garantia contra XSS. Removido X-Powered-By. Administração com noindex. Server Action do contato limitada a 64 KB.
- Correção mínima de `source-map-js` 1.2.1 → 1.2.2. Auditoria de dependências de produção dos dois projetos sem alertas após a correção. Cinco alertas transitivos de desenvolvimento/lint (`braces` e cadeia) permanecem sem versão corrigida compatível disponível; não aplicar downgrade forçado do Next/ESLint. Compilação deve usar código confiável e ambiente isolado. Reavaliar atualizações; não alegar zero alertas em todas as dependências.
- Publicação passa a depender de auditoria das dependências de produção, verificação de padrões de segredos em arquivos versionados e testes de segurança. Verificação de segredos não cobre todo o histórico Git nem todos os formatos possíveis; havendo exposição, revogar/rotacionar, não apenas apagar o arquivo. Saídas e backups locais ignorados pelo Git.

### Recuperação preparada, não ativada

`admin-api/scripts/backup-financeiro.mjs` exporta as três tabelas financeiras para uma conta SEPARADA, exige contêiner privado com versionamento e retenção >=30 dias, confere checksum/contagem e restaura somente em tabelas novas de teste no destino. Não sobrescreve produção. Manifesto é gravado por último para distinguir cópia incompleta. Exportação on-line não é snapshot transacional; realizar em janela controlada e conferir vínculos. PDFs/XML exigem cópia protegida separada dos blobs, além do versionamento atual.

Modos: `criar CONTA_DESTINO`, `validar CONTA_DESTINO ID_BACKUP`, `restaurar-teste CONTA_DESTINO ID_BACKUP`; `ADMIN_STORAGE_ACCOUNT` identifica origem. Autenticação por identidade Azure, nunca senha no argumento. Arquivos não são públicos nem anexados ao Git. Contêiner e RBAC de destino precisam ser provisionados/revisados antes; o script não cria conta por surpresa. Teste sintético local não equivale a restauração real na Azure.

### Pendências que exigem decisão ou verificação adicional

1. Publicação conjunta do Next/SWA e API (autorização de implementar não equivale a autorização permanente de publicar); confirmar headers, uploads, prévia e sessão real após implantação. Não mudar VM fiscal nesta release.
2. Escolher/provisionar destino de backup independente, custo, política de retenção/cópia dos blobs e agendamento; executar restauração real e registrar resultado antes de chamar de backup operacional.
3. Usuário confirmar MFA/2FA e recuperação das contas GitHub/Azure. Não habilitar políticas que possam bloquear o único administrador sem conta de emergência e plano de recuperação.
4. Revisar RBAC efetivo, logs/alertas/retensão, firewall e acesso RDP da DRServer, atualizações do Windows e permissões das chaves fiscais. Não fechar portas nem trocar identidades/certificados sem mapear os outros sistemas da VM.
5. Avaliar WAF/controle na borda e scanner antimalware de anexos (podem gerar custo). CSP estrita com nonce exige homologação específica e impacto no shell estático. Auditoria/pentest independente continua recomendada; estes testes não são certificação OWASP.

Nenhuma cobrança/nota/e-mail real deve ser gerado por testes de segurança. Não realizar ataques de indisponibilidade contra produção.

### Evidências da implementação

Em 18/10: 138 testes automatizados aprovados; TypeScript, lint dos arquivos alterados, bundle da API e build Next.js aprovados. Teste do build local via HTTP conferiu cabeçalhos e HTTP 200 em home, contato, administração e pequenas marcas; API administrativa local anônima respondeu 401. Isso não testa renderização visual do Turnstile nem autenticação SWA na Azure. O contador foi exercitado no Table Storage real com identidade sintética: primeira chamada permitida, segunda bloqueada por outra instância; somente a linha sintética foi criada e removida, sem alteração financeira. Backup/restauro teve testes com dados fictícios, não foi executado contra produção/destino Azure. Auditoria de dependências de produção dos dois projetos retornou zero alertas; ferramentas de desenvolvimento continuam com os cinco alertas descritos. Verificação de padrões não encontrou segredos nos arquivos versionados. Nenhum certificado/PFX/PEM/chave ou `.env` foi encontrado pela consulta de nomes desses arquivos no histórico Git (não equivale a varredura integral de conteúdo histórico).

Nenhum push/deploy, mudança de login, MFA, firewall, permissões de VM ou rotação de certificado foi realizado nesta implementação.

### Publicação autorizada — 18/10/2026

Usuário autorizou implantar o reforço em produção. Release `2026.10.18.001`, código `636f30a`, mantendo a base institucional `82ba991`. Publicar Next/SWA e API externa, sem mudanças na VM, certificados, login/MFA ou novos recursos de backup/WAF. Validar bloqueios anônimos, acesso pelo canal autenticado, downloads e headers. Registrar abaixo o resultado depois da implantação; preparação não comprova publicação.
