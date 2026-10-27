$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../admin-api/scripts/assinar-atp-municipal.ps1')
$rsa=[Security.Cryptography.RSA]::Create(2048)
$request=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=ATP QA SEM VALIDADE FISCAL',$rsa,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
$cert=$request.CreateSelfSigned([datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddDays(1))
try{
 foreach($kind in @('CPF','CNPJ')){
  $json=& node (Join-Path $PSScriptRoot 'helpers/build-atp-municipal.mjs') $kind;if($LASTEXITCODE -ne 0){throw 'Fixture failed'};$draft=$json|ConvertFrom-Json
  foreach($field in @('xml','testXml','queryXml')){
   $signed=Sign-AtpMunicipal $draft.$field $cert (Join-Path $PSScriptRoot '../admin-api/schemas/nfse-sp')
   $doc=Read-AtpMunicipalXml $signed;$sig=[Security.Cryptography.Xml.SignedXml]::new($doc);$sig.LoadXml($doc.DocumentElement.LastChild)
   if(!$sig.CheckSignature($cert,$true)){throw 'Signature failed'}
   if($field -ne 'queryXml'){
    if((Get-AtpMunicipalChain $doc) -ne $draft.chain){throw 'Chain mismatch'}
    $pub=[Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPublicKey($cert)
    try{if(!$pub.VerifyData([Text.Encoding]::ASCII.GetBytes($draft.chain),[Convert]::FromBase64String($doc.SelectSingleNode('/*/RPS/Assinatura').InnerText),[Security.Cryptography.HashAlgorithmName]::SHA1,[Security.Cryptography.RSASignaturePadding]::Pkcs1)){throw 'RPS signature failed'}}finally{$pub.Dispose()}
    $doc.SelectSingleNode('/*/RPS/ValorServicos').InnerText='200.00';$sig=[Security.Cryptography.Xml.SignedXml]::new($doc);$sig.LoadXml($doc.DocumentElement.LastChild);if($sig.CheckSignature($cert,$true)){throw 'Tamper accepted'}
   }
  }
 }
 'ATP CPF/CNPJ: XSD v1 + RPS ASCII RSA-SHA1 + XMLDSIG + adulteracao OK. Certificado somente em memoria; nenhuma rede.'
}finally{$cert.Dispose();$rsa.Dispose()}
