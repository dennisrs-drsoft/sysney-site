$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../admin-api/scripts/assinar-dps-restrita.ps1')
$xml=Get-Content (Join-Path $PSScriptRoot '../postman/fixtures/dps-restrita.synthetic.xml') -Raw
$key=[Security.Cryptography.RSA]::Create(2048)
$request=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=QA SINTETICO SEM VALIDADE FISCAL',$key,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
$cert=$request.CreateSelfSigned([datetimeoffset]::UtcNow.AddMinutes(-1),[datetimeoffset]::UtcNow.AddDays(1))
try{
 try{$signed=Sign-DpsRestrita $xml $cert (Join-Path $PSScriptRoot '../admin-api/schemas/nfse-nacional-restrita')}catch{Write-Output $script:ultimoErroSchema;throw}
 if($signed -notmatch 'SignatureValue'){throw 'Assinatura nao gerada.'}
 $parsed=Read-DpsRestrita $signed
 $verify=[Security.Cryptography.Xml.SignedXml]::new($parsed.Doc)
 $verify.LoadXml($parsed.Doc.SelectSingleNode('//ds:Signature',$parsed.Ns))
 if(!$verify.CheckSignature($cert,$true)){throw 'Assinatura sintetica nao confere.'}
 $generated=& node (Join-Path $PSScriptRoot 'helpers/build-dps-synthetic.mjs')
 if($LASTEXITCODE -ne 0){throw 'Gerador sintetico falhou.'}
 [void](Sign-DpsRestrita ($generated -join "`n") $cert (Join-Path $PSScriptRoot '../admin-api/schemas/nfse-nacional-restrita'))
 $parsed.Doc.SelectSingleNode('/n:DPS/n:infDPS/n:valores/n:vServPrest/n:vServ',$parsed.Ns).InnerText='2.00'
 $verify=[Security.Cryptography.Xml.SignedXml]::new($parsed.Doc);$verify.LoadXml($parsed.Doc.SelectSingleNode('//ds:Signature',$parsed.Ns))
 if($verify.CheckSignature($cert,$true)){throw 'Adulteracao nao detectada.'}
 try{[void](Read-DpsRestrita ($xml.Replace('<tpAmb>2</tpAmb>','<tpAmb>1</tpAmb>')));throw 'Producao indevidamente aceita.'}catch{if($_.Exception.Message -eq 'Producao indevidamente aceita.'){throw}}
 'Assinatura sintetica RSA-SHA1 do perfil nacional + XSD oficial restrito + adulteracao + bloqueio producao: OK. Nenhum certificado instalado e nenhuma chamada de rede.'
}finally{$cert.Dispose();$key.Dispose()}
