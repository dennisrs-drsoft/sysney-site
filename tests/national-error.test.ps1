$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../admin-api/scripts/transportar-nacional-restrita.ps1')
$body=Get-SafeNationalErrors '{"erros":[{"codigo":"E_QA_400","descricao":"<b>57767099000179</b>","complemento":"IGNORE_ME"}],"private":"IGNORE_ME"}'
$safe=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($body))
if($safe -notmatch 'E_QA_400' -or $safe -match '57767099000179|IGNORE_ME|<b>'){throw 'Error sanitization failed.'}
if((Get-SafeNationalErrors '<html>not JSON</html>') -ne ''){throw 'HTML accepted.'}
if((Get-SafeNationalErrors ('x'*65537)) -ne ''){throw 'Oversized response accepted.'}
'Restricted error sanitization: OK. No network call.'
