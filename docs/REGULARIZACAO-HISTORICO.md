# Regularização: histórico quitado e rascunhos

Após a confirmação de cada nota de um lote de produção, a API materializa um registro histórico pago na carteira e um rascunho na fila normal. A preparação fiscal e os testes de homologação continuam isolados. Não há envio automático.

## Datas e documentos

- `Cobranca.competencia` é o mês do pagamento histórico para agrupamento financeiro. Não redefine a competência fiscal da nota.
- `vencimento` e `envioPrevisto` preservam a referência histórica pela data do pagamento. Não representam prova de envio nessa data.
- `regularizacao.dataPagamento` é a data bancária original; `emissaoFiscal` é a data real da nota; `registradoEm`, aprovações e tentativas de envio usam o instante real.
- O pagamento é registrado uma única vez, com saldo zero e identidade do PIX. Não se fabrica evento de envio antigo.
- PDF e XML são referências aos documentos da nota confirmada, na pasta privada da mesma empresa. A mensagem informa expressamente que o serviço já foi pago.

## Contrato da API

`POST /api/admin/regularizacao-fiscal?empresa=sysney|drsoft`

A ação existente `avancar`, quando confirma uma nota de produção, também tenta organizar seu histórico. Não transmite outro documento e não envia e-mail.

A nova ação recuperável `organizar-historico` recebe:

```json
{"acao":"organizar-historico","loteId":"emissao-<sha256>","hash":"<manifesto atual>","confirmado":true}
```

Exige administrador, mesma origem, empresa e hash válidos, lote sem etapa fiscal em andamento e ao menos uma nota de produção confirmada. Pode operar em um lote antigo sem mudar sua data fiscal. Resposta: `lote`, `emailEnviado:false`, `novaDividaCriada:false` e quantidade `cobrancasPagas`.

Cada item ganha `historicoCobranca:{cobrancaId,emailId,criadoEm}`. Se a materialização falhar, a nota permanece `emitida` e o item informa `erroHistorico`. O painel oferece retomar somente a organização, sem chamar o emissor.

## Idempotência e segregação

Identidades da cobrança, plano avulso e rascunho derivam da empresa e do recebimento original, independentemente da repetição da operação. A reserva do PIX usa o mesmo namespace da conciliação normal. Um vínculo com outra cobrança bloqueia a criação.

Cobrança, rascunho e plano são criados condicionalmente. A retomada não sobrescreve destinatários, texto, aprovação ou histórico de uma mensagem já existente. Como as partições são distintas, pode haver materialização parcial; repetir a organização conclui as partes ausentes. Nenhum registro parcial nasce com dívida em aberto. ETags protegem o lote e a referência do recebimento.

O plano é avulso, com início e fim no mesmo mês, e não projeta novas mensalidades. Conciliação e carteira não somam novamente o PIX já baixado. Avisos de atraso e novas emissões fiscais ou bancárias são bloqueados para esse registro.

## Aprovações e anexos

O rascunho começa sem conferência documental, sem aprovação de envio e sem tentativas. Primeiro o administrador confere PDF e XML; depois aprova o conteúdo e os destinatários; por fim confirma o envio real. O hash inclui documentos, metadados, destinatários e conteúdo efetivo. O XML é servido e enviado como `application/xml`; PDF permanece `application/pdf`. Alterar dados financeiros ou metadados protegidos pelo editor é bloqueado.

## Publicação e lotes existentes

Publicar painel Next/SWA e API financeira juntos. Não alterar o serviço fiscal nem retransmitir notas existentes. Só depois organizar os lotes já emitidos, pela ação específica, e conferir carteira, saldo zero, anexos e ausência de aprovações/envios. A prévia local usa dados fictícios e emissores simulados; não equivale à aplicação dessa organização em produção.
