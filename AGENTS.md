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

- Autorização do usuário em 02/10/2026: pode fazer commits locais de checkpoint quando necessário. Revisar os arquivos incluídos e não versionar segredos ou documentos financeiros. Esta autorização não inclui push ou publicação.
- Antes de alterações grandes, sugerir checkpoint com Git.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->
