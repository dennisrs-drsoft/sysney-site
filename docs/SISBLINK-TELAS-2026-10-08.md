# SISBlink em ação — capturas e páginas públicas

Base de trabalho: `1756432` de `origin/main`, em worktree separado, branch `codex/sisblink-telas-fullhd`.

## Conteúdo

- Nova página `/sisblink-em-acao`, com apresentação da plataforma, galeria navegável e ampliação das telas.
- Destaque de atendimento ao vivo na home e na página de pedidos para confecção e moda.
- Catálogo e dashboard atuais nas seções públicas; nenhuma exclusão de conteúdo comercial.
- Metadata com canonical, Open Graph, Twitter e inclusão da nova rota no sitemap.
- Comunicação sobre especialização, qualidade demonstrável, implantação, escopo, suporte e comparação de investimento; sem alegação de exclusividade de mercado, superioridade absoluta ou desconto não comprovado.

## Capturas

Telas reais de `drsoft.sisblink.com`, tenant autorizado DRSOFT. SYSNEY é a desenvolvedora do SISBlink; não foi alterada artificialmente a marca exibida no ambiente.

| Arquivo público | Dimensões | Conteúdo |
| --- | --- | --- |
| `public/sisblink/telas/catalogo.webp` | 1920 × 1080 | Catálogo, produto, cor, grade e prazo |
| `public/sisblink/telas/shopping.webp` | 1920 × 1080 | Vitrine e sacola do shopping |
| `public/sisblink/telas/grade.webp` | 1920 × 1080 | Fotos, disponibilidade e quantidades por tamanho |
| `public/sisblink/telas/confirmacao.webp` | 1585 × 1080 | Revisão e etapas da confirmação |
| `public/sisblink/telas/dashboard.webp` | 1920 × 1080 | Resumo comercial e metas |
| `public/sisblink/telas/espelhamento.webp` | 1920 × 1080 | Catálogo sincronizado, sugestão de grade e chat |

Todas as telas foram abertas com viewport 1920 × 1080. A revisão foi recortada na captura para excluir a coluna de dados cadastrais, incluindo CNPJ. As demais preservam a tela inteira. As imagens foram convertidas para WebP, mantendo as dimensões.

Pedido de demonstração existente: 168722. Não houve alteração de quantidades, envio de mensagens, sugestões, confirmação de pedido, e-mail ou WhatsApp. A sala temporária de espelhamento foi aberta com autorização específica do usuário e encerrada ao concluir; o sistema confirmou que link, QR Code, chat e áudio não aceitam novas operações. Tokens de acesso não fazem parte das imagens nem do código.

Os valores das capturas pertencem ao ambiente de demonstração e não representam preço do software nem resultados prometidos. As legendas deixam esse contexto explícito.

## Publicação

Publicação autorizada pelo usuário e concluída em 08/10/2026. Versão pública `2026.10.08.007`, commit de release `cad9af71c26d3042843e0ab02d775358656f0ebf`, preservando a base financeira `1756432`. Workflow [37846508240](https://github.com/dennisrs-drsoft/sysney-site/actions/runs/37846508240) concluído com sucesso. Apenas Next.js/Azure Static Web Apps foi publicado; não houve deploy da API externa nem do serviço fiscal da VM.

Home, nova página, pedidos para moda, contato, sitemap, robots e as seis imagens responderam HTTP 200. A galeria publicada foi conferida no navegador. Canonical e nova rota do sitemap confirmados. `/admin`, `/api/admin/status`, `/api/admin/clientes` e `/api/admin/emails` anônimos continuam redirecionando à autenticação GitHub (HTTP 302). Isso confirma a proteção anônima, não homologa uma sessão administrativa autenticada nem o envio do formulário.

Os 105 testes existentes passaram antes do push, sem envio ou emissão reais. O build normal da aplicação foi aprovado no workflow Azure, além do build local com webpack.

## Validação local

- Build de produção com `next build --webpack`: aprovado, incluindo páginas públicas, contato, `/admin` e rotas administrativas.
- TypeScript (`tsc --noEmit`), lint dos arquivos alterados e `git diff --check`: aprovados.
- Oito testes existentes de ponte administrativa, resposta e diálogos: aprovados, sem operações reais.
- Home, contato, nova página e sitemap responderam 200. Formulário de contato presente; canonical e nova rota do sitemap conferidos.
- Endpoints administrativos anônimos conferidos localmente, sem autenticar nem executar operações financeiras.
- Página conferida em 1920 × 1080 e 390 × 844, sem overflow horizontal no celular. Troca de tela, abertura/fechamento da ampliação e Escape conferidos; imagens carregadas.
- A compilação padrão com Turbopack rejeitou o vínculo local de `node_modules` para fora do worktree. O build com webpack foi utilizado para validar a cópia isolada, sem alterar dependências, configuração do projeto ou workflow. A release deve executar o build normal no checkout de publicação, com dependências locais.
- Esta verificação não homologa uma sessão administrativa autenticada no Azure nem envia o formulário de contato.
