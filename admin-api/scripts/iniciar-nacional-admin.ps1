param([switch]$Readiness)
$ErrorActionPreference='Stop'
$root='C:\ProgramData\SYSNEY\NfseNacional';$config=Get-Content -LiteralPath (Join-Path $root 'config.json') -Raw|ConvertFrom-Json
if($config.storageAccount -notmatch '^[a-z0-9]{3,24}$'){throw 'Storage nacional invalido.'}
$release=[IO.Path]::GetFullPath($config.releasePath)
if(!$release.StartsWith($root+'\releases\',[StringComparison]::OrdinalIgnoreCase)){throw 'Release nacional fora da pasta autorizada.'}
$manifest=Get-Content -LiteralPath (Join-Path $release 'manifest.json') -Raw|ConvertFrom-Json
foreach($f in $manifest.files){
 $path=[IO.Path]::GetFullPath((Join-Path $release $f.path));if(!$path.StartsWith($release+'\',[StringComparison]::OrdinalIgnoreCase) -or $f.path -match '\.\.' -or $f.sha256 -notmatch '^[a-f0-9]{64}$'){throw 'Manifesto nacional invalido.'}
 if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $f.sha256){throw 'Arquivo nacional diverge do manifesto.'}
}
if($config.nativeScriptPath -cne (Join-Path $release 'admin-api\scripts\nacional-admin-native.ps1')){throw 'Script nacional nao vinculado ao pacote.'}
if((Get-FileHash -LiteralPath $config.nodePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $config.nodeSha256 -or (Get-AuthenticodeSignature -LiteralPath $config.nodePath).Status -ne 'Valid'){throw 'Runtime nacional nao conferido.'}
if($Readiness){
 [pscustomobject]@{state=if($config.paused -eq $true){'paused'}elseif($config.allowSend -ne $true){'signing_and_queries_only'}else{'review_send_policy'};sendEnabled=($config.allowSend -eq $true);signingEnabled=($config.allowSigning -eq $true);queriesEnabled=($config.allowQueries -eq $true);runnerVerified=$true;transmitted=$false}|ConvertTo-Json -Compress;return
}
if($config.paused -eq $true){return}
& $config.nodePath (Join-Path $release 'national-admin-runner.mjs') once (Join-Path $root 'config.json')
if($LASTEXITCODE -ne 0){throw 'Servico nacional nao concluido. Consultar antes de repetir.'}
