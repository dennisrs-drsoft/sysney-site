# Regularização fiscal — planejamento documental

## Uso no painel

Em `/admin`, escolha a empresa e abra **Regularização fiscal**.

1. Confira o recebimento e eventuais notas candidatas em **Revisar e planejar**.
2. Informe a competência real e a evidência (contrato, memória de cálculo ou e-mail).
3. Escolha uma data pretendida para regularizar a documentação. O cronograma agrupa os registros sem nota pelo mês desta data; não altera o serviço nem o PIX original. Pode-se planejar duas notas por mês sem presumir uma autorização fiscal ou agendamento automático.
4. Registre nas observações a orientação recebida da contabilidade para aquele pagamento.
5. Selecione os recebimentos revisados e prepare o lote pago, sem emitir. A estimativa por percentual é somente cenário, não cálculo oficial, guia, dívida ou transferência de receita antiga para o mês atual.

O cronograma considera todo o histórico carregado da empresa, independentemente do filtro de recebimentos. Notas vinculadas saem do cronograma documental, mas o vínculo não comprova declaração ou quitação tributária.

## Limites e bloqueios preservados

- Lotes permanecem aguardando validação fiscal; não há transmissão fiscal em lote nem envio real do comunicado implementados neste fluxo.
- Não emitir documentos, boletos, guias ou e-mails como teste desta tela.
- Não inventar data de prestação atual para serviço antigo, nem criar um RPS presumindo que existiu na época.
- A contabilidade deve confirmar o procedimento de emissão tardia com a Prefeitura e as apurações originais que exigem correção, considerando o regime aplicável em cada período.
- Não há nova dívida do cliente; o recebimento já está pago.
- Revisar notas existentes antes de nova emissão e preservar os controles de duplicidade, concorrência e isolamento por empresa.

## Release 2026.10.08.004

Escopo: cronograma documental e explicação da validação contábil pendente. Somente Next.js; sem mudança na API financeira externa, serviço fiscal da VM, certificados ou dados financeiros persistidos. A publicação será confirmada pelo workflow e por `/version.json`, não pela existência deste arquivo.
