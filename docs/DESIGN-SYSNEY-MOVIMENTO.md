# SYSNEY em movimento — direção de remodelação

Objetivo: remodelar todas as páginas públicas e entregar um design system navegável em localhost para aprovação, sem publicação. Base de trabalho: worktree sysney-site-sites-ia, checkpoint bd82003 (oferta de sites com IA preservada).

## Referências inspecionadas

1. Composição clara, curvas orgânicas, contraste verde e objetos comerciais: adotar ritmo e respiro, sem copiar marcas ou métricas.
2. Interface em perspectiva, azul/ciano e integração entre produto e serviços: utilizar capturas reais do SISBlink, sem indicadores fictícios.
3. Atmosfera escura, objeto protagonista, órbitas luminosas e tipografia expressiva: adotar profundidade e contraste editorial, preservando identidade SYSNEY.

## Sistema a implementar

- Paleta: tinta azul profunda, azul institucional, ciano, verde esmeralda, superfícies claras minerais.
- Tipografia: família expressiva para títulos e família legível para texto; escala fluida, etiquetas pequenas e numerais editoriais.
- Componentes: navegação contínua, abertura editorial, palco de produto, faixas de serviços, linhas de funcionalidades, prova comercial, jornada, FAQ, formulário, rodapé, botões e controles de som/movimento.
- Evitar repetição de grades de cards e excesso de pílulas. Alternar composições abertas, divisores, blocos assimétricos e superfícies curvas.
- Movimento: entrada ao aparecer, hover e pressionamento em controles, foco equivalente por teclado, transição de rota, objetos persistentes com parallax de scroll e ponteiro.
- Som: sintetizado localmente, ativado explicitamente, volume discreto, feedback de interação sem reprodução automática ou repetição excessiva.
- Acessibilidade: reduced-motion, pausa de animação, navegação por teclado, contraste e conteúdo disponível sem JavaScript.

## Escopo de páginas

Home, força de vendas, plataforma B2B, franquias/multimarcas, integrações ERP, pedidos de moda, compras/reposição, tour SISBlink, pequenas marcas, links, contato e manual público. Preservar conteúdo, SEO e caminhos de conversão; adaptar hierarquia e apresentação. Administração e API permanecem fora da remodelação.

## Evidências necessárias para aprovação

Galeria do design system com tokens e estados; páginas remodeladas navegáveis; movimento persistente observado entre rotas; sons testados após ativação; desktop e celular conferidos visualmente; formulário e links exercitados sem envio; reduced-motion e teclado verificados; build e regressões aplicáveis aprovados. Nenhum item é considerado concluído apenas por constar neste documento.

## Estado

Implementação em andamento no localhost:3125. Estrutura pública compartilhada, abertura editorial, páginas comerciais, fontes locais Manrope/Fraunces e fundo persistente implementados. Biblioteca ampliada com seleção, campos, validação, estado desabilitado, feedback local e especificação de ritmo/movimento.

Verificado em 05/11: design system em viewport móvel de 390 × 844; formulário demonstrativo retorna confirmação sem envio; seleção de solução funciona; som e pausa mantêm estado ao navegar por Link para a home. O teste encontrou a transição de rota congelada com opacidade baixa quando pausada; corrigida para mostrar conteúdo imediatamente. Lint da biblioteca aprovado. Ainda faltam revisão visual completa das páginas, comprovação do movimento e som, teclado/reduced-motion e build final. Objetivo ativo; nada publicado.

## Revisão visual da home e páginas internas — 05/11

Home: soluções e problemas reorganizados em linhas editoriais, números sem caixas, depoimentos com Fraunces e ritmo aberto, composição de funcionalidades e integrações revisada. Conteúdo comercial preservado. Barra móvel reposicionada acima das preferências.

Verificação visual: design system, home, pedidos de moda, integrações, contato, manual, pequenas marcas, tour e links. Celular: 390 px; menu também em 320 px, corrigido e retestado sem corte lateral. Corrigida interferência do estilo de FAQ no menu do contato. Fundo observado animando entre manual e integrações via Link; parallax de scroll confirmado em 260 px no trecho avançado da home. Preferências mantidas entre rotas.

Build Next.js e TypeScript aprovados (21 páginas); lint da home e biblioteca aprovado; 9 testes de ponte administrativa e segurança aprovados. Nenhum formulário real enviado. Pendências: auditoria final do conjunto completo, teclado/movimento reduzido e verificação do feedback sonoro. Prévia permanece em localhost, sem push/deploy.
