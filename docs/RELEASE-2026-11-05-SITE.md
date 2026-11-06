# Release pública SYSNEY - 05/11/2026

Autorização: usuário aprovou o laboratório visual, o PDF antes/depois e pediu ajuste e publicação.
Base de produção preservada: origin/main 34d6a87. Financeiro confirmou ausência de release concorrente.

Escopo: identidade azul e novo cisne, SVGs, motion e áudio opcional, capturas reais, oferta de sites com IA, encerramento renovado e /remodelacao-de-sites com caso SYSNEY. Contato identifica criação e remodelação; sitemap inclui nova página.

Validação: next build --webpack aprovado (22 páginas estáticas); lint dos arquivos alterados aprovado; 12 testes de segurança/admin aprovados; scanner de segredos aprovado. HTTP local: home, remodelação, contato, robots e sitemap 200; API admin anônima 401. /admin local é shell estático; controle Azure será verificado em produção. Nenhuma mensagem, cobrança ou documento fiscal real emitido.

Auditoria npm: nenhum alerta alto/crítico no app e admin-api; permanecem alertas baixos/moderados das dependências existentes. Nenhuma alteração de dependências nesta release.

Deploy: somente aplicação Next.js (público + shell administrativo/rotas ponte) pelo GitHub Actions/Azure Static Web Apps. API financeira externa e VM fiscal não serão publicadas. Evidência final de workflow e SHA será registrada após confirmação.

## Publicação confirmada

- SHA implantado: 091b76e5ea863df9136d8f347584262c342d5969.
- Workflow concluído com sucesso: https://github.com/dennisrs-drsoft/sysney-site/actions/runs/42133499196.
- Produção: home e /remodelacao-de-sites HTTP 200 com novo conteúdo; contato de remodelação HTTP 200 e título correto; sitemap contém nova rota; robots e SVG HTTP 200.
- /admin e /api/admin/status anônimos redirecionam 302 para autenticação GitHub, conforme proteção Azure. Não foi revalidada uma sessão administrativa autenticada nem enviado formulário real.
- Revisão visual desktop e mobile do build; página publicada conferida no navegador. API financeira e VM fiscal não foram implantadas.

## Correção do retorno ao início

SHA 339e823d906f6dd1a1fc0f548bdac04b168dbd7b: home usa destino explícito #inicio com âncora nativa. Build aprovado e 11 testes admin/segurança aprovados. Workflow https://github.com/dennisrs-drsoft/sysney-site/actions/runs/42135123573 concluído com sucesso. Clique no rodapé em produção confirmado no navegador: hash #inicio e scrollY 0. Contato e sitemap 200; admin/API anônimos 302 para login. Somente Next.js publicado.
