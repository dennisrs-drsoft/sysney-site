# Entrada interna; configuracao e certificados locais protegidos. Sem parametros de URL.
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
. (Join-Path $PSScriptRoot 'assinar-dps-nacional.ps1')
function Get-NationalTable($Config,[string]$Table,[string]$Partition,[string]$Row){
 if($Table -notin @('AdminDocumentos','FiscalFila') -or $Partition -notmatch '^[a-z0-9-]+$' -or $Row -notmatch '^[a-z0-9-]+$'){throw 'Registro privado invalido.'}
 $token=(Invoke-RestMethod 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fstorage.azure.com%2F' -Headers @{Metadata='true'} -TimeoutSec 10).access_token
 $uri="https://$($Config.storageAccount).table.core.windows.net/$Table(PartitionKey='$Partition',RowKey='$Row')"
 return Invoke-RestMethod -Uri $uri -Headers @{Authorization="Bearer $token";'x-ms-version'='2019-02-02';Accept='application/json;odata=nometadata'} -TimeoutSec 15
}
function Hash-NationalBytes([byte[]]$Bytes){$sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function Read-NationalBytes([IO.Stream]$Stream,[int]$Limit){
 $out=[IO.MemoryStream]::new();try{$buffer=New-Object byte[] 8192;while(($n=$Stream.Read($buffer,0,$buffer.Length)) -gt 0){if($out.Length+$n -gt $Limit){throw 'Retorno nacional excede limite.'};$out.Write($buffer,0,$n)};return ,$out.ToArray()}finally{$out.Dispose()}
}
function Test-NationalSignatureProfile($Signed,[string]$Id){
 $canon=@('http://www.w3.org/TR/2001/REC-xml-c14n-20010315','http://www.w3.org/2001/10/xml-exc-c14n#')
 if($Signed.SignedInfo.References.Count -ne 1 -or $Signed.SignedInfo.CanonicalizationMethod -notin $canon -or $Signed.SignedInfo.SignatureMethod -notin @('http://www.w3.org/2000/09/xmldsig#rsa-sha1','http://www.w3.org/2001/04/xmldsig-more#rsa-sha256')){throw 'Perfil de assinatura nao suportado.'}
 $ref=$Signed.SignedInfo.References[0]
 if($ref.Uri -cne ('#'+$Id) -or $ref.DigestMethod -notin @('http://www.w3.org/2000/09/xmldsig#sha1','http://www.w3.org/2001/04/xmlenc#sha256') -or $ref.TransformChain.Count -lt 1 -or $ref.TransformChain.Count -gt 2){throw 'Referencia de assinatura invalida.'}
 foreach($transform in $ref.TransformChain){if($transform.Algorithm -notin ($canon+@('http://www.w3.org/2000/09/xmldsig#enveloped-signature'))){throw 'Transformacao de assinatura nao permitida.'}}
}
function Invoke-NationalAdminNative($p){
 $config=Get-Content -LiteralPath 'C:\ProgramData\SYSNEY\NfseNacional\config.json' -Raw|ConvertFrom-Json
 if($config.paused -ne $false -or $config.storageAccount -notmatch '^[a-z0-9]{3,24}$' -or $p.empresa -notin @('sysney','drsoft') -or $p.ambiente -notin @('homologacao','producao') -or $p.acao -notin @('sign','request','verify')){throw 'Servico nacional nao habilitado.'}
 $bindings=Get-Content -LiteralPath 'C:\ProgramData\SYSNEY\FiscalTeste\config.json' -Raw|ConvertFrom-Json
 $binding=@($bindings.emitentes|Where-Object empresa -eq $p.empresa)
 if($binding.Count -ne 1 -or $binding[0].cnpj -notmatch '^\d{14}$' -or $binding[0].cnpj -ne $p.cnpj){throw 'Emitente nacional divergente.'}
 $cert=Get-Item -LiteralPath ('Cert:\LocalMachine\My\'+$binding[0].thumbprint)
 if(!$cert.HasPrivateKey -or $cert.NotAfter -lt (Get-Date) -or $cert.NotBefore -gt (Get-Date)){throw 'Certificado nacional invalido.'}
 $schema=if($p.ambiente -eq 'producao'){'nfse-nacional-producao'}else{'nfse-nacional-restrita'};$schema=Join-Path $PSScriptRoot ('../schemas/'+$schema)
 if($p.acao -eq 'sign'){
  if($config.allowSigning -ne $true){throw 'Assinatura nacional bloqueada.'}
  $bytes=[Convert]::FromBase64String($p.xmlBase64);if($bytes.Length -gt 1000000){throw 'DPS excede limite.'}
  $xml=[Text.UTF8Encoding]::new($false,$true).GetString($bytes)
  $signed=Sign-DpsNacional $xml $cert $schema $p.cnpj $p.ambiente
  return @{status=200;encoding='base64';body=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($signed));contentType='application/xml'}
 }
 if($p.acao -eq 'verify'){
  $bytes=[Convert]::FromBase64String($p.xmlBase64);if($bytes.Length -gt 1000000){throw 'XML excede limite.'}
  $xml=[Text.UTF8Encoding]::new($false,$true).GetString($bytes);if($xml -match '<!DOCTYPE|<!ENTITY'){throw 'XML oficial invalido.'}
  $settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null;$settings.MaxCharactersInDocument=1000000
  $reader=[Xml.XmlReader]::Create([IO.StringReader]::new($xml),$settings);$doc=[Xml.XmlDocument]::new();$doc.PreserveWhitespace=$true;$doc.XmlResolver=$null;try{$doc.Load($reader)}finally{$reader.Dispose()}
  $ns=[Xml.XmlNamespaceManager]::new($doc.NameTable);$ns.AddNamespace('n','http://www.sped.fazenda.gov.br/nfse');$ns.AddNamespace('ds','http://www.w3.org/2000/09/xmldsig#')
  $inf=@($doc.SelectNodes('/n:NFSe/n:infNFSe',$ns));$sig=@($doc.SelectNodes('/n:NFSe/ds:Signature',$ns))
  if($inf.Count -ne 1 -or $sig.Count -ne 1 -or $p.authorityKey -notmatch '^\d{50}$' -or $inf[0].GetAttribute('Id') -ne ('NFS'+$p.authorityKey)){throw 'Identidade oficial ambigua.'}
  $ids=@{};foreach($node in $doc.SelectNodes('//*[@Id]')){$id=$node.GetAttribute('Id');if($ids.ContainsKey($id)){throw 'Id oficial duplicado.'};$ids[$id]=$true}
  # Preload assinatura local sem DTD/rede, depois compilar NFSe do mesmo pacote.
  $schemas=[Xml.Schema.XmlSchemaSet]::new();$schemas.XmlResolver=[Xml.XmlUrlResolver]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Ignore
  $reader=[Xml.XmlReader]::Create((Join-Path $schema 'xmldsig-core-schema.xsd'),$settings);try{[void]$schemas.Add('http://www.w3.org/2000/09/xmldsig#',$reader)}finally{$reader.Dispose()}
  foreach($file in Get-ChildItem -LiteralPath $schema -Filter '*.xsd'){
   $reader=[Xml.XmlReader]::Create($file.FullName,$settings);$x=[Xml.XmlDocument]::new();$x.XmlResolver=$null;try{$x.Load($reader)}finally{$reader.Dispose()};foreach($a in $x.SelectNodes('//@schemaLocation')){if($a.Value -notmatch '^[A-Za-z0-9_.-]+\.xsd$'){throw 'Referencia XSD externa.'}}
  }
  [void]$schemas.Add('http://www.sped.fazenda.gov.br/nfse',(Join-Path $schema 'NFSe_v1.01.xsd'));$schemas.Compile();$doc.Schemas=$schemas;$script:officialErrors=0
  $doc.Validate([Xml.Schema.ValidationEventHandler]{param($s,$e)$script:officialErrors++});if($script:officialErrors){throw 'XML oficial fora do schema.'}
  $signed=[Security.Cryptography.Xml.SignedXml]::new($doc);$signed.LoadXml($sig[0]);Test-NationalSignatureProfile $signed ('NFS'+$p.authorityKey)
  $certNodes=@($sig[0].SelectNodes('ds:KeyInfo/ds:X509Data/ds:X509Certificate',$ns));if(!$certNodes.Count){throw 'Certificado oficial ausente.'}
  $official=[Security.Cryptography.X509Certificates.X509Certificate2]::new([Convert]::FromBase64String($certNodes[0].InnerText));$chain=[Security.Cryptography.X509Certificates.X509Chain]::new()
  try{
   $chain.ChainPolicy.RevocationMode=[Security.Cryptography.X509Certificates.X509RevocationMode]::Online;$chain.ChainPolicy.UrlRetrievalTimeout=[TimeSpan]::FromSeconds(10)
   foreach($node in $certNodes|Select-Object -Skip 1){[void]$chain.ChainPolicy.ExtraStore.Add([Security.Cryptography.X509Certificates.X509Certificate2]::new([Convert]::FromBase64String($node.InnerText)))}
   if(!$signed.CheckSignature($official,$true) -or !$chain.Build($official)){throw 'Assinatura ou cadeia oficial nao comprovada.'}
  }finally{$chain.Dispose();$official.Dispose()}
  $proof=@{xmlHash=(Hash-NationalBytes $bytes);schemaValid=$true;signatureValid=$true;chainValid=$true;verifiedAtUtc=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress
  return @{status=200;encoding='base64';body=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($proof));contentType='application/json'}
 }
 if($config.allowQueries -ne $true -or $p.service -notin @('sefin','danfse')){throw 'Consultas nacionais bloqueadas.'}
 $method=[string]$p.method;$path=[string]$p.path
 if($p.service -eq 'sefin'){
  $prefix='DPS35503082'+$p.cnpj
  if(($method -eq 'GET' -and $path -notmatch ('^/(dps/'+$prefix+'\d{20}|nfse/\d{50})$')) -or ($method -eq 'POST' -and $path -ne '/nfse') -or $method -notin @('GET','POST')){throw 'Operacao nacional nao permitida.'}
  $base=if($p.ambiente -eq 'producao'){'https://sefin.nfse.gov.br/SefinNacional'}else{'https://sefin.producaorestrita.nfse.gov.br/SefinNacional'}
 }else{
  if($method -ne 'GET' -or $path -notmatch '^/danfse/\d{50}$'){throw 'Consulta DANFSe invalida.'}
  $base=if($p.ambiente -eq 'producao'){'https://adn.nfse.gov.br'}else{'https://adn.producaorestrita.nfse.gov.br'}
 }
 if($method -eq 'POST'){
  if($config.allowSend -ne $true -or $p.workId -notmatch '^[a-f0-9]{64}$' -or $p.unsignedHash -notmatch '^[a-f0-9]{64}$'){throw 'Emissao nacional nao habilitada.'}
  $policy=@($config.emitentes|Where-Object { $_.empresa -eq $p.empresa -and $_.ambiente -eq $p.ambiente -and $_.enabled -eq $true });if($policy.Count -ne 1){throw 'Politica nacional nao aprovada.'}
  $work=(Get-NationalTable $config 'AdminDocumentos' ('nfse-nacional-trabalhos-'+$p.empresa) $p.workId).json|ConvertFrom-Json
  if($work.status -ne 'transmitindo' -or $work.empresa -ne $p.empresa -or $work.cnpj -ne $p.cnpj -or $work.ambiente -ne $p.ambiente -or $work.aprovacao.hash -ne $work.hash -or $work.xmlHash -ne $p.unsignedHash -or $policy[0].perfilHash -ne $work.perfilHash -or [datetime]::UtcNow.Subtract([datetime]$work.aprovacao.em).TotalMinutes -gt 10 -or [datetime]::UtcNow.Subtract([datetime]$work.aprovacao.em).TotalMinutes -lt -0.5){throw 'Aprovacao nacional expirada ou divergente.'}
  $email=(Get-NationalTable $config 'AdminDocumentos' ('emails-'+$p.empresa) $work.emailId).json|ConvertFrom-Json
  if($email.status -ne 'emitindo_documento' -or $email.atualizadoEm -ne $work.emailBloqueadoEm -or $email.centavos -ne $work.dados.centavos -or $email.descricao -ne $work.emailDescricao -or $email.fluxo.nota){throw 'Cobranca alterada ou nota existente.'}
  $compressed=[Convert]::FromBase64String($p.body.dpsXmlGZipB64);if($compressed.Length -gt 1000000){throw 'DPS excede limite.'}
  $ms=[IO.MemoryStream]::new($compressed);$gz=[IO.Compression.GZipStream]::new($ms,[IO.Compression.CompressionMode]::Decompress)
  try{$bytes=Read-NationalBytes $gz 1000000}finally{$gz.Dispose();$ms.Dispose()}
  $xml=[Text.UTF8Encoding]::new($false,$true).GetString($bytes);if($xml -match 'NAO TRANSMITIR|NÃO TRANSMITIR'){throw 'Fixture nao pode ser transmitida.'}
  $parsed=Read-DpsNacional $xml $p.cnpj $p.ambiente;$expected=Read-DpsNacional $work.xml $p.cnpj $p.ambiente
  if($parsed.Id -ne $work.idDps -or $parsed.Doc.SelectSingleNode('/n:DPS/n:infDPS',$parsed.Ns).OuterXml -cne $expected.Doc.SelectSingleNode('/n:DPS/n:infDPS',$expected.Ns).OuterXml){throw 'XML diferente da aprovacao.'}
  Test-DpsNacionalSchema $parsed.Doc $schema
  $sig=@($parsed.Doc.SelectNodes('/n:DPS/ds:Signature',$parsed.Ns));if($sig.Count -ne 1){throw 'Assinatura DPS ausente.'}
  $signed=[Security.Cryptography.Xml.SignedXml]::new($parsed.Doc);$signed.LoadXml($sig[0]);Test-NationalSignatureProfile $signed $parsed.Id;if(!$signed.CheckSignature($cert,$true)){throw 'Assinatura DPS divergente.'}
  $token=(Invoke-RestMethod 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fstorage.azure.com%2F' -Headers @{Metadata='true'} -TimeoutSec 10).access_token
  $claim=@{PartitionKey=('nacional-admin-emissoes-'+$p.ambiente+'-'+$p.cnpj);RowKey=$parsed.Id;unsignedHash=$work.xmlHash;signedHash=(Hash-NationalBytes $bytes);workId=$p.workId;em=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json -Compress
  [void](Invoke-WebRequest "https://$($config.storageAccount).table.core.windows.net/FiscalFila" -Method Post -Headers @{Authorization="Bearer $token";'x-ms-version'='2019-02-02';Accept='application/json;odata=nometadata'} -ContentType 'application/json' -Body $claim -UseBasicParsing -TimeoutSec 15)
 }
 $request=[Net.HttpWebRequest]::Create($base+$path);$request.Method=$method;$request.AllowAutoRedirect=$false;$request.Timeout=30000;$request.ReadWriteTimeout=30000;[void]$request.ClientCertificates.Add($cert);$request.Accept=if($p.service -eq 'danfse'){'application/pdf'}else{'application/json'}
 if($method -eq 'POST'){$request.ContentType='application/json';$body=[Text.Encoding]::UTF8.GetBytes(($p.body|ConvertTo-Json -Compress));$request.ContentLength=$body.Length;$stream=$request.GetRequestStream();try{$stream.Write($body,0,$body.Length)}finally{$stream.Dispose()}}
 try{$response=$request.GetResponse();try{$bytes=Read-NationalBytes $response.GetResponseStream() 8000000;return @{status=[int]$response.StatusCode;encoding='base64';body=[Convert]::ToBase64String($bytes);contentType=$response.ContentType}}finally{$response.Dispose()}}catch [Net.WebException]{return @{status=$(if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{0});encoding='base64';body='';contentType='application/json'}}
}
if($MyInvocation.InvocationName -ne '.'){
 try{$raw=[Console]::In.ReadToEnd();if($raw.Length -gt 1500000){throw 'Entrada excede limite.'};Invoke-NationalAdminNative ($raw|ConvertFrom-Json)|ConvertTo-Json -Depth 7 -Compress}catch{[Console]::Error.Write('Operacao nacional nao confirmada. Consultar DPS antes de repetir.');exit 1}
}
