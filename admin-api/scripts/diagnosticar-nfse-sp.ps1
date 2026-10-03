param(
  [Parameter(Mandatory=$true)][ValidatePattern('^\d{14}$')][string]$Cnpj
)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -lt 6){Add-Type -AssemblyName System.Security}else{Add-Type -AssemblyName System.Security.Cryptography.Xml}
# Read-only municipal query. Never exports a private key or issues a fiscal document.
$certs=@(Get-ChildItem Cert:\CurrentUser\My | Where-Object {$_.Subject -match [regex]::Escape($Cnpj) -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) -and $_.NotBefore -lt (Get-Date)})
if($certs.Count -ne 1){throw 'Certificado válido e único da empresa não localizado.'}
$cert=$certs[0]
$xml=[xml]::new();$xml.PreserveWhitespace=$true;$xml.XmlResolver=$null
$xml.LoadXml("<p:PedidoConsultaCNPJ xmlns:p='http://www.prefeitura.sp.gov.br/nfe'><Cabecalho Versao='2'><CPFCNPJRemetente><CNPJ>$Cnpj</CNPJ></CPFCNPJRemetente></Cabecalho><CNPJContribuinte><CNPJ>$Cnpj</CNPJ></CNPJContribuinte></p:PedidoConsultaCNPJ>")
$sig=[Security.Cryptography.Xml.SignedXml]::new($xml)
$rsa=[Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
try {
  $sig.SigningKey=$rsa
  $sig.SignedInfo.SignatureMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigRSASHA1Url
  $ref=[Security.Cryptography.Xml.Reference]::new('');$ref.DigestMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigSHA1Url
  $ref.AddTransform([Security.Cryptography.Xml.XmlDsigEnvelopedSignatureTransform]::new())
  $ref.AddTransform([Security.Cryptography.Xml.XmlDsigC14NTransform]::new());$sig.AddReference($ref)
  $info=[Security.Cryptography.Xml.KeyInfo]::new();$info.AddClause([Security.Cryptography.Xml.KeyInfoX509Data]::new($cert));$sig.KeyInfo=$info
  $sig.ComputeSignature();[void]$xml.DocumentElement.AppendChild($xml.ImportNode($sig.GetXml(),$true))
  $check=[Security.Cryptography.Xml.SignedXml]::new($xml)
  $check.LoadXml($xml.SelectSingleNode("//*[local-name()='Signature']"))
  if(-not $check.CheckSignature($cert,$true)){throw 'Falha na validacao local da assinatura.'}
  $msg=[Security.SecurityElement]::Escape($xml.OuterXml)
  $soap="<s:Envelope xmlns:s='http://www.w3.org/2003/05/soap-envelope'><s:Body><ConsultaCNPJRequest xmlns='http://www.prefeitura.sp.gov.br/nfe'><VersaoSchema>2</VersaoSchema><MensagemXML>$msg</MensagemXML></ConsultaCNPJRequest></s:Body></s:Envelope>"
  $r=Invoke-WebRequest 'https://nfews.prefeitura.sp.gov.br/lotenfe.asmx' -Method Post -Certificate $cert -ContentType 'application/soap+xml; charset=utf-8; action="http://www.prefeitura.sp.gov.br/nfe/ws/consultaCNPJ"' -Body ([Text.Encoding]::UTF8.GetBytes($soap)) -TimeoutSec 45 -UseBasicParsing
  $env=[xml]::new();$env.XmlResolver=$null;$env.LoadXml($r.Content)
  $node=$env.SelectSingleNode("//*[local-name()='RetornoXML']");if(-not $node){throw 'Resposta sem RetornoXML.'}
  $ret=[xml]::new();$ret.XmlResolver=$null;$ret.LoadXml($node.InnerText)
  [pscustomobject]@{
    Consulta='ConsultaCNPJ';DataUtc=[DateTime]::UtcNow.ToString('o');CertificadoValidoAte=$cert.NotAfter.ToString('yyyy-MM-dd');AssinaturaLocalValida=$true
    Sucesso=$ret.SelectSingleNode("//*[local-name()='Sucesso']").InnerText
    Inscricoes=@($ret.SelectNodes("//*[local-name()='Detalhe']") | ForEach-Object {[pscustomobject]@{CCM=$_.InscricaoMunicipal;EmiteNFe=$_.EmiteNFe}})
    Erros=@($ret.SelectNodes("//*[local-name()='Erro']") | ForEach-Object InnerText)
    EmissaoRealExecutada=$false
  } | ConvertTo-Json -Depth 4
} finally {$rsa.Dispose()}
