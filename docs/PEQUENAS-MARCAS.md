# SISBlink para pequenas marcas — prévia de 15/10/2026

Estado: implementação local para revisão. Sem push, deploy ou alteração da versão pública. Publicação depende de autorização específica do usuário.

## Escopo

- Página `/sistema-vendas-pequenas-marcas`, com foco em equipes enxutas e no próprio dono atendendo clientes.
- Seção da home imediatamente após a abertura, antes dos números e marcas atendidas, para incluir esse público cedo na navegação.
- Acessos na abertura e no rodapé da home e destaque na central `/links`.
- Explicação de catálogo, pedidos por grade, revisão e acompanhamento comercial no contexto de WhatsApp, planilhas e tarefas acumuladas.
- Custo-benefício explicado por organização, redigitação e conferência. Sem preço, plano, limite de usuários, percentual de economia ou retorno garantido.
- Crescimento tratado como evolução de requisitos a avaliar com a SYSNEY, sem prometer expansão automática, migração gratuita ou condições comerciais não confirmadas.
- Canonical, metadata, Open Graph, Twitter e inclusão da página no sitemap.
- CTA para `/contato?origem=pequenas-marcas&interesse=pequenas-marcas`. Título, introdução e identificação da equipe adaptados nesse contexto. Envio, validações, proteção antispam, campos e opções existentes preservados.

O conteúdo voltado a indústrias, representantes, franquias, redes e multimarcas permanece. Nenhum caso ou prova comercial existente foi removido.

## Base das afirmações

| Tema | Evidência no projeto |
| --- | --- |
| Catálogo, produto, cor e tamanho | `/sistema-pedidos-confeccao-moda` e captura real `public/sisblink/telas/catalogo.webp` |
| Grade e conferência | Guia existente em `app/components/moda-pedido-guide.tsx`, captura real `public/sisblink/telas/grade.webp` e jornada `/sisblink-em-acao` |
| Pedidos, status e indicadores comerciais | Conteúdo de `/sistema-forca-de-vendas`, tour e dashboard existentes |
| Equipe enxuta como cenário de avaliação | Fluxo comercial por cliente e usuário; formulário já oferece “Até 5” e “Não se aplica” para representantes. Isso não comprova condição contratual ou mínimo de usuários. A adequação é avaliada com a SYSNEY. |
| Sistema atual e dados da operação | Formulário já contempla planilhas e ausência de ERP. Não se presume implantação sem integração; requisitos são definidos na avaliação. |
| Investimento | Não existe tabela pública de preços confirmada nesses arquivos. A nova frente encaminha para demonstração e proposta com escopo. |

As imagens são capturas já aprovadas e publicadas do ambiente de demonstração DRSOFT. Não foram criadas novas telas ou afirmações sobre funcionalidades.

## Isolamento

- Base: `905af2c` de `origin/main`.
- Branch local: `codex/pequenas-marcas`, no worktree `C:\Users\denni\sysney-site-telas`.
- Sem alteração em `/admin`, rotas financeiras, API externa, serviço fiscal, layout global, dependências, workflow ou configuração Azure.
- A aplicação pública e `public/version.json` continuam na versão anterior até a aprovação e publicação.

## Validação

- ESLint dos arquivos alterados e `git diff --check` aprovados.
- Oito testes existentes de autenticação/ponte administrativa, respostas e diálogos aprovados, sem emissão ou envio reais.
- Nova página, home, central de links, sitemap e contato geral/específico: HTTP 200 locais.
- Canonical, Open Graph e nova rota do sitemap conferidos.
- Contato específico usa a nova introdução e preserva a origem. Contato geral mantém a introdução anterior. Ambos exibem o formulário; não houve submissão.
- `/api/admin/status` e `/api/admin/emails` anônimos locais: HTTP 401. Não se presume homologação de uma sessão administrativa autenticada.
- Nova página conferida no navegador em 320, 390, 768 e 1440 pixels, sem overflow horizontal. FAQ aberto pelo controle nativo e navegação do CTA exercitados.
- Capturas de prévia salvas fora do repositório para revisão do usuário.
- Build de produção local (`next build --webpack`) aprovado, incluindo TypeScript, 20 páginas geradas, `/admin` e endpoints administrativos. Webpack foi usado por conta das dependências vinculadas entre worktrees; sem alteração na configuração do projeto. Não houve build ou deploy no Azure para esta prévia.

Prévia: `http://localhost:3115/sistema-vendas-pequenas-marcas` e `http://localhost:3115/#pequenas-marcas`.

Antes de qualquer publicação, atualizar a base oficial e seguir a coordenação entre site e financeiro. Autorizações de releases anteriores não se aplicam a esta frente.

## Publicação autorizada

Usuário autorizou a publicação em 15/10/2026. Release 2026.10.15.001, implementação 82ba991 sobre origin/main 905af2c. Somente Next.js no Azure Static Web Apps; sem publicação da API financeira ou serviço fiscal. Validações locais acima permanecem válidas. Resultado do workflow e conferência pública serão registrados após o deploy.

Confirmação: workflow 38758994953 concluído com sucesso; SHA publicado cf9cd76; versão pública 2026.10.15.001 conferida. Home, página nova, links, contato contextual e sitemap: HTTP 200 com conteúdo esperado. Rotas administrativas protegidas direcionam visitante anônimo para autenticação; nenhuma operação financeira executada. Não houve homologação de sessão administrativa autenticada.
