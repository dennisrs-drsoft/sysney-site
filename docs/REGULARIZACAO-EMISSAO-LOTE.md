# Emissão em lote de recebimentos já pagos

Implementação de 25/11/2026. A preparação e os testes desta alteração não emitiram notas reais, não alteraram recebimentos de produção e não enviaram e-mails.

## Operação no painel

1. Escolha a empresa e abra **Regularização fiscal**.
2. Na lista de recebimentos importados, selecione pagamentos sem nota vinculada ou candidata. Para o procedimento de duas notas por mês, selecione somente os dois pagamentos mais antigos que deseja documentar agora.
3. Confira o modelo fiscal, a série exclusiva, o endereço e os tributos do cliente. Modelos salvos pertencem à empresa selecionada; escolher outro modelo não copia o endereço de outro cliente.
4. Clique em **Preparar lote — sem emitir**, confira o resumo e salve. Cada pagamento gera uma nota; um lote admite até 30 pagamentos do mesmo cliente.
5. Abra o lote e clique em **Validar prévias — sem emitir**. O Nacional reserva/assina a DPS sem transmitir. O municipal prepara o RPS e chama o teste oficial sem emitir nota real.
6. Confira as prévias e aprove explicitamente a emissão. O processamento é sequencial e a numeração real vem do emissor. Mantenha a tela aberta; fechar ou parar impede as próximas etapas, mas uma solicitação já enviada pode terminar.
7. Em retorno incerto, use **Consultar a mesma nota — sem reemitir**. Nunca crie outro lote para contornar uma tentativa pendente. A nota confirmada, XML e PDF ficam vinculados ao PIX original; PDF pendente é recuperado por consulta.

A data fiscal e a competência fiscal são a data corrente de emissão, segundo a orientação confirmada pelo usuário. A referência antiga do serviço e a data real do pagamento permanecem preservadas. Não há agendamento automático mensal, novo recebível, boleto, PIX de cobrança ou envio de e-mail.

O emissor segue o regime vigente e a orientação já configurada: SYSNEY no Nacional e DRSoft municipal. Este módulo não migra a DRSoft para o Nacional nem muda o enquadramento tributário. As políticas protegidas, a homologação por perfil e as autorizações de produção continuam obrigatórias.

## Persistência e prevenção de duplicidade

- `regularizacao-{empresa}`: pagamentos, reservas por pagamento/identidade PIX e lotes com manifesto, versão, aprovação e trava ETag.
- `regularizacao-documentos-{empresa}` e `regularizacao-controles-{empresa}`: contextos técnicos dos emissores existentes, separados das filas reais de e-mail e da carteira de cobranças.
- `regularizacao-vinculos-{empresa}`: vínculo exclusivo entre nota confirmada e pagamento.
- Trabalhos, sequências e provas fiscais continuam nas tabelas/partições dos emissores existentes. O Nacional registra `origem=regularizacao`, validada também no worker e no transporte nativo. Trabalhos legados sem origem continuam usando a fila comum.
- Falha, perda de resposta, aprovação em outra aba e trava vencida não autorizam retransmissão automática. A recuperação aceita um vínculo já salvo apenas quando ele corresponde à nota confirmada do mesmo trabalho fiscal.
- Homologação concluída com XML e PDF pode originar nova versão para produção. A versão anterior e seus trabalhos/documentos permanecem preservados; não se reutiliza a aprovação de teste.
- Lotes sem tentativa real podem ser revisados; data fiscal vencida exige revisão. Um lote parcialmente transmitido não é substituído automaticamente.

## Validação executada

- Testes de lotes para as duas empresas com tabelas em memória e emissores substitutos, incluindo concorrência, fonte alterada, reservas, retorno incerto, promoção da homologação e queda após salvar o vínculo.
- Autenticação, origem, limites de corpo, isolamento, transporte administrativo e backup sintético.
- Worker Nacional e cliente HTTP contra a simulação fiscal local existente, sem chamadas ao governo, incluindo timeout após aceitação e recuperação sem segundo POST.
- Assinatura/XSD dos dois ambientes com certificado efêmero de QA, sem usar certificado instalado; verificação do escopo documental no transporte PowerShell.
- Revisão da rota real `/admin` com fixture segura em 390, 768 e 1440 px: campos, foco, menu aberto, carregamento, erro e acompanhamento. No tablet, cards foram ajustados para impedir quebra dos valores. A tabela permite rolagem interna; não houve overflow horizontal da página.

As capturas e logs locais estão em `output/regularizacao-lote-20261125/`. A prévia usa `tests/preview-regularizacao.mjs`, intercepta todas as rotas `/api/` e não encaminha requisições financeiras para Azure. Ela não deve ser executada como produção.

## Publicação necessária

Publicar os três componentes em conjunto, mantendo as configurações e políticas atuais:

1. Serviço Nacional: `national-admin-worker.mjs` empacotado e `nacional-admin-native.ps1` precisam reconhecer o contexto isolado de regularização. Preservar os perfis, certificados, flags, configurações e versões anteriores; não utilizar o instalador inicial para sobrescrever uma instalação habilitada para produção.
2. API administrativa: compilar com `node deploy/build-admin-api.mjs` e publicar a nova rota `regularizacao-fiscal` e os emissores compartilhados.
3. Next.js: publicar o painel e a rota-ponte autenticada.

Os testes locais não comprovam que a nova versão foi instalada no Azure. Conferir versões e disponibilidade após a publicação e testar apenas preparação/validação, sem emissão real como teste de implantação. A arquitetura existente ainda usa os workers fiscais; este trabalho não remove a dependência operacional deles.
