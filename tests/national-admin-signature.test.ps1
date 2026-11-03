$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../admin-api/scripts/assinar-dps-nacional.ps1')
$key=[Security.Cryptography.RSA]::Create(2048)
$request=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=QA SINTETICO SEM VALIDADE FISCAL',$key,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
$cert=$request.CreateSelfSigned([datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddDays(1))
try{
 $raw=& node (Join-Path $PSScriptRoot 'helpers/build-dps-admin-synthetic.mjs');if($LASTEXITCODE -ne 0){throw 'Gerador falhou.'}
 $items=($raw -join "`n")|ConvertFrom-Json
 foreach($item in $items){
  $schema=if($item.ambiente -eq 'producao'){'../admin-api/schemas/nfse-nacional-producao'}else{'../admin-api/schemas/nfse-nacional-restrita'}
  try{$signed=Sign-DpsNacional $item.xml $cert (Join-Path $PSScriptRoot $schema) $item.cnpj $item.ambiente}catch{Write-Output $script:ultimoErroSchema;throw}
  $p=Read-DpsNacional $signed $item.cnpj $item.ambiente;$verify=[Security.Cryptography.Xml.SignedXml]::new($p.Doc);$verify.LoadXml($p.Doc.SelectSingleNode('//ds:Signature',$p.Ns))
  if(!$verify.CheckSignature($cert,$true)){throw 'Assinatura local nao confere.'}
  $p.Doc.SelectSingleNode('/n:DPS/n:infDPS/n:valores/n:vServPrest/n:vServ',$p.Ns).InnerText='1.00'
  $verify=[Security.Cryptography.Xml.SignedXml]::new($p.Doc);$verify.LoadXml($p.Doc.SelectSingleNode('//ds:Signature',$p.Ns));if($verify.CheckSignature($cert,$true)){throw 'Adulteracao nao detectada.'}
  foreach($wrong in @(@('00000000000000',$item.ambiente),@($item.cnpj, $(if($item.ambiente -eq 'producao'){'homologacao'}else{'producao'})))){
   $rejected=$false;try{[void](Read-DpsNacional $signed $wrong[0] $wrong[1])}catch{$rejected=$true};if(!$rejected){throw 'Identidade/ambiente divergente aceito.'}
  }
 }
 'DPS administrativas de dois emitentes e ambientes: assinatura, XSD, adulteracao e isolamento OK. Sem rede ou certificado instalado.'
}finally{$cert.Dispose();$key.Dispose()}
