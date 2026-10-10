# Histórico fiscal e recebimentos da DRSOFT

## Escopo autorizado em 10/10/2026

Consultar todo o histórico disponível de notas municipais da DRSOFT, arquivar XML/PDF privados e criar cobranças anteriores como recebidas por declaração expressa do titular. A nota atual da TFSeven, identificada no armazenamento privado, é excluída da baixa. Nenhuma emissão, cancelamento, boleto, mensagem ou operação no banco faz parte deste processo.

## Procedimento

1. `coletar-historico-nfse-vm.ps1` aceita empresa e inscrição municipal. Obtém CNPJ e certificado fixado na configuração privada da VM; utiliza apenas consultas fiscais, paginadas mês a mês desde a primeira nota. A coleta só é considerada completa após registrar `concluido`. Não altera o serviço fiscal, IIS, certificados ou configuração da VM.
2. `importar-arquivos-historicos.mjs notas <coleta> drsoft` exige coleta completa e confere inscrição, contagem, XML e limites. Arquiva respostas e XML individuais em `historico/drsoft/nfse`, indexando `nfse-historico-drsoft`. Baixa PDFs oficiais com concorrência máxima de dois; falhas ficam registradas no manifesto, sem reemissão. Reexecução preserva PDFs já recuperados.
3. `importar-cobrancas-fiscais-drsoft.mjs <coleta> <notas-excluidas> previa` apresenta o planejamento sem gravar. A execução com `gravar` guarda antes um snapshot privado de recuperação e cria/atualiza cobranças com controle de versão. Notas canceladas não recebem cobranças pagas. Exige identificação fiscal única e a presença da nota atual excluída na coleta.

## Significado dos dados

- Pagamento confirmado pelo titular, **não pelo Banco Inter**. Sem data bancária, o evento de recebimento tem data vazia e registra apenas quando a confirmação foi importada. Não participa de análise de pontualidade nem comparação de pagamentos por data.
- Vencimento antigo desconhecido permanece vazio. Não presumir que todos os clientes tinham o vencimento atual.
- Novos planos históricos começam e terminam no mesmo mês: não geram cobranças futuras. O mês da emissão indexa o registro; `competenciaConfirmada=false` indica que não comprova a competência real do serviço.
- Notas já vinculadas a cobranças não são duplicadas. Valores divergentes, estornos ou vínculos múltiplos impedem a gravação e exigem revisão.
- Arquivos e índice fiscal usam as telas existentes. Para localizar cobranças sem vencimento histórico, usar a visão geral por **emissão / registro de documentos**, ou limpar o período.
- Receita fiscal não comprova pagamento de imposto. Baixar XML/PDF e registrar recebimento não gera guias nem quita tributos.

## Testes

`tests/historico-fiscal-recebido.test.mjs` verifica exceção atual, cancelamento, reexecução, datas desconhecidas, ausência de recorrência futura, divergência e estorno. Nenhum teste acessa banco, transmite nota ou envia e-mail.

Publicação de código depende de autorização própria. Importação autorizada no armazenamento privado aparece nas telas já publicadas, sem alterar componentes do site institucional.
