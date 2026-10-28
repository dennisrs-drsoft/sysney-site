param([string]$ConfigPath='C:\ProgramData\SYSNEY\AtpMunicipal\config.json',[switch]$Readiness,[switch]$Once)
$ErrorActionPreference='Stop'
$root='C:\ProgramData\SYSNEY\AtpMunicipal'
$config=Get-Content -LiteralPath $ConfigPath -Raw|ConvertFrom-Json
if($config.storageAccount -notmatch '^[a-z0-9]{3,24}$' -or $config.actorId -ne 'SYSNEY-ATP-WORKER' -or $config.nationalEnabled -ne $false){throw 'ATP_WORKER_CONFIG_REVIEW_REQUIRED'}
$runner=[IO.Path]::GetFullPath($config.runnerPath)
if(!$runner.StartsWith($root+'\releases\',[StringComparison]::OrdinalIgnoreCase) -or (Get-FileHash -LiteralPath $runner -Algorithm SHA256).Hash.ToLowerInvariant() -cne $config.runnerSha256){throw 'ATP_WORKER_RUNNER_HASH_MISMATCH'}
if((Get-FileHash -LiteralPath $config.nodePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $config.nodeSha256 -or (Get-AuthenticodeSignature -LiteralPath $config.nodePath).Status -ne 'Valid'){throw 'ATP_WORKER_RUNTIME_REVIEW_REQUIRED'}
if($Readiness){
 $task=Get-ScheduledTask -TaskName 'SYSNEY-ATP-Municipal-Isolado' -ErrorAction SilentlyContinue
 $binding=Get-Content -LiteralPath 'C:\ProgramData\SYSNEY\FiscalTeste\config.json' -Raw|ConvertFrom-Json
 $issuer=@($binding.emitentes|Where-Object empresa -eq 'sysney');if($issuer.Count -ne 1){throw 'ATP_WORKER_CERT_BINDING_REQUIRED'}
 $cert=Get-Item -LiteralPath ('Cert:\LocalMachine\My\'+$issuer[0].thumbprint)
 [pscustomobject]@{State=if($config.paused -eq $true -and $config.allowFiscalCalls -ne $true -and $config.issuanceEnabled -ne $true -and $config.automationEnabled -ne $true -and $task -and [string]$task.State -eq 'Disabled'){'installed_paused'}else{'review_required'};Paused=($config.paused -eq $true);AllowFiscalCalls=($config.allowFiscalCalls -eq $true);IssuanceEnabled=($config.issuanceEnabled -eq $true);AutomationEnabled=($config.automationEnabled -eq $true);NationalEnabled=($config.nationalEnabled -eq $true);TaskState=if($task){[string]$task.State}else{'missing'};RunnerSha256=$config.runnerSha256;RuntimeSha256=$config.nodeSha256;CertificateBindingExists=$true;CertificateHasPrivateKey=$cert.HasPrivateKey;CertificateExpiresUtc=$cert.NotAfter.ToUniversalTime().ToString('o');CertificateExported=$false;FiscalStorageWrites=$false;Transmitted=$false}|ConvertTo-Json -Compress
 return
}
if($config.paused -eq $true -or $config.allowFiscalCalls -ne $true){[pscustomobject]@{State='paused';Transmitted=$false;FiscalStorageWrites=$false}|ConvertTo-Json -Compress;return}
if(!$Once){throw 'ATP_WORKER_EXPLICIT_ONCE_REQUIRED'}
if($config.automationEnabled -ne $true -or $config.approvedPolicyHash -notmatch '^[a-f0-9]{64}$' -or !$config.approvedPolicyVersion){throw 'ATP_WORKER_APPROVED_AUTOMATION_REQUIRED'}
if($config.requireFreshPayment -ne $true -or $config.issuanceWindowPolicyVersion -cne 'ATP-WAIT-v1' -or $config.paymentGateBaseUrl -notin @('https://api.agoratemplay.com.br','https://api.agoratemplay.com.br/') -or $config.municipalRouting.approved -ne $true){throw 'ATP_WORKER_FRESH_PAYMENT_POLICY_REQUIRED'}
# Emission additionally requires the private deployment policy and its own gate.
$names=@('ATP_MUNICIPAL_OPERATOR_ENABLED','ATP_MUNICIPAL_EXECUTOR_ENABLED','ATP_MUNICIPAL_ISSUANCE_ENABLED');$old=@{}
foreach($name in $names){$old[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
try{
 [Environment]::SetEnvironmentVariable('ATP_MUNICIPAL_OPERATOR_ENABLED','true','Process')
 [Environment]::SetEnvironmentVariable('ATP_MUNICIPAL_EXECUTOR_ENABLED','true','Process')
 $issuance=if($config.automationEnabled -eq $true -and $config.issuanceEnabled -eq $true){'true'}else{'false'}
 [Environment]::SetEnvironmentVariable('ATP_MUNICIPAL_ISSUANCE_ENABLED',$issuance,'Process')
 & $config.nodePath $runner worker $ConfigPath next
 if($LASTEXITCODE -ne 0){throw 'ATP_WORKER_OPERATION_UNCONFIRMED'}
}finally{foreach($name in $names){[Environment]::SetEnvironmentVariable($name,$old[$name],'Process')}}
