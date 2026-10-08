param([Parameter(Mandatory)][ValidatePattern('^[a-f0-9-]{36}$')][string]$IdColeta)
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Security
$config=Get-Content -Raw -LiteralPath 'C:\ProgramData\SYSNEY\FiscalTeste\config.json'|ConvertFrom-Json
$emitente=@($config.emitentes|Where-Object {$_.empresa -eq 'sysney' -and $_.cnpj -eq '57767099000179'})
if($emitente.Count -ne 1 -or $emitente[0].thumbprint -notmatch '^[A-Fa-f0-9]{40}$'){throw 'Vinculo fiscal da SYSNEY indisponivel.'}
$certs=@(Get-ChildItem Cert:\LocalMachine\My|Where-Object {$_.Thumbprint -eq $emitente[0].thumbprint -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date)})
if($certs.Count -ne 1){throw 'Certificado fiscal valido nao localizado.'}
$cert=$certs[0]
$token=(Invoke-RestMethod -Uri 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fstorage.azure.com%2F' -Headers @{Metadata='true'} -TimeoutSec 15).access_token
$part='historico-nfse-sysney-'+$IdColeta
$salvos=[Collections.Generic.HashSet[string]]::new()
function Guardar([string]$id,$dados){
  $ent=@{PartitionKey=$part;RowKey=$id;json=($dados|ConvertTo-Json -Depth 5 -Compress)}
  $headers=@{Authorization="Bearer $token";'x-ms-version'='2019-02-02';'x-ms-date'=[datetime]::UtcNow.ToString('R');Accept='application/json;odata=nometadata';'If-Match'='*'}
  $url="https://$($config.storage).table.core.windows.net/FiscalFila";$metodo='POST'
  if($salvos.Contains($id)){$url+="(PartitionKey='$part',RowKey='$id')";$metodo='PUT'}else{$headers.Remove('If-Match')}
  [void](Invoke-WebRequest -UseBasicParsing -Uri $url -Method $metodo -Headers $headers -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes(($ent|ConvertTo-Json -Compress))) -TimeoutSec 20)
  [void]$salvos.Add($id)
}
function LerXml([string]$texto){
  $settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null
  $reader=[Xml.XmlReader]::Create([IO.StringReader]::new($texto),$settings)
  try{$doc=[xml]::new();$doc.PreserveWhitespace=$true;$doc.XmlResolver=$null;$doc.Load($reader);return ,$doc}finally{$reader.Dispose()}
}
function Texto($node,[string]$xpath){$n=$node.SelectSingleNode($xpath);if($n){return [string]$n.InnerText};return ''}
function Consultar($xml,[int]$versao,[string]$request,[string]$action){
  if($action -notin @('consultaNFe','consultaNFeEmitidas')){throw 'Metodo nao permitido.'}
  $rsa=[Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
  try{
    $sig=[Security.Cryptography.Xml.SignedXml]::new($xml);$sig.SigningKey=$rsa;$sig.SignedInfo.SignatureMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigRSASHA1Url
    $ref=[Security.Cryptography.Xml.Reference]::new('');$ref.DigestMethod=[Security.Cryptography.Xml.SignedXml]::XmlDsigSHA1Url
    $ref.AddTransform([Security.Cryptography.Xml.XmlDsigEnvelopedSignatureTransform]::new());$ref.AddTransform([Security.Cryptography.Xml.XmlDsigC14NTransform]::new());$sig.AddReference($ref)
    $info=[Security.Cryptography.Xml.KeyInfo]::new();$info.AddClause([Security.Cryptography.Xml.KeyInfoX509Data]::new($cert));$sig.KeyInfo=$info
    $sig.ComputeSignature();[void]$xml.DocumentElement.AppendChild($xml.ImportNode($sig.GetXml(),$true))
    $check=[Security.Cryptography.Xml.SignedXml]::new($xml);$check.LoadXml($xml.SelectSingleNode("//*[local-name()='Signature']"))
    if(-not $check.CheckSignature($cert,$true)){throw 'Assinatura da consulta nao validada.'}
  }finally{$rsa.Dispose()}
  $msg=[Security.SecurityElement]::Escape($xml.OuterXml)
  $soap="<s:Envelope xmlns:s='http://www.w3.org/2003/05/soap-envelope'><s:Body><$request xmlns='http://www.prefeitura.sp.gov.br/nfe'><VersaoSchema>$versao</VersaoSchema><MensagemXML>$msg</MensagemXML></$request></s:Body></s:Envelope>"
  $r=Invoke-WebRequest -UseBasicParsing -Uri 'https://nfews.prefeitura.sp.gov.br/lotenfe.asmx' -Method POST -Certificate $cert -ContentType "application/soap+xml; charset=utf-8; action=`"http://www.prefeitura.sp.gov.br/nfe/ws/$action`"" -Body ([Text.Encoding]::UTF8.GetBytes($soap)) -TimeoutSec 45
  $envXml=LerXml $r.Content;$ret=$envXml.SelectSingleNode("//*[local-name()='RetornoXML']")
  if(-not $ret){throw 'Consulta sem retorno XML.'}
  $dados=LerXml $ret.InnerText
  if((Texto $dados "//*[local-name()='Sucesso']") -ne 'true'){
    $codigos=@($dados.SelectNodes("//*[local-name()='Erro']/*[local-name()='Codigo']")|ForEach-Object InnerText)
    throw ('Consulta recusada. Codigos: '+($codigos -join ','))
  }
  return ,$dados
}
$hoje=[TimeZoneInfo]::ConvertTimeFromUtc([datetime]::UtcNow,[TimeZoneInfo]::FindSystemTimeZoneById('E. South America Standard Time')).ToString('yyyy-MM-dd')
$total=0;$paginas=0
Guardar 'status' @{estado='consultando';inicio='2006-06-01';fim=$hoje;notas=0;paginas=0}
try{
  # Apenas ConsultaNFeEmitidas. Nao utiliza nenhum metodo de emissao/cancelamento.
  $primeira=Consultar (LerXml "<p:PedidoConsultaNFe xmlns:p='http://www.prefeitura.sp.gov.br/nfe'><Cabecalho Versao='2'><CPFCNPJRemetente><CNPJ>57767099000179</CNPJ></CPFCNPJRemetente></Cabecalho><Detalhe><ChaveNFe><InscricaoPrestador>15539300</InscricaoPrestador><NumeroNFe>1</NumeroNFe></ChaveNFe></Detalhe></p:PedidoConsultaNFe>") 2 'ConsultaNFeRequest' 'consultaNFe'
  $primeiraData=Texto $primeira "//*[local-name()='NFe']/*[local-name()='DataEmissaoNFe']"
  if($primeiraData -notmatch '^\d{4}-\d{2}-\d{2}'){throw 'Data da primeira nota nao confirmada; nao presumir cobertura completa.'}
  $inicioHistorico=$primeiraData.Substring(0,7)+'-01'
  $inicio=[datetime]::ParseExact($inicioHistorico,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)
  $limite=[datetime]::ParseExact($hoje,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)
  while($inicio -le $limite){
    $fimMes=$inicio.AddMonths(1).AddDays(-1)
    if($fimMes -gt $limite){$fimMes=$limite}
    $periodo=@{inicio=$inicio.ToString('yyyy-MM-dd');fim=$fimMes.ToString('yyyy-MM-dd');versao=if($inicio.Year -ge 2026){2}else{1}}
    for($pagina=1;$pagina -le 100;$pagina++){
      $xml=LerXml "<p:PedidoConsultaNFePeriodo xmlns:p='http://www.prefeitura.sp.gov.br/nfe'><Cabecalho Versao='$($periodo.versao)'><CPFCNPJRemetente><CNPJ>57767099000179</CNPJ></CPFCNPJRemetente><CPFCNPJ><CNPJ>57767099000179</CNPJ></CPFCNPJ><Inscricao>15539300</Inscricao><dtInicio>$($periodo.inicio)</dtInicio><dtFim>$($periodo.fim)</dtFim><NumeroPagina>$pagina</NumeroPagina></Cabecalho></p:PedidoConsultaNFePeriodo>"
      $dados=Consultar $xml $periodo.versao 'ConsultaNFeEmitidasRequest' 'consultaNFeEmitidas'
      $notas=@($dados.SelectNodes("//*[local-name()='NFe']"));$paginas++
      # Preserva tambem a resposta oficial completa, em fragmentos abaixo do limite da tabela.
      $raw=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($dados.OuterXml));$fragmentos=[int][Math]::Ceiling($raw.Length/28000)
      for($f=0;$f -lt $fragmentos;$f++){Guardar "pagina-$($periodo.inicio)-$pagina-$f" @{tipo='pagina';versao=$periodo.versao;inicio=$periodo.inicio;pagina=$pagina;fragmento=$f;total=$fragmentos;base64=$raw.Substring($f*28000,[Math]::Min(28000,$raw.Length-$f*28000))}}
      foreach($nota in $notas){
        $numero=Texto $nota "*[local-name()='ChaveNFe']/*[local-name()='NumeroNFe']"
        $inscricao=Texto $nota "*[local-name()='ChaveNFe']/*[local-name()='InscricaoPrestador']"
        if($numero -notmatch '^\d+$' -or $inscricao -ne '15539300'){throw 'Nota com identificacao divergente.'}
        $valor=Texto $nota "*[local-name()='ValorFinalCobrado']";if(-not $valor){$valor=Texto $nota "*[local-name()='ValorServicos']"}
        $centavos=[long][Math]::Round(([decimal]::Parse($valor,[Globalization.CultureInfo]::InvariantCulture)*100),0)
        $arquivo=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($nota.OuterXml))
        if($arquivo.Length -gt 27000){throw 'XML individual excede limite da coleta segura.'}
        Guardar "nota-$numero" @{tipo='nota';numero=$numero;inscricao=$inscricao;verificacao=(Texto $nota "*[local-name()='ChaveNFe']/*[local-name()='CodigoVerificacao']");documento=(Texto $nota "*[local-name()='CPFCNPJTomador']/*");cliente=(Texto $nota "*[local-name()='RazaoSocialTomador']");emissao=(Texto $nota "*[local-name()='DataEmissaoNFe']");centavos=$centavos;situacao=(Texto $nota "*[local-name()='StatusNFe']");descricao=(Texto $nota "*[local-name()='Discriminacao']");xmlBase64=$arquivo}
        $total++
      }
      Guardar 'status' @{estado='consultando';inicio=$inicioHistorico;fim=$hoje;notas=$total;paginas=$paginas}
      if($notas.Count -lt 50){break};if($pagina -eq 100){throw 'Limite de paginacao atingido; coleta incompleta.'}
    }
    $inicio=$inicio.AddMonths(1)
  }
  Guardar 'status' @{estado='concluido';inicio=$inicioHistorico;fim=$hoje;notas=$total;paginas=$paginas;em=[datetime]::UtcNow.ToString('o')}
  Write-Output "Consulta concluida: $total notas; $paginas paginas. Sem emissao, cancelamento ou envio."
}catch{
  Guardar 'status' @{estado='erro';notas=$total;paginas=$paginas;mensagem=$_.Exception.Message.Substring(0,[Math]::Min(180,$_.Exception.Message.Length))}
  Write-Output 'Consulta nao concluida. Verificar status privado; nenhum documento foi emitido.'
}
