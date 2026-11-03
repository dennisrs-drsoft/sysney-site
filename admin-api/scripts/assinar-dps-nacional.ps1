# Biblioteca local: nenhuma rede, reserva, instalacao ou exportacao de certificado.
# O chamador deve obter CNPJ/certificado da configuracao protegida do emitente.
. (Join-Path $PSScriptRoot 'assinar-dps-restrita.ps1')
function Read-DpsNacional([string]$Xml,[string]$ExpectedCnpj,[string]$Ambiente){
 if($ExpectedCnpj -notmatch '^\d{14}$' -or $Ambiente -notin @('homologacao','producao') -or !$Xml -or $Xml.Length -gt 1000000 -or $Xml -match '<!DOCTYPE|<!ENTITY'){throw 'Identidade ou XML DPS invalido.'}
 $settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null;$settings.MaxCharactersInDocument=1000000
 $reader=[Xml.XmlReader]::Create([IO.StringReader]::new($Xml),$settings);$doc=[Xml.XmlDocument]::new();$doc.PreserveWhitespace=$true;$doc.XmlResolver=$null
 try{$doc.Load($reader)}finally{$reader.Dispose()}
 $ns=[Xml.XmlNamespaceManager]::new($doc.NameTable);$ns.AddNamespace('n','http://www.sped.fazenda.gov.br/nfse');$ns.AddNamespace('ds','http://www.w3.org/2000/09/xmldsig#')
 if($doc.DocumentElement.LocalName -ne 'DPS' -or $doc.DocumentElement.NamespaceURI -ne 'http://www.sped.fazenda.gov.br/nfse'){throw 'Raiz DPS invalida.'}
 $inf=@($doc.SelectNodes('/n:DPS/n:infDPS',$ns));if($inf.Count -ne 1){throw 'infDPS ambiguo.'}
 foreach($field in @('tpAmb','serie','nDPS','prest/n:CNPJ')){if(@($doc.SelectNodes('/n:DPS/n:infDPS/n:'+$field,$ns)).Count -ne 1){throw 'Identificacao DPS ausente ou duplicada.'}}
 $expectedAmb=if($Ambiente -eq 'producao'){'1'}else{'2'}
 if($doc.SelectSingleNode('/n:DPS/n:infDPS/n:tpAmb',$ns).InnerText -ne $expectedAmb -or $doc.SelectSingleNode('/n:DPS/n:infDPS/n:prest/n:CNPJ',$ns).InnerText -ne $ExpectedCnpj){throw 'Ambiente ou emitente divergente.'}
 $serie=$doc.SelectSingleNode('/n:DPS/n:infDPS/n:serie',$ns).InnerText;$numero=$doc.SelectSingleNode('/n:DPS/n:infDPS/n:nDPS',$ns).InnerText
 if($serie -notmatch '^[1-9]\d{0,4}$' -or $numero -notmatch '^[1-9]\d{0,14}$' -or $inf[0].GetAttribute('Id') -ne ('DPS35503082'+$ExpectedCnpj+$serie.PadLeft(5,'0')+$numero.PadLeft(15,'0'))){throw 'Id DPS divergente.'}
 $ids=@{};foreach($node in $doc.SelectNodes('//*[@Id]')){$id=$node.GetAttribute('Id');if($ids.ContainsKey($id)){throw 'Id duplicado.'};$ids[$id]=$true}
 return @{Doc=$doc;Ns=$ns;Id=$inf[0].GetAttribute('Id')}
}
function Sign-DpsNacional([string]$Xml,[Security.Cryptography.X509Certificates.X509Certificate2]$Certificate,[string]$SchemaDirectory,[string]$ExpectedCnpj,[string]$Ambiente){
 $parsed=Read-DpsNacional $Xml $ExpectedCnpj $Ambiente;$doc=$parsed.Doc
 if($doc.SelectNodes('//ds:Signature',$parsed.Ns).Count){throw 'DPS ja assinada; nao reassinar.'}
 if(!$Certificate.HasPrivateKey -or $Certificate.NotAfter -lt (Get-Date) -or $Certificate.NotBefore -gt (Get-Date)){throw 'Certificado invalido.'}
 $rsa=[Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($Certificate)
 try{
  $signed=[Security.Cryptography.Xml.SignedXml]::new($doc);$signed.SigningKey=$rsa
  $signed.SignedInfo.CanonicalizationMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigC14NTransformUrl;$signed.SignedInfo.SignatureMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigRSASHA1Url
  $reference=[Security.Cryptography.Xml.Reference]::new('#'+$parsed.Id);$reference.DigestMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigSHA1Url
  $reference.AddTransform([Security.Cryptography.Xml.XmlDsigEnvelopedSignatureTransform]::new());$reference.AddTransform([Security.Cryptography.Xml.XmlDsigC14NTransform]::new());$signed.AddReference($reference)
  $info=[Security.Cryptography.Xml.KeyInfo]::new();$info.AddClause([Security.Cryptography.Xml.KeyInfoX509Data]::new($Certificate));$signed.KeyInfo=$info;$signed.ComputeSignature()
  [void]$doc.DocumentElement.AppendChild($doc.ImportNode($signed.GetXml(),$true));if(!$signed.CheckSignature($Certificate,$true)){throw 'Assinatura local nao conferida.'}
  Test-DpsNacionalSchema $doc $SchemaDirectory;return $doc.OuterXml
 }finally{$rsa.Dispose()}
}
function Test-DpsNacionalSchema($Doc,[string]$SchemaDirectory){
 $path=[IO.Path]::GetFullPath($SchemaDirectory);$root=Join-Path $path 'DPS_v1.01.xsd'
 if(!(Test-Path -LiteralPath $root)){throw 'Schemas nacionais nao configurados.'}
 # O pacote oficial de producao inclui DOCTYPE no XSD de assinatura. Ignorar
 # essa declaracao somente no arquivo local fixado; nunca resolver a DTD/rede.
 foreach($file in Get-ChildItem -LiteralPath $path -Filter '*.xsd'){
  $settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Ignore;$settings.XmlResolver=$null
  $reader=[Xml.XmlReader]::Create($file.FullName,$settings);$x=[Xml.XmlDocument]::new();$x.XmlResolver=$null
  try{$x.Load($reader)}finally{$reader.Dispose()}
  foreach($a in $x.SelectNodes('//@schemaLocation')){if($a.Value -notmatch '^[A-Za-z0-9_.-]+\.xsd$'){throw 'Referencia XSD externa nao permitida.'}}
 }
 $schemas=[Xml.Schema.XmlSchemaSet]::new();$schemas.XmlResolver=[Xml.XmlUrlResolver]::new()
 $settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Ignore;$settings.XmlResolver=$null
 $reader=[Xml.XmlReader]::Create((Join-Path $path 'xmldsig-core-schema.xsd'),$settings)
 try{[void]$schemas.Add('http://www.w3.org/2000/09/xmldsig#',$reader)}finally{$reader.Dispose()}
 [void]$schemas.Add('http://www.sped.fazenda.gov.br/nfse',$root);$schemas.Compile();$Doc.Schemas=$schemas;$script:errosSchema=0
 $Doc.Validate([Xml.Schema.ValidationEventHandler]{param($sender,$eventArgs)$script:errosSchema++;$script:ultimoErroSchema=$eventArgs.Message})
 if($script:errosSchema){throw 'DPS rejeitada pelo XSD oficial do ambiente; conferir campos obrigatorios.'}
}
