param([switch]$ValidarSomente)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
# Entrada pelo stdin, nunca pela linha de comando. A chave permanece no Windows.
$entrada=[Console]::In.ReadToEnd() | ConvertFrom-Json
if($entrada.acao -notin @('testar','emitir','consultar')){throw 'Ação fiscal inválida.'}
if($entrada.cnpj -notmatch '^\d{14}$'){throw 'CNPJ inválido.'}
if($entrada.acao -eq 'emitir' -and $env:NFSE_SP_PRODUCAO_HABILITADA -ne 'true'){throw 'Emissão real não habilitada neste computador.'}
if($PSVersionTable.PSVersion.Major -lt 6){Add-Type -AssemblyName System.Security}else{Add-Type -AssemblyName System.Security.Cryptography.Xml}
function LerXml([string]$texto){
  $settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null
  $reader=[Xml.XmlReader]::Create([IO.StringReader]::new($texto),$settings)
  try{$doc=[xml]::new();$doc.PreserveWhitespace=$true;$doc.XmlResolver=$null;$doc.Load($reader);return ,$doc}finally{$reader.Dispose()}
}
$xml=LerXml $entrada.xml
$remetente=$xml.SelectSingleNode("/*/Cabecalho/CPFCNPJRemetente/CNPJ")
if(-not $remetente -or $remetente.InnerText -ne $entrada.cnpj){throw 'Emitente divergente.'}
$metodos=@{
  testar=@('PedidoEnvioLoteRPS','TesteEnvioLoteRPSRequest','testeEnvioLoteRPS','PedidoEnvioLoteRPS_v02.xsd')
  emitir=@('PedidoEnvioRPS','EnvioRPSRequest','envioRPS','PedidoEnvioRPS_v02.xsd')
  consultar=@('PedidoConsultaNFe','ConsultaNFeRequest','consultaNFe','PedidoConsultaNFe_v02.xsd')
}
$m=$metodos[$entrada.acao]
if($xml.DocumentElement.LocalName -ne $m[0] -or $xml.DocumentElement.NamespaceURI -ne 'http://www.prefeitura.sp.gov.br/nfe'){throw 'XML incompatível com a operação.'}
if($xml.SelectNodes("//*[local-name()='Signature']").Count -ne 0){throw 'Entrada deve ser XML não assinado.'}
if($ValidarSomente){
  # Assinatura fictícia apenas para verificação estrutural offline. Nunca transmitir.
  $dummy=LerXml '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>AA==</DigestValue></Reference></SignedInfo><SignatureValue>AA==</SignatureValue><KeyInfo><X509Data><X509Certificate>AA==</X509Certificate></X509Data></KeyInfo></Signature>'
  [void]$xml.DocumentElement.AppendChild($xml.ImportNode($dummy.DocumentElement,$true))
}else{
  $certs=@(Get-ChildItem Cert:\CurrentUser\My | Where-Object {$_.Subject -match [regex]::Escape($entrada.cnpj) -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) -and $_.NotBefore -lt (Get-Date)})
  if($certs.Count -ne 1){throw 'Certificado válido e único da empresa não localizado.'}
  $cert=$certs[0];$rsa=[Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
  try{
    if($entrada.acao -ne 'consultar'){
      if($xml.SelectNodes('/*/RPS').Count -ne 1 -or $entrada.cadeia -notmatch '^[\x20-\x7e]{90}$'){throw 'Assinatura do RPS inválida.'}
      $assinatura=$rsa.SignData([Text.Encoding]::ASCII.GetBytes($entrada.cadeia),[Security.Cryptography.HashAlgorithmName]::SHA1,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
      if(-not $rsa.VerifyData([Text.Encoding]::ASCII.GetBytes($entrada.cadeia),$assinatura,[Security.Cryptography.HashAlgorithmName]::SHA1,[Security.Cryptography.RSASignaturePadding]::Pkcs1)){throw 'Assinatura do RPS não validada.'}
      $xml.SelectSingleNode('/*/RPS/Assinatura').InnerText=[Convert]::ToBase64String($assinatura)
    }
    $sig=[Security.Cryptography.Xml.SignedXml]::new($xml);$sig.SigningKey=$rsa
    $sig.SignedInfo.SignatureMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigRSASHA1Url
    $ref=[Security.Cryptography.Xml.Reference]::new('');$ref.DigestMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigSHA1Url
    $ref.AddTransform([Security.Cryptography.Xml.XmlDsigEnvelopedSignatureTransform]::new());$ref.AddTransform([Security.Cryptography.Xml.XmlDsigC14NTransform]::new());$sig.AddReference($ref)
    $info=[Security.Cryptography.Xml.KeyInfo]::new();$info.AddClause([Security.Cryptography.Xml.KeyInfoX509Data]::new($cert));$sig.KeyInfo=$info
    $sig.ComputeSignature();[void]$xml.DocumentElement.AppendChild($xml.ImportNode($sig.GetXml(),$true))
    $check=[Security.Cryptography.Xml.SignedXml]::new($xml);$check.LoadXml($xml.SelectSingleNode("//*[local-name()='Signature']"))
    if(-not $check.CheckSignature($cert,$true)){throw 'Assinatura XML não validada.'}
  }finally{$rsa.Dispose()}
}
$schemas=[Xml.Schema.XmlSchemaSet]::new()
# Imports resolvem apenas os XSD oficiais distribuídos com o programa.
$schemaPath=Join-Path $PSScriptRoot "../schemas/nfse-sp/$($m[3])"
[void]$schemas.Add('http://www.prefeitura.sp.gov.br/nfe',$schemaPath);$schemas.Compile();$xml.Schemas=$schemas
$erros=[Collections.Generic.List[string]]::new()
$xml.Validate([Xml.Schema.ValidationEventHandler]{param($sender,$eventArgs)$erros.Add($eventArgs.Message)})
if($erros.Count -gt 0){throw ('XML fora do schema oficial: '+($erros -join ' | '))}
if($ValidarSomente){[pscustomobject]@{schemaValido=$true;transmitido=$false}|ConvertTo-Json -Compress;exit 0}
$msg=[Security.SecurityElement]::Escape($xml.OuterXml)
$soap="<s:Envelope xmlns:s='http://www.w3.org/2003/05/soap-envelope'><s:Body><$($m[1]) xmlns='http://www.prefeitura.sp.gov.br/nfe'><VersaoSchema>2</VersaoSchema><MensagemXML>$msg</MensagemXML></$($m[1])></s:Body></s:Envelope>"
$response=Invoke-WebRequest 'https://nfews.prefeitura.sp.gov.br/lotenfe.asmx' -Method Post -Certificate $cert -ContentType "application/soap+xml; charset=utf-8; action=`"http://www.prefeitura.sp.gov.br/nfe/ws/$($m[2])`"" -Body ([Text.Encoding]::UTF8.GetBytes($soap)) -TimeoutSec 45 -UseBasicParsing
$envXml=LerXml $response.Content;$node=$envXml.SelectSingleNode("//*[local-name()='RetornoXML']");if(-not $node){throw 'Resposta fiscal sem RetornoXML; consulte antes de repetir.'}
$ret=LerXml $node.InnerText
$chave=$ret.SelectSingleNode("//*[local-name()='ChaveNFe']")
$nota=$ret.SelectSingleNode("//*[local-name()='NFe']")
[pscustomobject]@{sucesso=($ret.SelectSingleNode("//*[local-name()='Sucesso']").InnerText -eq 'true');erros=@($ret.SelectNodes("//*[local-name()='Erro']")|ForEach-Object InnerText);alertas=@($ret.SelectNodes("//*[local-name()='Alerta']")|ForEach-Object InnerText);xml=$ret.OuterXml;numero=if($chave){[string]$chave.NumeroNFe}else{$null};inscricao=if($chave){[string]$chave.InscricaoPrestador}else{$null};verificacao=if($chave){[string]$chave.CodigoVerificacao}else{$null};tomador=if($nota){[string]$nota.CPFCNPJTomador.CNPJ}else{$null};valorFinal=if($nota){[string]$nota.ValorFinalCobrado}else{$null};descricao=if($nota){[string]$nota.Discriminacao}else{$null};teste=($entrada.acao -eq 'testar')}|ConvertTo-Json -Depth 5 -Compress
