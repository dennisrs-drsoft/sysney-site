# Sincronização bancária SYSNEY

## Operação

- Timer Azure Functions monitora o controle a cada minuto e inicia a consulta a cada 15 minutos, independente de navegador aberto. Não usa automação de chat ou máquina local.
- “Sincronizar com o Inter agora”, na Visão geral e no Histórico do Inter, solicita execução para o próximo ciclo do servidor. O estado é acompanhado a cada 30 segundos enquanto a tela estiver aberta.
- Consulta boletos emitidos nos últimos 90 dias e revisita até 10 registros antigos por execução, em ordem da consulta mais antiga, inclusive pagos/cancelados. A conclusão não significa que todo histórico foi consultado naquele instante; cada registro conserva sua data de consulta.
- Boletos recebidos por PIX são reconhecidos conforme a situação da API. Créditos PIX avulsos são consultados no extrato e exigem regra autorizada por cobrança: CPF/CNPJ, valor integral, período e unicidade nos dois sentidos. Veja [Conciliação PIX e notas](CONCILIACAO-PIX-NOTAS.md). Não existe associação automática apenas por nome/valor.
- O acompanhamento projeta o pagamento confirmado por número único de boleto, documento do cliente, valor nominal e vencimento compatíveis. Não altera o histórico manual, não grava uma nova receita e não soma banco + manual. Cancelado/expirado não é pago.
- PDFs são preservados por Merge e campos bancários anteriores não são zerados em falha. A execução parcial registra falha e mantém o horário do último sucesso separado da última tentativa.
- Lease e ETag impedem execuções concorrentes; uma execução interrompida pode ser retomada depois de 10 minutos. Chamadas de leitura podem ser repetidas; não há POST de emissão/cancelamento no banco.

## Ativação

Somente a API externa deve receber `INTER_SYNC_SYSNEY_ENABLED=true`. O padrão desativado impede consultas em builds/testes. São usados os certificados e credenciais da SYSNEY já no cofre; nenhuma chave vai ao navegador ou Git. O timer depende do AzureWebJobsStorage da Function App e da permissão existente da identidade gerenciada no armazenamento administrativo/cofre.

DRSOFT permanece indisponível. Não habilitar sua integração por esta release. Não alterar a VM ou os certificados fiscais.

## Fontes oficiais

- [Timer trigger Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer)
- [SDK Inter Empresas](https://developers.inter.co/docs/sdks/sdk-java)
- [Situações de cobrança no Inter](https://ajuda.inter.co/conta-digital-pessoa-juridica/o-que-quer-dizer-os-status-que-constam-nos-meus-boletos-de-cobranca)

## Publicação e validação — 08/10/2026

- Versão pública confirmada: **2026.10.08.005**, commit de código `ac62c770a879e74ccba59f1bd4e737c0deb4cb28`, workflow [37777173280](https://github.com/dennisrs-drsoft/sysney-site/actions/runs/37777173280) concluído com sucesso.
- API externa publicada e flag SYSNEY ativada. Metadados dos gatilhos sincronizados; `inter-sync-sysney` registrado no Azure.
- Primeiro teste real da consulta atualizou 17 snapshots. Pedido manual via API autenticada retornou 202; o timer executou o pedido às 09:32 de Brasília, concluído às 09:32:04, atualizando 17 registros sem emissão/cancelamento bancário.
- 99 testes automatizados aprovados; TypeScript, ESLint dos arquivos alterados, build Next.js e bundle administrativo aprovados.
- Home/contato HTTP 200; admin/endpoint privado anônimos HTTP 302 para autenticação. A checagem de publicação não substitui revisão visual na sessão do usuário.
- Nenhuma mudança no site institucional, VM, certificado fiscal ou integração DRSOFT. Scripts operacionais/documentos locais permaneceram fora dos commits.

O commit posterior desta documentação usa `[skip ci]` para não repetir a publicação já confirmada. O artefato implantado permanece no SHA de código acima.
