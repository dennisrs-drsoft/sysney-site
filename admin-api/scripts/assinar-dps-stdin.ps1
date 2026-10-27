$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'assinar-dps-restrita.ps1')
try{
 $raw=[Console]::In.ReadToEnd();if($raw.Length -gt 1500000){throw 'Entrada excede limite.'}
 $inputObject=$raw|ConvertFrom-Json
 if($inputObject.environment -ne 'homologacao'){throw 'Ambiente invalido.'}
 $bytes=[Convert]::FromBase64String($inputObject.xmlBase64)
 if($bytes.Length -gt 1000000){throw 'DPS excede limite.'}
 $xml=[Text.UTF8Encoding]::new($false,$true).GetString($bytes)
 $config=Get-Content -LiteralPath 'C:\ProgramData\SYSNEY\FiscalTeste\config.json' -Raw|ConvertFrom-Json
 $binding=@($config.emitentes|Where-Object empresa -eq 'sysney')
 if($binding.Count -ne 1 -or $binding[0].cnpj -ne '57767099000179'){throw 'Emitente invalido.'}
 $cert=@(Get-ChildItem Cert:\LocalMachine\My|Where-Object {$_.Thumbprint -eq $binding[0].thumbprint -and $_.HasPrivateKey})
 if($cert.Count -ne 1){throw 'Certificado nao selecionado.'}
 $signed=Sign-DpsRestrita $xml $cert[0] (Join-Path $PSScriptRoot '../schemas/nfse-nacional-restrita')
 @{status=200;encoding='base64';body=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($signed));contentType='application/xml'}|ConvertTo-Json -Compress
}catch{[Console]::Error.Write('Assinatura restrita nao concluida.');exit 1}
