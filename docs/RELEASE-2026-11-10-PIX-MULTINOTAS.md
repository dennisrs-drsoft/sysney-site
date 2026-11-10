# Publicação financeira de 10/11/2026

- Código publicado no painel e na API: `a59f077abe0dc84228f6c28e060b3a01ab0e79eb`.
- Painel: [GitHub Actions 42842951615](https://github.com/dennisrs-drsoft/sysney-site/actions/runs/42842951615).
- API Azure Functions: implantação `91532f11-108b-4de9-abcf-efd3f026e0bb`. SHA-256 do pacote: `3B767E45B8B40B7DAF3BEE5002F342EEEAAF5B553F0164A022ED798BBD8DC17A`.
- Escopo: vínculo de uma ou mais NFS-e no Histórico do Inter e conciliação automática de novas cobranças PIX quando há um único recebimento compatível. Sincronização habilitada para SYSNEY e DRSoft.

O build do painel e os 43 testes passaram. Em produção, as páginas públicas, contato e sitemap responderam com HTTP 200. O painel financeiro redirecionou o acesso anônimo ao login e a API recusou acesso anônimo às rotas protegidas. O endpoint de saúde da API respondeu com HTTP 200. A validação não emitiu documentos, enviou e-mails ou realizou pagamentos.
