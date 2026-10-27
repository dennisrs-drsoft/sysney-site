# Dedicated ATP implementation. Importing defines functions only; no certificate lookup/network.
function Read-AtpMunicipalXml([string]$Text){
 if($Text.Length -gt 1000000){throw 'ATP_XML_LIMIT'}
 $settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null
 $reader=[Xml.XmlReader]::Create([IO.StringReader]::new($Text),$settings)
 try{$doc=[xml]::new();$doc.PreserveWhitespace=$true;$doc.XmlResolver=$null;$doc.Load($reader);return ,$doc}finally{$reader.Dispose()}
}
function Get-AtpMunicipalChain($Doc){
 $r=$Doc.SelectSingleNode('/*/RPS');if(!$r){return ''}
 $t=$r.CPFCNPJTomador
 if($t.ChildNodes.Count -ne 1 -or $t.FirstChild.LocalName -notin @('CPF','CNPJ')){throw 'ATP_RECIPIENT_INVALID'}
 $document=[string]$t.FirstChild.InnerText;$kind=[string]$t.FirstChild.LocalName
 if(($kind -eq 'CPF' -and $document -notmatch '^\d{11}$') -or ($kind -eq 'CNPJ' -and $document -notmatch '^\d{14}$')){throw 'ATP_RECIPIENT_INVALID'}
 $indicator=if($kind -eq 'CPF'){'1'}else{'2'}
 $value=([decimal]::Parse([string]$r.ValorServicos,[Globalization.CultureInfo]::InvariantCulture)*100).ToString('0',[Globalization.CultureInfo]::InvariantCulture)
 if($r.TributacaoRPS -ne 'T' -or $r.StatusRPS -ne 'N' -or $r.ISSRetido -ne 'false' -or $r.CodigoServico -ne '03158' -or [decimal]$r.ValorDeducoes -ne 0){throw 'ATP_PROFILE_INVALID'}
 $chain=([string]$r.ChaveRPS.InscricaoPrestador).PadLeft(8,'0')+([string]$r.ChaveRPS.SerieRPS).PadRight(5,' ')+([string]$r.ChaveRPS.NumeroRPS).PadLeft(12,'0')+([string]$r.DataEmissao).Replace('-','')+'TNN'+$value.PadLeft(15,'0')+('0'*15)+'03158'+$indicator+$document.PadLeft(14,'0')
 if($chain.Length -ne 86){throw 'ATP_CHAIN_INVALID'};return $chain
}
function Sign-AtpMunicipal([string]$Text,$Certificate,[string]$SchemaRoot){
 if($PSVersionTable.PSVersion.Major -lt 6){Add-Type -AssemblyName System.Security}else{Add-Type -AssemblyName System.Security.Cryptography.Xml}
 $doc=Read-AtpMunicipalXml $Text
 $names=@{PedidoEnvioRPS='PedidoEnvioRPS_v01.xsd';PedidoEnvioLoteRPS='PedidoEnvioLoteRPS_v01.xsd';PedidoConsultaNFe='PedidoConsultaNFe_v01.xsd'}
 $root=$doc.DocumentElement
 if($root.NamespaceURI -ne 'http://www.prefeitura.sp.gov.br/nfe' -or !$names.ContainsKey($root.LocalName) -or $doc.SelectNodes("//*[local-name()='Signature']").Count -ne 0 -or $doc.SelectSingleNode('/*/Cabecalho').GetAttribute('Versao') -ne '1' -or $doc.SelectSingleNode('/*/Cabecalho/CPFCNPJRemetente/CNPJ').InnerText -ne '57767099000179'){throw 'ATP_XML_SCOPE_INVALID'}
 $chain=Get-AtpMunicipalChain $doc
 $rsa=[Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($Certificate)
 try{
  if($chain){
   $bytes=[Text.Encoding]::ASCII.GetBytes($chain)
   $signed=$rsa.SignData($bytes,[Security.Cryptography.HashAlgorithmName]::SHA1,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
   $public=[Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPublicKey($Certificate)
   try{if(!$public.VerifyData($bytes,$signed,[Security.Cryptography.HashAlgorithmName]::SHA1,[Security.Cryptography.RSASignaturePadding]::Pkcs1)){throw 'ATP_RPS_SIGNATURE_INVALID'}}finally{$public.Dispose()}
   $doc.SelectSingleNode('/*/RPS/Assinatura').InnerText=[Convert]::ToBase64String($signed)
  }
  $sig=[Security.Cryptography.Xml.SignedXml]::new($doc);$sig.SigningKey=$rsa
  $sig.SignedInfo.SignatureMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigRSASHA1Url
  $ref=[Security.Cryptography.Xml.Reference]::new('');$ref.DigestMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigSHA1Url
  $ref.AddTransform([Security.Cryptography.Xml.XmlDsigEnvelopedSignatureTransform]::new());$ref.AddTransform([Security.Cryptography.Xml.XmlDsigC14NTransform]::new());$sig.AddReference($ref)
  $ki=[Security.Cryptography.Xml.KeyInfo]::new();$ki.AddClause([Security.Cryptography.Xml.KeyInfoX509Data]::new($Certificate));$sig.KeyInfo=$ki
  $sig.ComputeSignature();[void]$root.AppendChild($doc.ImportNode($sig.GetXml(),$true))
  $check=[Security.Cryptography.Xml.SignedXml]::new($doc);$check.LoadXml($root.LastChild)
  if(!$check.CheckSignature($Certificate,$true)){throw 'ATP_XML_SIGNATURE_INVALID'}
 }finally{$rsa.Dispose()}
 # Load every dependency explicitly; resolver stays null (no HTTP/import escape).
 $schemas=[Xml.Schema.XmlSchemaSet]::new();$schemas.XmlResolver=$null
 [void]$schemas.Add('http://www.w3.org/2000/09/xmldsig#',(Join-Path $SchemaRoot 'xmldsig-core-schema_v01.xsd'))
 [void]$schemas.Add('http://www.prefeitura.sp.gov.br/nfe/tipos',(Join-Path $SchemaRoot 'TiposNFe_v01.xsd'))
 [void]$schemas.Add('http://www.prefeitura.sp.gov.br/nfe',(Join-Path $SchemaRoot $names[$root.LocalName]));$schemas.Compile();$doc.Schemas=$schemas
 $errors=[Collections.Generic.List[string]]::new();$doc.Validate([Xml.Schema.ValidationEventHandler]{param($s,$e)$errors.Add($e.Message)})
 if($errors.Count){throw ('ATP_SCHEMA_INVALID: '+($errors -join ' | '))}
 return $doc.OuterXml
}
