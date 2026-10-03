param([Parameter(Mandatory)][string]$PacoteBase64,[Parameter(Mandatory)][string]$EmitentesBase64,[Parameter(Mandatory)][string]$Storage)
$ErrorActionPreference='Stop'
$destino='C:\ProgramData\SYSNEY\FiscalTeste'
if([IO.Path]::GetFullPath($destino) -ne 'C:\ProgramData\SYSNEY\FiscalTeste'){throw 'Destino inválido.'}
if(Test-Path -LiteralPath $destino){throw 'Instalação já existente. Fazer atualização versionada, sem sobrescrever serviço em execução.'}
$emitentes=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($EmitentesBase64)) | ConvertFrom-Json
$vinculos=@()
foreach($emitente in $emitentes){
  if($emitente.cnpj -notmatch '^\d{14}$'){throw 'Emitente inválido.'}
  $certs=@(Get-ChildItem Cert:\LocalMachine\My|Where-Object {$_.Subject -match $emitente.cnpj -and $_.HasPrivateKey -and $_.NotBefore -lt (Get-Date) -and $_.NotAfter -gt (Get-Date)})
  if($certs.Count -ne 1){throw 'Certificado válido e único não localizado.'}
  $vinculos+=@{empresa=$emitente.empresa;cnpj=$emitente.cnpj;thumbprint=$certs[0].Thumbprint}
}
if($Storage -notmatch '^[a-z0-9]{3,24}$'){throw 'Storage inválido.'}
[void](New-Item -ItemType Directory -Path $destino)
# Pasta privada, acessível apenas ao serviço SYSTEM e administradores da VM.
$acl=Get-Acl -LiteralPath $destino;$acl.SetAccessRuleProtection($true,$false)
foreach($sid in @('S-1-5-18','S-1-5-32-544')){
  $regra=[Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow')
  $acl.AddAccessRule($regra)
}
Set-Acl -LiteralPath $destino -AclObject $acl
$zip=Join-Path $destino 'pacote.zip'
[IO.File]::WriteAllBytes($zip,[Convert]::FromBase64String($PacoteBase64))
Expand-Archive -LiteralPath $zip -DestinationPath $destino
# Windows PowerShell 5.1 precisa do BOM para preservar textos em português.
foreach($arquivo in Get-ChildItem -LiteralPath $destino -Filter '*.ps1' -Recurse){
  [IO.File]::WriteAllText($arquivo.FullName,[IO.File]::ReadAllText($arquivo.FullName,[Text.Encoding]::UTF8),[Text.UTF8Encoding]::new($true))
}
[IO.File]::WriteAllText((Join-Path $destino 'config.json'),(@{modo='teste';storage=$Storage;emitentes=$vinculos}|ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false))
$acao=New-ScheduledTaskAction -Execute (Join-Path $PSHOME 'powershell.exe') -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+(Join-Path $destino 'fiscal-vm-worker.ps1')+'"') -WorkingDirectory $destino
$gatilho=New-ScheduledTaskTrigger -AtStartup
$principal=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$opcoes=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
if(Get-ScheduledTask -TaskName 'SYSNEY-Fiscal-Teste' -ErrorAction SilentlyContinue){throw 'Nome de tarefa já utilizado.'}
[void](Register-ScheduledTask -TaskName 'SYSNEY-Fiscal-Teste' -Action $acao -Trigger $gatilho -Principal $principal -Settings $opcoes -Description 'Fila privada SYSNEY: somente teste fiscal e consulta. Não permite emissão real.')
Start-ScheduledTask -TaskName 'SYSNEY-Fiscal-Teste'
[pscustomobject]@{Instalado=$true;Modo='teste';CertificadosVinculados=$vinculos.Count;Pasta=$destino;EmissaoReal=$false}|ConvertTo-Json -Compress
