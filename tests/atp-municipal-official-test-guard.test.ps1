$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../admin-api/scripts/assinar-atp-municipal.ps1')
. (Join-Path $PSScriptRoot '../admin-api/scripts/atp-municipal-test-only.ps1')
$json=& node (Join-Path $PSScriptRoot 'helpers/build-atp-municipal-official-test.mjs');if($LASTEXITCODE -ne 0){throw 'Fixture failed'};$draft=$json|ConvertFrom-Json
$packet=New-AtpMunicipalOfficialTestPacket $draft.testXml 'testar'
if($packet.Uri -cne 'https://nfews.prefeitura.sp.gov.br/lotenfe.asmx' -or $packet.SoapAction -cne 'http://www.prefeitura.sp.gov.br/nfe/ws/testeenvio' -or $packet.IssuanceEnabled -ne $false -or $packet.Body -notmatch '<TesteEnvioLoteRPSRequest ' -or $packet.Body -match '<EnvioRPSRequest\b'){throw 'Test packet escaped test method'}
foreach($action in @('emitir','consultar','EnvioRPS','EnvioLoteRPS','testeenvio')){
 try{[void](New-AtpMunicipalOfficialTestPacket $draft.testXml $action);throw 'Unexpected action allowed'}catch{if($_.Exception.Message -eq 'Unexpected action allowed'){throw}}
}
foreach($xml in @($draft.xml,$draft.queryXml,$draft.testXml.Replace('TQA27','SB001'),$draft.testXml.Replace('TESTE SEM VALIDADE FISCAL','CLIENTE REAL'),$draft.testXml.Replace('1.00','100.00'))){
 try{[void](New-AtpMunicipalOfficialTestPacket $xml 'testar');throw 'Unexpected input allowed'}catch{if($_.Exception.Message -eq 'Unexpected input allowed'){throw}}
}
$key=[Security.Cryptography.RSA]::Create(2048)
$req=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=QA TEST ONLY',$key,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
$cert=$req.CreateSelfSigned([datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddDays(1))
try{$signed=Sign-AtpMunicipal $draft.testXml $cert (Join-Path $PSScriptRoot '../admin-api/schemas/nfse-sp');[void](New-AtpMunicipalOfficialTestPacket $signed 'testar')}finally{$cert.Dispose();$key.Dispose()}
$source=Get-Content (Join-Path $PSScriptRoot '../admin-api/scripts/ensaiar-atp-municipal-teste.ps1') -Raw
if(@([regex]::Matches($source,'Invoke-WebRequest')).Count -ne 1 -or $source -notmatch "FileMode\]::CreateNew" -or $source -notmatch "ValidateSet\('testar'\)"){throw 'Test runner must stay single attempt/test-only'}
'Guard test-only + payload ficticio + XML/XSD/assinatura sintetica: OK. Nenhuma rede.'
