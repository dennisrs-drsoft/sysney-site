$ErrorActionPreference='Stop'
# All operations, including read-only SOAP queries, remain off by default.
if($env:ATP_MUNICIPAL_EXECUTOR_ENABLED -ne 'true'){throw 'ATP_MUNICIPAL_EXECUTOR_DISABLED'}
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$e=[Console]::In.ReadToEnd()|ConvertFrom-Json
if($e.action -notin @('testar','emitir','consultar') -or $e.workId -notmatch '^[a-f0-9]{64}$'){throw 'ATP_ACTION_INVALID'}
if($e.action -eq 'emitir' -and ($env:ATP_MUNICIPAL_ISSUANCE_ENABLED -ne 'true' -or $e.confirmed -ne $true)){throw 'ATP_MUNICIPAL_ISSUANCE_DISABLED'}
$sha=[Security.Cryptography.SHA256]::Create();try{$hash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($e.xml)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
if($hash -ne $e.xmlHash){throw 'ATP_XML_HASH_MISMATCH'}
. (Join-Path $PSScriptRoot 'assinar-atp-municipal.ps1')
$doc=Read-AtpMunicipalXml $e.xml
$expected=@{testar='PedidoEnvioLoteRPS';emitir='PedidoEnvioRPS';consultar='PedidoConsultaNFe'}
if($doc.DocumentElement.LocalName -ne $expected[$e.action]){throw 'ATP_ACTION_XML_MISMATCH'}
if($e.action -ne 'consultar'){
 if((Get-AtpMunicipalChain $doc) -ne $e.chain){throw 'ATP_CHAIN_MISMATCH'}
 if([string]$doc.SelectSingleNode('/*/RPS/DataEmissao').InnerText -ge '2026-11-01'){throw 'ATP_NOVEMBER_ROUTING_REVIEW_REQUIRED'}
}
if($e.action -eq 'emitir'){
 $civil=[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([datetime]::UtcNow,'E. South America Standard Time').ToString('yyyy-MM-dd')
 if($civil -ge '2026-11-01' -or $civil -ne [string]$doc.SelectSingleNode('/*/RPS/DataEmissao').InnerText){throw 'ATP_FISCAL_DATE_REVIEW_REQUIRED'}
}
$thumb=$env:ATP_MUNICIPAL_CERT_THUMBPRINT
if($thumb -notmatch '^[A-Fa-f0-9]{40}$'){throw 'ATP_CERT_BINDING_REQUIRED'}
$cert=Get-Item -LiteralPath ('Cert:\LocalMachine\My\'+$thumb)
if(!$cert.HasPrivateKey -or $cert.Subject -notmatch '57767099000179' -or $cert.NotAfter -le (Get-Date) -or $cert.NotBefore -gt (Get-Date)){throw 'ATP_CERT_INVALID'}
$signed=Sign-AtpMunicipal $e.xml $cert (Join-Path $PSScriptRoot '../schemas/nfse-sp')
$methods=@{testar=@('TesteEnvioLoteRPSRequest','testeenvio');emitir=@('EnvioRPSRequest','envioRPS');consultar=@('ConsultaNFeRequest','consultaNFe')};$m=$methods[$e.action]
$soap="<s:Envelope xmlns:s='http://www.w3.org/2003/05/soap-envelope'><s:Body><$($m[0]) xmlns='http://www.prefeitura.sp.gov.br/nfe'><VersaoSchema>1</VersaoSchema><MensagemXML>$([Security.SecurityElement]::Escape($signed))</MensagemXML></$($m[0])></s:Body></s:Envelope>"
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$response=Invoke-WebRequest 'https://nfews.prefeitura.sp.gov.br/lotenfe.asmx' -Method Post -Certificate $cert -ContentType "application/soap+xml; charset=utf-8; action=`"http://www.prefeitura.sp.gov.br/nfe/ws/$($m[1])`"" -Body ([Text.Encoding]::UTF8.GetBytes($soap)) -TimeoutSec 45 -UseBasicParsing -MaximumRedirection 0
if($response.RawContentLength -gt 1000000){throw 'ATP_RESPONSE_LIMIT'}
$envelope=Read-AtpMunicipalXml $response.Content;$nodes=$envelope.SelectNodes("//*[local-name()='RetornoXML']")
if($nodes.Count -ne 1){throw 'ATP_RESPONSE_INVALID'}
$ret=Read-AtpMunicipalXml $nodes[0].InnerText
[pscustomobject]@{success=($ret.SelectSingleNode('/*/Cabecalho/Sucesso').InnerText -eq 'true');xml=$ret.OuterXml}|ConvertTo-Json -Compress
