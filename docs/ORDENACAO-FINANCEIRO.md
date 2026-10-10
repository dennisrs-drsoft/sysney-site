# Ordenação das listagens financeiras

Os cabeçalhos da carteira, acompanhamento, histórico Inter, histórico fiscal e tabela de faturamento permitem ordenar os dados apresentados. A seta indica a coluna/direção; cada clique alterna crescente e decrescente. Botões são acessíveis por teclado e os cabeçalhos expõem `aria-sort`.

- Carteira, acompanhamento e Inter: padrão de vencimento decrescente.
- Notas e faturamento fiscal: padrão de emissão decrescente, pois NFS-e não informa vencimento de cobrança.
- Valores vazios/desconhecidos ficam ao final nas duas direções. Empates usam emissão/nota mais recente quando disponíveis, sem criar datas presumidas.
- Ordenação acontece após os filtros e antes da paginação. Alterar a ordem retorna à primeira página das tabelas paginadas.
- Carteira: “Valor / saldo” ordena o valor total; acompanhamento: “Saldo” ordena o saldo aberto. Cabeçalhos compostos usam seu primeiro dado (cliente, nota ou envio previsto). Seleção de notas e links de arquivos não são colunas de ordenação.
- Ordenar não altera totais, registros, aprovações ou documentos; não consulta banco nem envia mensagens. A seleção de notas usa o número fiscal e permanece intacta após reordenar.

Testes: ordenação numérica e portuguesa, dados ausentes, desempate, imutabilidade e ordenação global antes da paginação. Tipos/lint verificados. Publicação do frontend depende de autorização separada; não há mudança de API nem da VM.
