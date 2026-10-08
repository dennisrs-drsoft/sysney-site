# SYSNEY Site - AGENTS.md

## Projeto

Este projeto é o site institucional da SYSNEY Informática, desenvolvido em Next.js, TypeScript e Tailwind CSS.

O objetivo principal é apresentar a SYSNEY, o SISBlink, suas funcionalidades, integrações e captar leads através da página de contato.

## Regras gerais

- Nunca alterar arquivos sem explicar antes o plano.
- Nunca remover conteúdo existente sem justificar.
- Preservar identidade visual premium, B2B, corporativa e tecnológica.
- Usar português do Brasil em textos visíveis ao usuário.
- Manter linguagem comercial clara, profissional e direta.
- Evitar textos genéricos demais.
- Priorizar SEO, performance, responsividade e conversão.

## Stack

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Azure Static Web Apps
- GitHub Actions
- SendGrid para formulário de contato

## Padrões visuais

- Fundo escuro premium em seções principais.
- Paleta azul, ciano, verde e tons escuros.
- Cards com bordas suaves, sombra discreta e aparência profissional.
- Layout responsivo para desktop, tablet e mobile.
- Usar `next/image` para imagens.
- Evitar imagens cortadas de forma agressiva.
- Usar `object-contain` quando for importante preservar a tela completa.

## Páginas atuais/importantes

- `/` Home institucional
- `/contato` Formulário de contato e demonstração
- `/suporte/confirmacao-whatsapp` Manual visual para representantes

## Formulário de contato

- O formulário usa SendGrid.
- Nunca expor API Key no frontend.
- Variáveis de ambiente esperadas:
  - `SENDGRID_API_KEY`
  - `SENDGRID_FROM_EMAIL`
  - `SENDGRID_TO_EMAIL`

## SEO

Sempre que criar uma página nova:

- Definir `metadata.title`
- Definir `metadata.description`
- Usar títulos claros
- Pensar em compartilhamento por WhatsApp, LinkedIn e Google

## Git

## Coordenação entre site e financeiro — 08/10/2026

- A fonte única de produção é `origin/main`. Site institucional e `/admin` integram a mesma aplicação Next.js e o mesmo deploy Azure Static Web Apps; não publicar uma cópia antiga de uma frente sobre a outra.
- O chat “Criação do financeiro SYSNEY” cuida de `app/admin`, `app/api/admin`, bibliotecas/testes financeiros e `admin-api`. O chat “Melhore a comunicação para moda” cuida das páginas públicas, componentes comerciais e SEO. Os chats são frentes de trabalho, não versões independentes de produção.
- Antes de começar, consultar `docs/CONSOLIDACAO-SYSNEY.md`, `git status`, histórico e `origin/main`. Trabalhos novos devem partir da base consolidada, em branches/worktrees próprios quando houver concorrência. Não trocar a branch de um checkout em uso por outro chat.
- Coordenar previamente alterações em layout compartilhado, dependências, autenticação, configuração Azure, workflows e deploy. Nunca incluir automaticamente alterações de outra frente num commit.
- Publicações são serializadas: anunciar o início aos chats envolvidos, verificar que não há outra publicação em andamento e incorporar a versão atual de `origin/main` antes do push. Sem force-push ou reset destrutivo.
- Validar build, testes aplicáveis, páginas públicas/contato/SEO e `/admin`/autenticação/endpoints em cada release, mesmo quando apenas uma frente mudou. Testes não devem enviar cobranças nem emitir documentos reais.
- A API financeira externa e o serviço fiscal na VM têm deploy separado; não executá-los por rotina quando somente o Next.js mudou. Registrar os componentes efetivamente publicados e o SHA.
- Manter segredos, PDFs/XML financeiros, certificados, arquivos de saída e scripts operacionais não revisados fora dos commits. Checkpoints recuperáveis não substituem commits revisados.
- A autorização de 08/10/2026 cobre esta consolidação, documentação, commits e publicação; não constitui autorização permanente para futuras publicações.

- Autorização do usuário em 02/10/2026: pode fazer commits locais de checkpoint quando necessário. Revisar os arquivos incluídos e não versionar segredos ou documentos financeiros. Esta autorização não inclui push ou publicação.
- Antes de alterações grandes, sugerir checkpoint com Git.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->
