param([Parameter(Mandatory=$true)][string]$XmlPath,[Parameter(Mandatory=$true)][string]$XmlSha256,[ValidateSet('testar')][string]$Action='testar',[switch]$PrepareOnly)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
if($env:ATP_MUNICIPAL_OFFICIAL_TEST_ENABLED -cne 'true' -or $env:ATP_MUNICIPAL_ISSUANCE_ENABLED -cne 'false'){throw 'ATP_OFFICIAL_TEST_GATE_REQUIRED'}
. (Join-Path $PSScriptRoot 'assinar-atp-municipal.ps1')
. (Join-Path $PSScriptRoot 'atp-municipal-test-only.ps1')
$resolved=[IO.Path]::GetFullPath($XmlPath);$candidate=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if(!$resolved.StartsWith($candidate+'\',[StringComparison]::OrdinalIgnoreCase) -or (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant() -cne $XmlSha256){throw 'ATP_OFFICIAL_TEST_INPUT_HASH_MISMATCH'}
$text=[IO.File]::ReadAllText($resolved,[Text.Encoding]::UTF8)
[void](New-AtpMunicipalOfficialTestPacket $text $Action)
$config=Get-Content -LiteralPath 'C:\ProgramData\SYSNEY\FiscalTeste\config.json' -Raw|ConvertFrom-Json
$binding=@($config.emitentes|Where-Object empresa -eq 'sysney')
if($binding.Count -ne 1 -or $binding[0].thumbprint -notmatch '^[A-Fa-f0-9]{40}$'){throw 'ATP_CERT_BINDING_REQUIRED'}
$cert=Get-Item -LiteralPath ('Cert:\LocalMachine\My\'+$binding[0].thumbprint)
if(!$cert.HasPrivateKey -or $cert.NotAfter -le (Get-Date) -or $cert.NotBefore -gt (Get-Date)){throw 'ATP_CERT_UNAVAILABLE'}
$signed=Sign-AtpMunicipal $text $cert (Join-Path $PSScriptRoot '../schemas/nfse-sp')
$packet=New-AtpMunicipalOfficialTestPacket $signed $Action
$signedPath=Join-Path $candidate 'signed-test.xml';[IO.File]::WriteAllText($signedPath,$signed,[Text.UTF8Encoding]::new($false));$signedHash=(Get-FileHash -LiteralPath $signedPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($PrepareOnly){[pscustomobject]@{Prepared=$true;SignedXmlSha256=$signedHash;SchemaValidated=$true;CertificateExported=$false;PostCount=0;IssuanceEnabled=$false}|ConvertTo-Json -Compress;return}
$attempt=Join-Path $candidate 'official-test-attempt.json'
$state=[pscustomobject]@{Action=$packet.Action;SoapAction=$packet.SoapAction;SignedXmlSha256=$signedHash;StartedUtc=[datetime]::UtcNow.ToString('o');PostCountMaximum=1;IssuanceEnabled=$false}
$bytes=[Text.Encoding]::UTF8.GetBytes(($state|ConvertTo-Json -Compress));$lock=[IO.File]::Open($attempt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$lock.Write($bytes,0,$bytes.Length)}finally{$lock.Dispose()}
# Exactly one attempt, fixed official test operation, no automatic retry/fallback.
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
try{
 $response=Invoke-WebRequest $packet.Uri -Method Post -Certificate $cert -ContentType "application/soap+xml; charset=utf-8; action=`"http://www.prefeitura.sp.gov.br/nfe/ws/testeenvio`"" -Body ([Text.Encoding]::UTF8.GetBytes($packet.Body)) -TimeoutSec 45 -UseBasicParsing -MaximumRedirection 0
 [IO.File]::WriteAllText((Join-Path $candidate 'official-test-response.soap.xml'),$response.Content,[Text.UTF8Encoding]::new($false))
 $soap=Read-AtpMunicipalXml $response.Content;$nodes=$soap.SelectNodes("//*[local-name()='RetornoXML']");if($nodes.Count -ne 1){throw 'ATP_OFFICIAL_TEST_RETURN_INVALID'}
 $raw=$nodes[0].InnerText;$ret=Read-AtpMunicipalXml $raw;$returnPath=Join-Path $candidate 'official-test-return.xml';[IO.File]::WriteAllText($returnPath,$raw,[Text.UTF8Encoding]::new($false))
 $summary=[pscustomobject]@{HttpStatus=[int]$response.StatusCode;Action='testar';SoapAction=$packet.SoapAction;Success=($ret.SelectSingleNode("/*/*[local-name()='Cabecalho']/*[local-name()='Sucesso']").InnerText -eq 'true');Errors=@($ret.SelectNodes("/*/*[local-name()='Erro']")|ForEach-Object {$_.InnerText.Substring(0,[Math]::Min(1200,$_.InnerText.Length))});Warnings=@($ret.SelectNodes("/*/*[local-name()='Alerta']")|ForEach-Object {$_.InnerText.Substring(0,[Math]::Min(1200,$_.InnerText.Length))});ReturnSha256=(Get-FileHash -LiteralPath $returnPath -Algorithm SHA256).Hash.ToLowerInvariant();SignedXmlSha256=$signedHash;NFeElements=$ret.SelectNodes("//*[local-name()='NFe']").Count;NFeKeys=$ret.SelectNodes("//*[local-name()='ChaveNFe']").Count;PostCount=1;IssuanceEnabled=$false;FiscalStorageWrites=$false;CertificateExported=$false}
 $summary|ConvertTo-Json -Depth 5 -Compress|Set-Content -LiteralPath (Join-Path $candidate 'official-test-summary.json') -Encoding UTF8
 $summary|ConvertTo-Json -Depth 5 -Compress
}catch{
 $failure=[pscustomobject]@{Action='testar';PostCountMaximum=1;Outcome='UNCONFIRMED_DO_NOT_RETRY';HttpStatus=if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{0};IssuanceEnabled=$false}
 $failure|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $candidate 'official-test-failure.json') -Encoding UTF8
 $failure|ConvertTo-Json -Compress;throw 'ATP_OFFICIAL_TEST_UNCONFIRMED_NO_RETRY'
}
