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
