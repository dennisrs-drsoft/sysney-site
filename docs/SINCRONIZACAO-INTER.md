# Sincronização bancária SYSNEY e DRSOFT

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

Na release original de 08/10/2026, DRSOFT permanecia indisponível. A preparação de 17/10/2026 estende as mesmas rotinas por empresa: `INTER_DRSOFT_ENABLED=true` habilita o cliente da DRSOFT após validar suas credenciais, e `INTER_SYNC_DRSOFT_ENABLED=true` habilita seu timer separado. Essas flags não são ativadas por build/testes. Não alterar a VM ou os certificados fiscais.

## Preparação DRSOFT — 17/10/2026

- Credenciais individuais no Key Vault com prefixo `inter-drsoft`; certificado/chave conferidos e autenticação real de leitura e permissão `boleto-cobranca.write` validadas, sem emissão.
- Histórico, PDFs privados, controle/lease, conciliação PIX, regras e vínculos fiscais usam partições próprias por empresa. Eventos manuais nunca são somados novamente à confirmação bancária.
- Consulta de geração considera somente boletos da empresa selecionada; configuração privada `emissao-boleto/drsoft` e aprovação explícita são necessárias. Nenhuma autorização automática de envio de e-mail.
- `POST /api/admin/historico-inter?empresa=sysney|drsoft` aceita `sincronizar`, `cruzar-notas`, `regra-pix`, `vincular-pix` e `recuperar-pdf`. Exige administrador e mesma origem. Recuperar PDF é exclusivamente GET no banco, inclusive para boletos pagos; falha não reemite nem substitui arquivo por HTML.
- O botão “Tentar baixar PDF” recupera documentos pendentes no histórico. Repetições de recuperação com arquivo existente não emitem nem duplicam documentos.
- Importação operacional: `admin-api/scripts/importar-inter-empresa.mjs empresa inicio fim`; percorre janelas de até 90 dias, preserva partições financeiras manuais e registra PDFs indisponíveis para nova tentativa. Não infere competência a partir do pagamento.
- Teste opcional do cliente HTTP real com dados fictícios: iniciar `postman simulation run postman/simulations/inter-read.sim.yaml --port 4900 --no-history --output ndjson` e executar `node tests/inter-http-simulacao.mjs`. O cofre é substituído no teste, mas o cliente HTTP, paginação e leitura de PDF são reais contra o simulador. Sem login Postman, não houve busca de mock do proprietário; o recorte foi baseado no contrato público Inter v3 e nas chamadas já existentes. Nenhuma simulação foi publicada.

As evidências locais e bancárias não significam publicação concluída: confirmar deploy da API e Next.js, ativação das flags e teste autenticado antes de declarar a rotina automática disponível on-line.

### Evidências da preparação

Em 17/10/2026, a importação autorizada consultou janelas de 01/01/2020 a 17/10/2026 e armazenou 316 snapshots e 316 PDFs oficiais, sem pendência de download; 215 vínculos com notas fiscais existentes. Uma execução manual da rotina atualizou 14 snapshots e identificou três recebimentos PIX, sem criar vínculo automático não autorizado. Foram preservadas 870 baixas manuais; não houve pagamento bancário somado novamente a essas baixas. “Marcado recebido”, cancelado e expirado não foram tratados como confirmação de liquidação.

126 testes automatizados aprovados; TypeScript, lint das alterações, bundle administrativo e build Next.js concluídos. A base institucional posterior de pequenas marcas foi incorporada por fast-forward, sem alterações nas páginas públicas. A simulação Postman local exerceu o cliente HTTP real para listagem/PDF nas duas empresas com dados fictícios e cinco requisições registradas no simulador (autenticação e consultas). Testes de geração foram simulados; no banco real apenas autenticação/permissão e GETs foram executados. Nenhum boleto, nota ou e-mail real emitido/cancelado nesta preparação. Nenhuma publicação efetuada por esta etapa.

## Publicação autorizada — 17/10/2026

Usuário autorizou publicação e ativação automática da DRSOFT. Release preparada `2026.10.17.001`, código `908ec75`, preservando a base institucional `906d415` e a página para pequenas marcas. Reserva confirmada pela frente institucional. Publicar somente Next.js/SWA e API externa; não alterar a VM fiscal. Habilitar no servidor as flags DRSOFT e a configuração privada de emissão, sem liberar emissão sem revisão/aprovação. Resultado e evidências on-line serão registrados após conclusão.

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
