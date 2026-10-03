[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $project
node deploy/build-admin-api.mjs
if ($LASTEXITCODE -ne 0) { throw 'Falha no build da API.' }
$stage = Join-Path ([IO.Path]::GetTempPath()) ('sysney-api-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
foreach ($name in @('host.json','package.json','package-lock.json','src','generated','public')) {
  Copy-Item -LiteralPath (Join-Path $project "admin-api/$name") -Destination $stage -Recurse
}
$zip = "$stage.zip"
node deploy/pack-admin-api.mjs $stage
if ($LASTEXITCODE -ne 0) { throw 'Falha no empacotamento da API.' }
az functionapp config appsettings set -n sysney-admin-api-2602 -g sysney --settings ADMIN_BACKEND_EXECUTION=true NODE_ENV=production SENDGRID_FROM_EMAIL_SYSNEY=financeiro@sysney.com SENDGRID_FROM_EMAIL_DRSOFT=financeiro@drsoftinformatica.com --output none --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Falha na configuração da API.' }
az functionapp deployment source config-zip -n sysney-admin-api-2602 -g sysney --src $zip --build-remote true --output none --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Falha na publicação da API.' }
Write-Output "API publicada. Pacote sem credenciais: $zip"
