[CmdletBinding()]
param(
  [switch]$PrepareOnly
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$totalSteps = if ($PrepareOnly) { 8 } else { 12 }
$currentStep = 0

function Write-Step {
  param([string]$Message)
  $script:currentStep++
  Write-Host ""
  Write-Host ("[{0}/{1}] {2}" -f $script:currentStep, $script:totalSteps, $Message) -ForegroundColor Cyan
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "O comando '$Name' não foi encontrado no PATH."
  }
}

function Invoke-Checked {
  param(
    [string]$Command,
    [string[]]$CommandArgs
  )

  & $Command @CommandArgs
  if ($LASTEXITCODE -ne 0) {
    throw "O comando '$Command' falhou com código $LASTEXITCODE."
  }
}

function Normalize-GitUrl {
  param([string]$Url)
  if (-not $Url) { return "" }
  return ($Url.Trim().TrimEnd("/") -replace "\.git$", "").ToLowerInvariant()
}

try {
  Write-Host "Deploy Azure completo — SYSNEY" -ForegroundColor Green
  Write-Host "Raiz do projeto: $projectRoot"
  if ($PrepareOnly) {
    Write-Host "Modo: preparação, sem publicação" -ForegroundColor Yellow
  }

  Set-Location -LiteralPath $projectRoot

  Write-Step "Verificando ferramentas obrigatórias"
  Assert-Command "az"
  Assert-Command "npm"
  Assert-Command "git"

  Write-Step "Confirmando autenticação no Azure CLI"
  $accountJson = & az account show --query "{name:name,state:state}" --output json --only-show-errors
  if ($LASTEXITCODE -ne 0 -or -not $accountJson) {
    throw "Azure CLI não autenticado. Execute 'az login' e tente novamente."
  }
  $account = $accountJson | ConvertFrom-Json
  if ($account.state -ne "Enabled") {
    throw "A assinatura Azure selecionada não está habilitada."
  }
  Write-Host ("Assinatura ativa: {0}" -f $account.name)

  Write-Step "Localizando o Azure Static Web App associado ao repositório"
  $remoteUrl = (& git remote get-url origin).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $remoteUrl) {
    throw "Não foi possível identificar o remote Git 'origin'."
  }

  $appsJson = & az staticwebapp list --query "[].{name:name,resourceGroup:resourceGroup,defaultHostname:defaultHostname,repositoryUrl:repositoryUrl,branch:branch}" --output json --only-show-errors
  if ($LASTEXITCODE -ne 0 -or -not $appsJson) {
    throw "Não foi possível consultar os recursos Azure Static Web Apps."
  }

  $normalizedRemote = Normalize-GitUrl $remoteUrl
  $matchingApps = @($appsJson | ConvertFrom-Json | Where-Object {
    (Normalize-GitUrl $_.repositoryUrl) -eq $normalizedRemote -and $_.branch -eq "main"
  })

  if ($matchingApps.Count -ne 1) {
    throw "Era esperado exatamente um Static Web App ligado ao origin/main; encontrados: $($matchingApps.Count)."
  }

  $staticApp = $matchingApps[0]
  $publishedUrl = "https://$($staticApp.defaultHostname)"
  Write-Host ("Recurso: {0} (grupo: {1})" -f $staticApp.name, $staticApp.resourceGroup)
  Write-Host ("URL: {0}" -f $publishedUrl)

  Write-Step "Verificando variáveis obrigatórias no Azure sem exibir valores"
  $settingsJson = & az staticwebapp appsettings list --name $staticApp.name --resource-group $staticApp.resourceGroup --output json --only-show-errors
  if ($LASTEXITCODE -ne 0 -or -not $settingsJson) {
    throw "Não foi possível consultar os nomes das configurações do Static Web App."
  }
  $settingsResponse = $settingsJson | ConvertFrom-Json
  $settingNames = @($settingsResponse.properties.PSObject.Properties.Name)
  $requiredSettings = @("SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL", "SENDGRID_TO_EMAIL")
  $missingSettings = @($requiredSettings | Where-Object { $_ -notin $settingNames })
  if ($missingSettings.Count -gt 0) {
    $missingMessage = "Variáveis ausentes no Azure: $($missingSettings -join ', '). Nenhum valor secreto foi exibido."
    if ($PrepareOnly) {
      Write-Warning $missingMessage
      Write-Warning "A preparação continuará, mas a publicação real será bloqueada até a configuração dessas variáveis."
    } else {
      throw $missingMessage
    }
  } else {
    Write-Host "Variáveis obrigatórias encontradas. Valores não exibidos."
  }

  Write-Step "Instalando dependências de forma reproduzível"
  if (Test-Path -LiteralPath (Join-Path $projectRoot "package-lock.json")) {
    Invoke-Checked "npm" @("ci")
  } else {
    Invoke-Checked "npm" @("install")
  }

  Write-Step "Executando lint"
  Invoke-Checked "npm" @("run", "lint")

  Write-Step "Executando build de produção"
  Invoke-Checked "npm" @("run", "build")

  Write-Step "Validando que o build preserva o modo híbrido"
  $requiredManifest = Join-Path $projectRoot ".next\server\server-reference-manifest.json"
  if (-not (Test-Path -LiteralPath $requiredManifest)) {
    throw "O manifesto de Server Actions não foi encontrado no build."
  }
  Write-Host "Build híbrido e Server Actions confirmados."

  if ($PrepareOnly) {
    Write-Host ""
    Write-Host "Preparação concluída com sucesso. Nenhum deploy, commit ou push foi executado." -ForegroundColor Green
    exit 0
  }

  Write-Step "Validando branch e árvore de trabalho antes da publicação"
  $branch = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -ne "main") {
    throw "A publicação oficial está vinculada à branch main. Branch atual: '$branch'."
  }
  $worktreeStatus = & git status --porcelain
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível verificar o estado do Git."
  }
  if ($worktreeStatus) {
    throw "Há alterações não commitadas. Revise e faça o commit manualmente antes de publicar."
  }

  $headSha = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível identificar o commit atual."
  }

  Write-Step "Enviando a branch main para acionar o deploy oficial"
  Invoke-Checked "git" @("push", "origin", "main")

  Write-Step "Aguardando a conclusão do GitHub Actions"
  if ($normalizedRemote -notmatch "github\.com[:/](?<owner>[^/]+)/(?<repo>[^/]+)$") {
    throw "Não foi possível derivar owner/repositório da URL do origin para acompanhar o workflow."
  }
  $owner = $Matches.owner
  $repo = $Matches.repo
  $runsApi = "https://api.github.com/repos/$owner/$repo/actions/runs?branch=main&event=push&per_page=20"
  $deadline = (Get-Date).AddMinutes(15)
  $run = $null

  do {
    $response = Invoke-RestMethod -Uri $runsApi -Headers @{ "User-Agent" = "sysney-local-deploy" }
    $run = $response.workflow_runs | Where-Object { $_.head_sha -eq $headSha } | Select-Object -First 1
    if ($run -and $run.status -eq "completed") { break }
    Write-Host "Workflow ainda em andamento..."
    Start-Sleep -Seconds 15
  } while ((Get-Date) -lt $deadline)

  if (-not $run -or $run.status -ne "completed") {
    throw "Tempo limite aguardando o GitHub Actions. Consulte a aba Actions do repositório."
  }
  if ($run.conclusion -ne "success") {
    throw "O GitHub Actions terminou com status '$($run.conclusion)'. Consulte: $($run.html_url)"
  }

  Write-Step "Confirmando publicação"
  Write-Host "Deploy concluído com sucesso." -ForegroundColor Green
  Write-Host ("URL publicada: {0}" -f $publishedUrl) -ForegroundColor Green
  Write-Host ("Workflow: {0}" -f $run.html_url)
}
catch {
  Write-Host ""
  Write-Host ("ERRO: {0}" -f $_.Exception.Message) -ForegroundColor Red
  exit 1
}
