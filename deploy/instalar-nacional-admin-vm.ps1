# Executar na DRServer por Run Command com URL de artefato privada e temporaria.
# Este instalador habilita somente assinatura/consultas. Nunca habilita POST fiscal.
param([Parameter(Mandatory)][string]$ArtifactUri,[Parameter(Mandatory)][string]$PackageSha256)
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
if($PackageSha256 -notmatch '^[a-f0-9]{64}$' -or $ArtifactUri -notmatch '^https://sysneyadm2602\.blob\.core\.windows\.net/admin-anexos/operacoes/nacional-admin/[a-f0-9]{64}/worker\.zip\?'){throw 'Artefato nacional invalido.'}
$root='C:\ProgramData\SYSNEY\NfseNacional';$release=Join-Path $root ('releases\'+$PackageSha256)
$legacyPath='C:\ProgramData\SYSNEY\FiscalTeste\config.json';$legacyHash=(Get-FileHash -LiteralPath $legacyPath -Algorithm SHA256).Hash
$atpPath='C:\ProgramData\SYSNEY\AtpMunicipal\config.json';$atpHash=(Get-FileHash -LiteralPath $atpPath -Algorithm SHA256).Hash
$runtime=Get-Content -LiteralPath $atpPath -Raw|ConvertFrom-Json
if((Get-FileHash -LiteralPath $runtime.nodePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $runtime.nodeSha256 -or (Get-AuthenticodeSignature -LiteralPath $runtime.nodePath).Status -ne 'Valid'){throw 'Runtime existente nao conferido.'}
New-Item -ItemType Directory -Path $release -Force|Out-Null
& icacls.exe $root /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'ACL nacional nao aplicada.'}
$package=Join-Path $root ($PackageSha256+'.zip')
Invoke-WebRequest -Uri $ArtifactUri -OutFile $package -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 60
if((Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash.ToLowerInvariant() -cne $PackageSha256){throw 'Pacote nacional divergente.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead($package)
try{
 foreach($entry in $zip.Entries){
  $path=[IO.Path]::GetFullPath((Join-Path $release $entry.FullName))
  if(!$path.StartsWith($release+'\',[StringComparison]::OrdinalIgnoreCase) -or $entry.FullName -match '\.\.' -or $entry.FullName -match '[:\x00-\x1f]'){throw 'Caminho de artefato nacional invalido.'}
  if(!$entry.Name){New-Item -ItemType Directory -Path $path -Force|Out-Null;continue}
  New-Item -ItemType Directory -Path (Split-Path $path) -Force|Out-Null
  if(Test-Path -LiteralPath $path){$existing=Get-Item -LiteralPath $path;if($existing.Length -ne $entry.Length){throw 'Release existente divergente.'};continue}
  [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$path,$false)
 }
}finally{$zip.Dispose()}
$manifest=Get-Content -LiteralPath (Join-Path $release 'manifest.json') -Raw|ConvertFrom-Json
foreach($f in $manifest.files){$path=[IO.Path]::GetFullPath((Join-Path $release $f.path));if(!$path.StartsWith($release+'\',[StringComparison]::OrdinalIgnoreCase) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $f.sha256){throw 'Manifesto nacional divergente.'}}
$configPath=Join-Path $root 'config.json'
if(Test-Path -LiteralPath $configPath){$old=Get-Content -LiteralPath $configPath -Raw|ConvertFrom-Json;if($old.allowSend -eq $true){throw 'Servico ja possui politica de transmissao; revisao especifica obrigatoria.'}}
$config=@{storageAccount='sysneyadm2602';paused=$false;allowQueries=$true;allowSigning=$true;allowSend=$false;emitentes=@();releasePath=$release;nativeScriptPath=(Join-Path $release 'admin-api\scripts\nacional-admin-native.ps1');nodePath=$runtime.nodePath;nodeSha256=$runtime.nodeSha256}
[IO.File]::WriteAllText($configPath,($config|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $release 'iniciar-nacional-admin.ps1') -Destination (Join-Path $root 'iniciar-nacional-admin.ps1') -Force
$taskName='SYSNEY-NFS-e-Nacional-Isolado'
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:\ProgramData\SYSNEY\NfseNacional\iniciar-nacional-admin.ps1' -WorkingDirectory $root
$trigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval ([TimeSpan]::FromMinutes(1))
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::FromMinutes(10)) -StartWhenAvailable
$principal=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force|Out-Null
& (Join-Path $root 'iniciar-nacional-admin.ps1') -Readiness
if((Get-FileHash -LiteralPath $legacyPath -Algorithm SHA256).Hash -cne $legacyHash -or (Get-FileHash -LiteralPath $atpPath -Algorithm SHA256).Hash -cne $atpHash){throw 'Configuracao existente alterada; revisar.'}
Start-ScheduledTask -TaskName $taskName
[pscustomobject]@{task=$taskName;sendEnabled=$false;legacyConfigurationPreserved=$true;atpConfigurationPreserved=$true;sqlChanged=$false;firewallChanged=$false;certificatesChanged=$false}|ConvertTo-Json -Compress
