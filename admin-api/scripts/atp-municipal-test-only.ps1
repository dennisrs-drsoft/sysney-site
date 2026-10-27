# Test-only packet builder. No general-purpose SOAP method/URL is accepted.
function New-AtpMunicipalOfficialTestPacket([string]$Xml,[string]$Action='testar'){
 if($Action -cne 'testar'){throw 'ATP_OFFICIAL_TEST_ONLY'}
 $doc=Read-AtpMunicipalXml $Xml
 if($doc.DocumentElement.LocalName -cne 'PedidoEnvioLoteRPS' -or $doc.DocumentElement.NamespaceURI -cne 'http://www.prefeitura.sp.gov.br/nfe' -or $doc.SelectNodes('/*/RPS').Count -ne 1){throw 'ATP_OFFICIAL_TEST_XML_ONLY'}
 $r=$doc.SelectSingleNode('/*/RPS')
 if([string]$doc.SelectSingleNode('/*/Cabecalho/CPFCNPJRemetente/CNPJ').InnerText -cne '57767099000179' -or [string]$r.ChaveRPS.InscricaoPrestador -cne '15539300' -or [string]$r.ChaveRPS.SerieRPS -cne 'TQA27' -or [string]$r.ChaveRPS.NumeroRPS -cne '1' -or [string]$r.CPFCNPJTomador.CNPJ -cne '11222333000181' -or [string]$r.RazaoSocialTomador -cne 'TESTE SEM VALIDADE FISCAL' -or [string]$r.Discriminacao -notmatch '^TESTE SEM VALIDADE FISCAL - ATP - ' -or [decimal]$r.ValorServicos -ne 1 -or [string]$r.CodigoServico -cne '03158'){throw 'ATP_OFFICIAL_TEST_FIXTURE_REQUIRED'}
 $body="<s:Envelope xmlns:s='http://www.w3.org/2003/05/soap-envelope'><s:Body><TesteEnvioLoteRPSRequest xmlns='http://www.prefeitura.sp.gov.br/nfe'><VersaoSchema>1</VersaoSchema><MensagemXML>$([Security.SecurityElement]::Escape($Xml))</MensagemXML></TesteEnvioLoteRPSRequest></s:Body></s:Envelope>"
 return [pscustomobject]@{Uri='https://nfews.prefeitura.sp.gov.br/lotenfe.asmx';SoapAction='http://www.prefeitura.sp.gov.br/nfe/ws/testeenvio';Body=$body;Action='testar';IssuanceEnabled=$false}
}
