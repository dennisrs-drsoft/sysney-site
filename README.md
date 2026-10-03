# Site institucional da SYSNEY

Site institucional da SYSNEY Informática e do SISBlink, desenvolvido com Next.js, TypeScript e Tailwind CSS. A aplicação usa renderização híbrida do Next.js e uma Server Action integrada ao SendGrid para receber contatos.

## Desenvolvimento local

Pré-requisitos:

- Node.js compatível com a versão indicada pelo Next.js;
- npm;
- Git.

Instale as dependências e inicie o servidor:

```powershell
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Publicação no Azure

O projeto está associado ao Azure Static Web App `sysney`, no grupo de recursos `sysney`. O deploy de produção é realizado pelo workflow do GitHub Actions ligado à branch `main`.

O Azure CLI não envia diretamente o conteúdo de um Static Web App, e o SWA CLI não oferece suporte oficial ao deploy de aplicações Next.js híbridas. Por isso, o script local prepara e valida o projeto e, no modo de publicação, envia a branch `main` para o GitHub, acionando o workflow oficial do Azure. Isso preserva as Server Actions.

### Pré-requisitos

- Node.js, npm e Git disponíveis no `PATH`;
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) instalado;
- acesso à assinatura que contém o recurso `sysney`;
- autenticação Git configurada para o repositório;
- alterações revisadas e commitadas na branch `main` antes da publicação.

### Login no Azure

```powershell
az login
az account show
```

Se houver mais de uma assinatura, selecione a correta:

```powershell
az account set --subscription "NOME OU ID DA ASSINATURA"
```

### Preparar sem publicar

Este comando valida ferramentas, autenticação, recurso e variáveis do Azure, instala dependências, executa lint e gera o build. Ele não faz deploy, commit ou push:

```powershell
npm run deploy:azure:all -- -PrepareOnly
```

### Publicar

Depois de revisar e fazer o commit manualmente na branch `main`:

```powershell
npm run deploy:azure:all
```

O script interrompe imediatamente em caso de falha, não exibe segredos, acompanha o GitHub Actions e mostra a URL publicada ao final.

### Variáveis necessárias no Azure

Configure estas variáveis em **Azure Portal → Static Web App `sysney` → Configuração**:

- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `SENDGRID_TO_EMAIL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

O remetente indicado por `SENDGRID_FROM_EMAIL` precisa estar autorizado no SendGrid. Nunca coloque esses valores no código, no README ou no repositório.

As chaves do Turnstile são criadas no painel da Cloudflare. Configure o widget para aceitar `www.sysney.com` e o hostname padrão do Azure. A chave pública fica em `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; a chave secreta fica somente em `TURNSTILE_SECRET_KEY`.

Para desenvolvimento local, os mesmos nomes podem ser definidos em `.env.local`, que é ignorado pelo Git.

## Verificações isoladas

```powershell
npm run lint
npm run build
```

Rotas principais:

- `/` — página institucional;
- `/contato` — formulário integrado ao SendGrid;
- `/suporte/confirmacao-whatsapp` — manual para representantes.

## Área administrativa financeira

A base visual da área privada fica em `/admin`. A rota e seus endpoints são
restritos à função `administrador` pelo Azure Static Web Apps e não devem ser
divulgados na navegação pública.

O painel foi preparado para duas empresas emissoras independentes:

- DRSOFT — Lucro Presumido;
- SYSNEY — Simples Nacional.

Nenhum certificado ou segredo pode ser salvo no repositório. Arquivos de
certificado e chave (`.pfx`, `.p12`, `.pem`, `.key`, `.crt` e `.cer`) estão
ignorados pelo Git. Para desenvolvimento local, o endpoint de diagnóstico pode
ser liberado temporariamente com `ADMIN_DEV_BYPASS=true`; essa opção nunca deve
ser configurada em produção.

As integrações ainda dependem de infraestrutura segura e das seguintes
configurações de servidor:

- `ADMIN_DATABASE_URL`;
- `INTER_DRSOFT_CLIENT_ID`;
- `INTER_DRSOFT_CLIENT_SECRET`;
- `INTER_DRSOFT_CERTIFICATE_BASE64`;
- `INTER_DRSOFT_CERTIFICATE_PASSWORD`;
- `INTER_SYSNEY_CLIENT_ID`;
- `INTER_SYSNEY_CLIENT_SECRET`;
- `INTER_SYSNEY_CERTIFICATE_BASE64`;
- `INTER_SYSNEY_CERTIFICATE_PASSWORD`;
- `NFSE_DRSOFT_CNPJ`;
- `NFSE_DRSOFT_CCM`;
- `NFSE_DRSOFT_CERTIFICATE_BASE64`;
- `NFSE_DRSOFT_CERTIFICATE_PASSWORD`;
- `NFSE_SYSNEY_CNPJ`;
- `NFSE_SYSNEY_CCM`;
- `NFSE_SYSNEY_CERTIFICATE_BASE64`;
- `NFSE_SYSNEY_CERTIFICATE_PASSWORD`.

Em produção, os certificados e segredos devem ser armazenados no Azure Key
Vault e acessados por identidade gerenciada. A tela de emissão permanece sem
ações transacionais até que banco de dados, autenticação, integrações e regras
fiscais sejam homologados.

### Backend de homologação

O backend isolado fica em `admin-api` e utiliza Azure Functions no plano de
consumo. O endpoint público `/api/financeiro/health` informa somente a disponibilidade
do serviço e nunca retorna nomes de contas, chaves, certificados ou dados de
clientes.

Recursos provisionados em `Brazil South`:

- Function App `sysney-admin-api-2602`;
- Storage Account `sysneyadm2602`;
- Key Vault `sysney-admin-kv-2602`.

A Function utiliza identidade gerenciada com acesso restrito às tabelas, aos
contêineres privados e à leitura futura de certificados e segredos. O ambiente
permanece em modo de homologação, com operações transacionais desativadas.

### Integração Inter Empresas

A integração bancária utiliza OAuth 2.0 com certificado mTLS. Para cada empresa,
o Key Vault armazena separadamente `Client ID`, `Client Secret`, certificado
cliente e chave privada. Esses valores nunca devem ser copiados para arquivos
`.env`, logs, commits ou configurações públicas do Static Web App.

Para a SYSNEY, o configurador seguro valida se o ZIP contém certificado cliente
e chave privada antes de enviar os arquivos diretamente ao Key Vault. A opção
recomendada abre um formulário restrito a `127.0.0.1`, de uso único:

```powershell
npm run configure:inter:web --prefix admin-api -- `
  "C:\caminho\certificado-inter.zip"
```

O formulário solicita o `Client ID` e o `Client Secret`, não mantém os arquivos
extraídos e não habilita consultas automaticamente. A autenticação e a
sincronização local podem ser validadas sem exibir token ou dados pessoais:

```powershell
npm run test:inter:auth --prefix admin-api
npm run sync:inter:clientes --prefix admin-api
```

A sincronização usa os últimos 90 dias por padrão. Datas opcionais no formato
`AAAA-MM-DD` podem ser passadas após `--`. O arquivo
`Certificado_Webhook.zip`, contendo somente uma autoridade certificadora, não
substitui o certificado cliente e a chave privada da integração.

Endpoints administrativos protegidos por chave da Function:

- `GET /api/financeiro/inter/{empresa}/status` — informa apenas prontidão;
- `POST /api/financeiro/inter/{empresa}/clientes/sincronizar` — consulta
  cobranças e deduplica seus pagadores na tabela `AdminClientes`.

A sincronização é somente de leitura no Inter e permanece bloqueada até
`INTER_READ_OPERATIONS_ENABLED=true`. Não há endpoint de agenda de clientes no
Inter; a carteira é formada a partir dos pagadores presentes nas cobranças que
a integração tem permissão para consultar.

### Controle mensal de cobranças (homologação local)

A aba **Cobranças mensais** permite cadastrar uma mensalidade consolidada por
cliente sincronizado, com valor, e-mail, competência inicial/final e prazos de
envio/vencimento relativos à competência. Os dias inexistentes em meses curtos
são ajustados para o último dia. Alertas incluem competências anteriores.

`GET/POST /api/admin/cobrancas?empresa=sysney` usa autorização administrativa.
Planos ficam em `AdminConfiguracoes` e o histórico por competência em
`AdminDocumentos`, na partição `cobrancas-{empresa}`. Consultar gera previsões
sem emitir boletos; o primeiro registro salva uma cópia dos dados da competência.
Identificadores determinísticos, operações idempotentes e ETags protegem contra
duplicação e gravações concorrentes.

É possível conferir referências da nota e do boleto, copiar o demonstrativo,
registrar envio e recebimento, lançar pagamentos parciais e corrigir pagamentos
manuais mantendo histórico, responsável e data. Alertas atualizam a cada minuto
enquanto essa aba está aberta. Esses registros **não enviam mensagens nem
confirmam pagamentos no Inter**. Não há armazenamento de anexos ou emissão fiscal
neste módulo. Automação de envio, webhooks de entrega e conciliação bancária são
etapas pendentes; valor, calendário e destinatário precisam ser confirmados por
cliente antes de operar. A recorrência inicial é uma por cliente; alterações
contratuais e reajustes ainda não têm interface própria.

Validação das regras e da API, com armazenamento simulado e sem dados reais:

```powershell
node --test tests/cobrancas.test.mjs tests/cobrancas-api.test.mjs
```

### Laboratório de e-mails e histórico do Inter (local)

O laboratório salva rascunhos por empresa em `AdminDocumentos`, permite editar
destinatários, conteúdo e apresentação com logo e anexar nota e boleto em PDF
no contêiner privado `admin-anexos`. A revisão exige os dois documentos e todos
os dados da cobrança. O envio real exige confirmação separada; utiliza SendGrid
no servidor, registra o HTML enviado e bloqueia repetição em resultados incertos.
“Aceito pelo provedor” não significa entregue ou lido; webhooks estão pendentes.
As credenciais são obtidas do Key Vault, sem exposição no navegador.

O remetente precisa estar autorizado no SendGrid. A preferência por um endereço
não substitui essa autorização. A emissão automática de nota e boleto ainda
não está habilitada. Documentos existentes podem ser anexados para revisão.

`admin-api/scripts/importar-historico-inter.mjs` consulta cobranças SYSNEY por
data de emissão, desde 2020, em janelas de 90 dias, sem operações bancárias de
escrita. Salva por identificador bancário estável na partição
`inter-historico-sysney`. A aba Histórico do Inter exibe a última importação,
com filtro por cliente, número ou situação. Não equivale a conciliação contínua,
não importa notas fiscais e não infere competência a partir do vencimento.

Testes simulados, sem envio real: `node --test tests/*.test.mjs`.

### Emissão bancária assistida e consulta fiscal

Os scripts pontuais de cobrança permanecem apenas no ambiente local privado.
O serviço exige habilitação explícita e grava um bloqueio único por
empresa/CNPJ/competência em `inter-emissoes-{empresa}` antes de enviar ao banco.
Não repete POSTs automaticamente: respostas incertas exigem conciliação manual.
Essa operação não está exposta como botão genérico e não envia e-mails.
Recuperar o PDF de uma cobrança existente não significa emitir outro boleto.

`consultar-notas-sysney.ps1` consulta NFS-e via serviço oficial de São Paulo,
assinando o pedido com o certificado instalado no Windows, sem exportar a chave.
Os XMLs ficam fora do repositório em Documentos/SYSNEY/Consultas-NFSe.
O script não emite notas. O enquadramento fiscal precisa estar validado antes
da implementação e ativação da transmissão de RPS.

### Preparação da NFS-e Nacional (02/10/2026)

### Aprovações separadas (02/10/2026)

### Publicação do painel com API isolada

Em produção, `/api/admin/*` encaminha somente as rotas administrativas conhecidas
para a Function `admin-painel`. O site verifica papel administrador e origem de
POST; a Function exige chave própria, origem permitida e principal administrador.
`ADMIN_BACKEND_KEY` fica apenas nas configurações privadas do Static Web App.
Cookies, autorização do navegador e cabeçalhos arbitrários não são encaminhados.
Sem a chave, a operação falha fechada; não usa credenciais locais em produção.

A API usa sua identidade gerenciada existente. `deploy/build-admin-api.mjs`
compila os mesmos handlers do site para evitar divergência nas aprovações.
`deploy/publish-admin-api.ps1` publica um pacote sem certificados ou credenciais,
com logo e handlers gerados. A API define `ADMIN_BACKEND_EXECUTION=true` e
`NODE_ENV=production`; o site nunca deve definir `ADMIN_BACKEND_EXECUTION`.
O fluxo local continua utilizando os handlers diretamente.

Remetentes exclusivos: `SENDGRID_FROM_EMAIL_SYSNEY` e
`SENDGRID_FROM_EMAIL_DRSOFT`, com padrões autorizados `financeiro@sysney.com` e
`financeiro@drsoftinformatica.com`. O formulário público continua independente.
Publicar o painel não autoriza emitir nota/boleto nem enviar e-mail.

Layout administrativo revisado em 02/10/2026 usando como referência visual
o modelo CURRENT claro de `sisblink-web/features/app-shell`: navegação lateral
azul-escura, seleção azul/ciano e área de trabalho clara. Não usa PREMIUM_V1.
`AdminShell` concentra navegação por grupo, empresa, avisos e estilos isolados;
o laboratório separa destinatários, cobrança, texto e aprovação, com prévia
lado a lado em desktop e empilhamento em telas menores. Sem alterações nos
endpoints, dados financeiros, regras de aprovação ou HTML enviado por e-mail.

O menu **Aprovar emissão** recebe rascunhos locais na fila protegida por empresa.
Cada versão exige conferência explícita, com responsável, horário e histórico.
Atualizar dados revoga a aprovação; concorrência é controlada por ETag.
Esta fila ainda NÃO executa emissão: a futura integração fiscal/bancária deve
consumir somente a versão aprovada e reservar a operação antes de transmitir.
Os scripts manuais legados não são consumidores desta fila.

No **Laboratório de e-mails**, aprovar emissão não autoriza envio. A aprovação
de envio vincula remetente, destinatários, conteúdo renderizado, logo e bytes
dos PDFs. O servidor reconfere tudo antes de enviar; salvar, duplicar ou anexar
revoga a aprovação. Mensagens revisadas antes desta implementação precisam
ser aprovadas novamente. Testes usam serviços simulados, sem emissão ou envio.

### Estado da integração nacional

A seção administrativa **NFS-e Nacional** apresenta a transição da SYSNEY,
a cobrança prevista para 01/11/2026 (referência comercial outubro/2026,
vencimento 08/12/2026) e as pendências reais. Não libera transmissão por data.
A DRSOFT não herda o enquadramento da SYSNEY.

`admin-api/scripts/consultar-nfse-nacional.ps1` usa o certificado da SYSNEY
no Windows sem exportar a chave. Permite somente consultas GET, com destinos
oficiais fixos e validação dos identificadores. O padrão é homologação.
O diagnóstico consulta o contrato da API: **não comprova habilitação fiscal**.
Os resultados são gravados na pasta Documentos/SYSNEY/NFSe-Nacional,
fora do repositório. Não há repetição automática de emissão nem transmissão.

```powershell
./admin-api/scripts/consultar-nfse-nacional.ps1
./admin-api/scripts/consultar-nfse-nacional.ps1 -Ambiente producao -Operacao diagnostico
```

Antes de ativar: confirmar habilitação para a competência correta, mapear
código nacional do serviço (não copiar 03158), reservar série/numeração DPS,
implementar assinatura e validação XSD, testar emissão/consulta/recuperação
de PDF, persistir bloqueios por empresa/competência e definir a execução do
certificado (Windows local não é o Azure). O emissor nacional ainda não está
pronto para produção. A consulta nacional não substitui o acervo municipal.
Preservar notas e boletos existentes e conciliar substituições na base protegida;
não excluir travas nem reemitir automaticamente documentos já registrados.

Fontes oficiais verificadas em 02/10/2026:
- https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/agosto/simples-nacional-nfs-e-nacional-sera-obrigatoria-para-me-e-epp-a-partir-de-1o-de-novembro-de-2026
- https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/documentacao-atual
- https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao
