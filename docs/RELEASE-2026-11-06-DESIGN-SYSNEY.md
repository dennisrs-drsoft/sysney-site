# Publicação conjunta do Design System — 06/11/2026

- Azure Static Web Apps: commit `e7216a1a52543b9b8463880c9f4452421b5727ec`, [workflow 42154481830](https://github.com/dennisrs-drsoft/sysney-site/actions/runs/42154481830), concluído com sucesso.
- Administrativo: paleta isolada em /admin, tipografia Manrope e Fraunces, navegação, tabelas, formulários, estados, confirmações e menu móvel.
- Site público: três caminhos no contato geral e ajuste de texto do laboratório do Design System.
- Validação: build Next.js 16.4.3, lint dos arquivos TSX alterados, 11 testes de segurança, verificação de segredos e Chrome com cobrança sintética, navegação, foco, menu móvel e contato.
- Produção: home, contato, Design System, robots e sitemap retornaram 200. /admin, /api/admin/status e /api/admin/nfse redirecionaram acesso anônimo para login.
- O lint amplo do administrativo apontou um erro preexistente em atp-fiscal.tsx. A API financeira externa e a VM não foram publicadas nesta entrega.
