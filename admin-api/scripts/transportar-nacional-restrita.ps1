# Entrada interna JSON via stdin; somente produção RESTRITA. Não é worker instalado.
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
. (Join-Path $PSScriptRoot 'assinar-dps-restrita.ps1')
function Get-SafeNationalErrors([string]$Raw){
 if(!$Raw -or $Raw.Length -gt 65536){return ''}
 try{
  $parsed=$Raw|ConvertFrom-Json
  $safe=@($parsed.erros|Select-Object -First 10|ForEach-Object {
   if($_.codigo -match '^[A-Za-z0-9_]{1,16}$'){
    $description=[string]$_.descricao -replace '<[^>]*>','' -replace '\d{11,14}','[documento]'
    @{codigo=$_.codigo;descricao=$description.Substring(0,[Math]::Min($description.Length,320))}
   }
  })
  if($safe.Count){return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((@{erros=$safe}|ConvertTo-Json -Depth 4 -Compress)))}
 }catch{}
 return ''
}
function Invoke-NationalRestricted($InputObject){
 if($InputObject.environment -ne 'homologacao' -or $InputObject.service -notin @('sefin','danfse')){throw 'Ambiente ou servico nao permitido.'}
 $method=[string]$InputObject.method;$path=[string]$InputObject.path
 if($InputObject.service -eq 'sefin'){
  if(($method -eq 'GET' -and $path -notmatch '^/(dps/DPS3550308257767099000179\d{20}|nfse/\d{50}(/eventos/\d{6}/[1-9]\d{0,2})?)$') -or ($method -notin @('GET','POST')) -or ($method -eq 'POST' -and $path -ne '/nfse')){throw 'Operacao nao permitida.'}
  $base='https://sefin.producaorestrita.nfse.gov.br/SefinNacional';$accept='application/json'
 }else{
  if($method -ne 'GET' -or $path -notmatch '^/danfse/\d{50}$'){throw 'Somente consulta DANFSe restrita.'}
  $base='https://adn.producaorestrita.nfse.gov.br';$accept='application/pdf'
 }
 $config=Get-Content -Raw 'C:\ProgramData\SYSNEY\FiscalTeste\config.json'|ConvertFrom-Json
 $binding=@($config.emitentes|Where-Object empresa -eq 'sysney');if($binding.Count -ne 1 -or $binding[0].cnpj -ne '57767099000179'){throw 'Emitente nao vinculado.'}
 $cert=@(Get-ChildItem Cert:\LocalMachine\My|Where-Object {$_.Thumbprint -eq $binding[0].thumbprint -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) -and $_.NotBefore -lt (Get-Date)})
 if($cert.Count -ne 1){throw 'Certificado valido nao selecionado.'}
 $request=@{Uri=($base+$path);Method=$method;Certificate=$cert[0];UseBasicParsing=$true;MaximumRedirection=0;TimeoutSec=30;Headers=@{Accept=$accept}}
 if($method -eq 'POST'){
  if($env:SYSNEY_ALLOW_NATIONAL_RESTRICTED_SEND -ne 'true' -or $InputObject.explicitRestrictedApproval -ne $true){throw 'Envio restrito nao autorizado.'}
  $bytes=[Convert]::FromBase64String($InputObject.body.dpsXmlGZipB64);if($bytes.Length -gt 1000000){throw 'DPS excede limite.'}
  $inputStream=[IO.MemoryStream]::new($bytes);$gzip=[IO.Compression.GZipStream]::new($inputStream,[IO.Compression.CompressionMode]::Decompress);$out=[IO.MemoryStream]::new()
  try{$buf=New-Object byte[] 8192;while(($n=$gzip.Read($buf,0,$buf.Length)) -gt 0){$out.Write($buf,0,$n);if($out.Length -gt 1000000){throw 'DPS descompactada excede limite.'}};$xml=[Text.UTF8Encoding]::new($false,$true).GetString($out.ToArray())}finally{$out.Dispose();$gzip.Dispose();$inputStream.Dispose()}
  if($xml -match 'NAO TRANSMITIR|NÃO TRANSMITIR'){throw 'Fixture local nao pode ser transmitida.'}
  $d=Read-DpsRestrita $xml;Test-DpsSchema $d.Doc (Join-Path $PSScriptRoot '../schemas/nfse-nacional-restrita')
  $sig=@($d.Doc.SelectNodes('/n:DPS/ds:Signature',$d.Ns));if($sig.Count -ne 1){throw 'Assinatura unica obrigatoria.'}
  $signed=[Security.Cryptography.Xml.SignedXml]::new($d.Doc);$signed.LoadXml($sig[0]);if($signed.SignedInfo.References.Count -ne 1){throw 'Referencia unica obrigatoria.'}
  $ref=$signed.SignedInfo.References[0]
  if($ref.Uri -ne ('#'+$d.Id) -or $ref.DigestMethod -ne [Security.Cryptography.Xml.SignedXml]::XmlDsigSHA1Url -or $ref.TransformChain.Count -ne 2 -or $ref.TransformChain[0].Algorithm -ne [Security.Cryptography.Xml.SignedXml]::XmlDsigEnvelopedSignatureTransformUrl -or $ref.TransformChain[1].Algorithm -ne [Security.Cryptography.Xml.SignedXml]::XmlDsigC14NTransformUrl -or $signed.SignedInfo.CanonicalizationMethod -ne [Security.Cryptography.Xml.SignedXml]::XmlDsigC14NTransformUrl -or $signed.SignedInfo.SignatureMethod -ne [Security.Cryptography.Xml.SignedXml]::XmlDsigRSASHA1Url){throw 'Perfil de assinatura nacional invalido.'}
  if(!$signed.CheckSignature($cert[0],$true)){throw 'Assinatura nao corresponde ao certificado configurado.'}
  if($config.storage -notmatch '^[a-z0-9]{3,24}$'){throw 'Storage invalido.'}
  # Insert único na fila privada antes do POST oficial. Nunca remover em timeout.
  $token=(Invoke-RestMethod 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fstorage.azure.com%2F' -Headers @{Metadata='true'} -TimeoutSec 10).access_token
  $sha=[Security.Cryptography.SHA256]::Create();try{$hash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($xml)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
  $claim=@{PartitionKey='nacional-restrita-emissoes';RowKey=$d.Id;hash=$hash;em=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress
  try{[void](Invoke-WebRequest "https://$($config.storage).table.core.windows.net/FiscalFila" -Method Post -Headers @{Authorization="Bearer $token";'x-ms-version'='2019-02-02';Accept='application/json;odata=nometadata'} -ContentType 'application/json' -Body $claim -UseBasicParsing -TimeoutSec 15)}catch{throw 'Reserva nao confirmada. Somente consultar DPS; nao repetir POST.'}
  $request.ContentType='application/json';$request.Body=[Text.Encoding]::UTF8.GetBytes(($InputObject.body|ConvertTo-Json -Compress))
 }
 try{$response=Invoke-WebRequest @request;$content=if($response.Content -is [byte[]]){$response.Content}else{[Text.Encoding]::UTF8.GetBytes([string]$response.Content)};if($content.Length -gt 5000000){throw 'Retorno excede limite.'};return @{status=[int]$response.StatusCode;body=[Convert]::ToBase64String($content);encoding='base64';contentType=[string]$response.Headers['Content-Type']}}catch{
  $status=if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{0}
  # Não devolver XML/PII ou texto arbitrário de erro do provedor em diagnóstico.
  $body=''
  if($status -in @(400,403)){
   $body=Get-SafeNationalErrors ([string]$_.ErrorDetails.Message)
   if(!$body){
   try{
    $stream=$_.Exception.Response.GetResponseStream();$reader=[IO.StreamReader]::new($stream)
    try{$raw=$reader.ReadToEnd()}finally{$reader.Dispose()}
    $body=Get-SafeNationalErrors $raw
   }catch{}
   }
  }
  return @{status=$status;body=$body;encoding='base64';resultado='consultar-antes-de-repetir'}
 }
}
if($MyInvocation.InvocationName -ne '.'){
 try{$raw=[Console]::In.ReadToEnd();if($raw.Length -gt 1500000){throw 'Entrada excede limite.'};Invoke-NationalRestricted ($raw|ConvertFrom-Json)|ConvertTo-Json -Depth 6 -Compress}catch{[Console]::Error.Write('Transporte restrito nao concluido; consultar DPS antes de repetir.');exit 1}
}
