# Módulo sem efeitos ao importar. Não transmite, instala certificados ou exporta chave.
$ErrorActionPreference='Stop'
try{Add-Type -AssemblyName System.Security.Cryptography.Xml}catch{Add-Type -AssemblyName System.Security}
function Read-DpsRestrita([string]$Xml){
 if(!$Xml -or $Xml.Length -gt 1000000 -or $Xml -match '<!DOCTYPE|<!ENTITY'){throw 'DPS invalida.'}
 $settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null;$settings.MaxCharactersInDocument=1000000
 $reader=[Xml.XmlReader]::Create([IO.StringReader]::new($Xml),$settings)
 $doc=[Xml.XmlDocument]::new();$doc.PreserveWhitespace=$true;$doc.XmlResolver=$null
 try{$doc.Load($reader)}finally{$reader.Dispose()}
 $ns=[Xml.XmlNamespaceManager]::new($doc.NameTable);$ns.AddNamespace('n','http://www.sped.fazenda.gov.br/nfse');$ns.AddNamespace('ds','http://www.w3.org/2000/09/xmldsig#')
 if($doc.DocumentElement.LocalName -ne 'DPS' -or $doc.DocumentElement.NamespaceURI -ne 'http://www.sped.fazenda.gov.br/nfse'){throw 'Raiz DPS invalida.'}
 $inf=@($doc.SelectNodes('/n:DPS/n:infDPS',$ns));if($inf.Count -ne 1){throw 'infDPS ambiguo.'}
 if($inf[0].GetAttribute('Id') -notmatch '^DPS3550308257767099000179\d{20}$'){throw 'DPS nao pertence ao emitente SYSNEY/Sao Paulo.'}
 if($doc.SelectSingleNode('/n:DPS/n:infDPS/n:tpAmb',$ns).InnerText -ne '2' -or $doc.SelectSingleNode('/n:DPS/n:infDPS/n:prest/n:CNPJ',$ns).InnerText -ne '57767099000179'){throw 'Somente producao restrita SYSNEY.'}
 $serie=$doc.SelectSingleNode('/n:DPS/n:infDPS/n:serie',$ns).InnerText;$numero=$doc.SelectSingleNode('/n:DPS/n:infDPS/n:nDPS',$ns).InnerText
 if($serie -notmatch '^\d{1,5}$' -or $numero -notmatch '^[1-9]\d{0,14}$' -or $inf[0].GetAttribute('Id') -ne ('DPS3550308257767099000179'+$serie.PadLeft(5,'0')+$numero.PadLeft(15,'0'))){throw 'Id DPS diverge da serie ou numero.'}
 $ids=@{};foreach($node in $doc.SelectNodes('//*[@Id]')){$id=$node.GetAttribute('Id');if($ids.ContainsKey($id)){throw 'Id duplicado.'};$ids[$id]=$true}
 return @{Doc=$doc;Ns=$ns;Id=$inf[0].GetAttribute('Id')}
}
function Test-DpsSchema($Doc,[string]$SchemaDirectory){
 $path=[IO.Path]::GetFullPath($SchemaDirectory)
 $root=Join-Path $path 'DPS_v1.01.xsd';if(!(Test-Path -LiteralPath $root)){throw 'Schemas oficiais restritos nao configurados.'}
 # Somente includes locais na pasta de schemas fixada pelo operador.
 foreach($file in Get-ChildItem -LiteralPath $path -Filter '*.xsd'){
  [xml]$x=Get-Content -LiteralPath $file.FullName -Raw
  foreach($a in $x.SelectNodes('//@schemaLocation')){if($a.Value -notmatch '^[A-Za-z0-9_.-]+\.xsd$'){throw 'Referencia XSD externa nao permitida.'}}
 }
 $schemas=[Xml.Schema.XmlSchemaSet]::new();$schemas.XmlResolver=[Xml.XmlUrlResolver]::new();[void]$schemas.Add('http://www.sped.fazenda.gov.br/nfse',$root);$schemas.Compile()
 $Doc.Schemas=$schemas;$script:errosSchema=0
 $Doc.Validate([Xml.Schema.ValidationEventHandler]{param($sender,$eventArgs)$script:errosSchema++;$script:ultimoErroSchema=$eventArgs.Message})
 if($script:errosSchema){throw 'DPS rejeitada pelo XSD oficial; conferir campos obrigatorios.'}
}
function Sign-DpsRestrita([string]$Xml,[Security.Cryptography.X509Certificates.X509Certificate2]$Certificate,[string]$SchemaDirectory){
 $parsed=Read-DpsRestrita $Xml;$doc=$parsed.Doc
 if($doc.SelectNodes('//ds:Signature',$parsed.Ns).Count){throw 'DPS ja assinada; nao reassinar.'}
 if(!$Certificate.HasPrivateKey -or $Certificate.NotAfter -lt (Get-Date) -or $Certificate.NotBefore -gt (Get-Date)){throw 'Certificado invalido.'}
 $rsa=[Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($Certificate)
 try{
  $signed=[Security.Cryptography.Xml.SignedXml]::new($doc);$signed.SigningKey=$rsa
  $signed.SignedInfo.CanonicalizationMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigC14NTransformUrl
  # Perfil do manual nacional publicado: RSA-SHA1/SHA1, distinto da cadeia RPS.
  # Não trocar algoritmo apenas porque o XSD xmldsig genérico aceita outro.
  $signed.SignedInfo.SignatureMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigRSASHA1Url
  $reference=[Security.Cryptography.Xml.Reference]::new('#'+$parsed.Id);$reference.DigestMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigSHA1Url
  $reference.AddTransform([Security.Cryptography.Xml.XmlDsigEnvelopedSignatureTransform]::new());$reference.AddTransform([Security.Cryptography.Xml.XmlDsigC14NTransform]::new());$signed.AddReference($reference)
  $info=[Security.Cryptography.Xml.KeyInfo]::new();$info.AddClause([Security.Cryptography.Xml.KeyInfoX509Data]::new($Certificate));$signed.KeyInfo=$info
  $signed.ComputeSignature();[void]$doc.DocumentElement.AppendChild($doc.ImportNode($signed.GetXml(),$true))
  if(!$signed.CheckSignature($Certificate,$true)){throw 'Assinatura local nao conferida.'}
  Test-DpsSchema $doc $SchemaDirectory
  return $doc.OuterXml
 }finally{$rsa.Dispose()}
}
