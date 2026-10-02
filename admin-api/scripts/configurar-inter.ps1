[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("sysney")]
  [string]$Empresa,

  [Parameter(Mandatory = $true)]
  [string]$ZipPath,

  [string]$KeyVaultName = "sysney-admin-kv-2602",

  [string]$ContaCorrente
)

$ErrorActionPreference = "Stop"
$zipResolvido = (Resolve-Path -LiteralPath $ZipPath).Path
if ([IO.Path]::GetExtension($zipResolvido) -ne ".zip") {
  throw "O arquivo informado precisa ser um ZIP."
}

az account show --only-show-errors --output none

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempDir = Join-Path $tempBase ("sysney-inter-" + [guid]::NewGuid().ToString("N"))
$tempResolvido = [IO.Path]::GetFullPath($tempDir)
if (-not $tempResolvido.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Diretório temporário inválido."
}

New-Item -ItemType Directory -Path $tempResolvido | Out-Null

try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zipResolvido, $tempResolvido)

  $chave = Get-ChildItem -LiteralPath $tempResolvido -File -Recurse |
    Where-Object { $_.Extension -eq ".key" } |
    Select-Object -First 1
  $certificado = Get-ChildItem -LiteralPath $tempResolvido -File -Recurse |
    Where-Object { $_.Extension -in ".crt", ".pem" } |
    Select-Object -First 1

  if (-not $chave -or -not $certificado) {
    throw "O ZIP precisa conter um certificado cliente (.crt ou .pem) e uma chave privada (.key)."
  }

  $conteudoChave = [IO.File]::ReadAllText($chave.FullName)
  $conteudoCertificado = [IO.File]::ReadAllText($certificado.FullName)
  if ($conteudoChave -notmatch "BEGIN .*PRIVATE KEY") {
    throw "A chave privada do ZIP não está no formato PEM esperado."
  }
  if ($conteudoCertificado -notmatch "BEGIN CERTIFICATE") {
    throw "O certificado do ZIP não está no formato PEM esperado."
  }

  $clientId = Read-Host "Client ID da integração $Empresa"
  $clientSecretSeguro = Read-Host "Client Secret da integração $Empresa" -AsSecureString
  if ([string]::IsNullOrWhiteSpace($clientId)) {
    throw "Client ID não informado."
  }

  $clientIdFile = Join-Path $tempResolvido "client-id.txt"
  $clientSecretFile = Join-Path $tempResolvido "client-secret.txt"
  [IO.File]::WriteAllText($clientIdFile, $clientId, [Text.UTF8Encoding]::new($false))

  $ponteiro = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($clientSecretSeguro)
  try {
    $clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiro)
    if ([string]::IsNullOrWhiteSpace($clientSecret)) {
      throw "Client Secret não informado."
    }
    [IO.File]::WriteAllText(
      $clientSecretFile,
      $clientSecret,
      [Text.UTF8Encoding]::new($false)
    )
  }
  finally {
    if ($ponteiro -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiro)
    }
    $clientSecret = $null
  }

  $prefixo = "inter-$Empresa"
  az keyvault secret set --vault-name $KeyVaultName --name "$prefixo-client-id" --file $clientIdFile --encoding utf-8 --only-show-errors --output none
  az keyvault secret set --vault-name $KeyVaultName --name "$prefixo-client-secret" --file $clientSecretFile --encoding utf-8 --only-show-errors --output none
  az keyvault secret set --vault-name $KeyVaultName --name "$prefixo-certificado-crt" --file $certificado.FullName --encoding utf-8 --only-show-errors --output none
  az keyvault secret set --vault-name $KeyVaultName --name "$prefixo-chave-privada" --file $chave.FullName --encoding utf-8 --only-show-errors --output none

  if (-not [string]::IsNullOrWhiteSpace($ContaCorrente)) {
    $contaFile = Join-Path $tempResolvido "conta-corrente.txt"
    [IO.File]::WriteAllText($contaFile, $ContaCorrente, [Text.UTF8Encoding]::new($false))
    az keyvault secret set --vault-name $KeyVaultName --name "$prefixo-conta-corrente" --file $contaFile --encoding utf-8 --only-show-errors --output none
  }

  Write-Output "Credenciais da $Empresa armazenadas no Key Vault."
  Write-Output "Consultas ao Inter continuam bloqueadas até a validação do token."
}
finally {
  if (Test-Path -LiteralPath $tempResolvido) {
    Remove-Item -LiteralPath $tempResolvido -Recurse -Force
  }
}
