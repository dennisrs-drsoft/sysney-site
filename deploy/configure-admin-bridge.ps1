[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
# The function-specific key is passed only between private Azure settings.
# No banking key, certificate, or SendGrid key is copied to the browser.
$swa = az staticwebapp appsettings list -n sysney -g sysney -o json --only-show-errors | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível consultar configuração do site.' }
$bridgeKey = $swa.properties.ADMIN_BACKEND_KEY
if (-not $bridgeKey) {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  $bridgeKey = [Convert]::ToBase64String($bytes)
}
az functionapp function keys set -n sysney-admin-api-2602 -g sysney --function-name admin-painel --key-name sysney-site --key-value $bridgeKey --output none --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Falha na criação da chave exclusiva do painel.' }
$principal = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('{"userRoles":["administrador"],"userDetails":"verificacao-publicacao"}'))
$headers = @{'x-functions-key'=$bridgeKey;'x-admin-site-origin'='https://www.sysney.com';'x-ms-client-principal'=$principal}
$base = 'https://sysney-admin-api-2602.azurewebsites.net/api/financeiro/painel'
foreach ($empresa in @('sysney','drsoft')) {
  foreach ($rota in @('clientes','cobrancas','aprovacoes','historico-inter','emails')) {
    $r = Invoke-RestMethod -Uri "$base/${rota}?empresa=$empresa" -Headers $headers -TimeoutSec 100
    if ($r.erro) { throw "Falha em $rota/$empresa" }
    if ($rota -eq 'emails') {
      $esperado = if ($empresa -eq 'sysney') {'financeiro@sysney.com'} else {'financeiro@drsoftinformatica.com'}
      if ($r.remetente -ne $esperado) { throw "Remetente incorreto para $empresa" }
      Write-Output "Consulta validada: $rota/$empresa; remetente $esperado"
      foreach ($email in $r.emails) {
        foreach ($anexo in $email.anexos) {
          $pdf = Invoke-WebRequest -UseBasicParsing -Uri "$base/emails?empresa=$empresa&id=$($email.id)&anexo=$($anexo.tipo)" -Headers $headers -TimeoutSec 100
          if ($pdf.Headers['Content-Type'] -notmatch 'application/pdf') { throw 'Resposta de anexo não é PDF.' }
          Write-Output "PDF existente recuperado com autenticação: $($anexo.tipo)"
        }
      }
    } else { Write-Output "Consulta validada: $rota/$empresa" }
  }
}
$unauthorized = $false
try { Invoke-WebRequest -UseBasicParsing -Uri "$base/emails?empresa=sysney" -TimeoutSec 30 | Out-Null }
catch { if ([int]$_.Exception.Response.StatusCode -eq 401) { $unauthorized = $true } else { throw } }
if (-not $unauthorized) { throw 'A API não bloqueou a chamada sem chave.' }
az staticwebapp appsettings set -n sysney -g sysney --setting-names "ADMIN_BACKEND_KEY=$bridgeKey" SENDGRID_FROM_EMAIL_SYSNEY=financeiro@sysney.com SENDGRID_FROM_EMAIL_DRSOFT=financeiro@drsoftinformatica.com --output none --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Falha na configuração privada do site.' }
Write-Output 'Ponte configurada após consultas autenticadas e bloqueio anônimo. Nenhuma emissão ou envio.'
