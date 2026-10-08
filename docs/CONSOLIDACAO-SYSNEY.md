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
