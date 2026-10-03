$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$config=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'config.json') | ConvertFrom-Json
if($config.modo -ne 'teste' -or $config.storage -notmatch '^[a-z0-9]{3,24}$'){throw 'Configuração de teste inválida.'}
$base="https://$($config.storage).table.core.windows.net/FiscalFila"
$script:token=$null;$script:tokenEm=[datetime]::MinValue
function ChamarTabela([string]$metodo,[string]$sufixo,$corpo=$null,[string]$etag=''){
  if(-not $script:token -or ([datetime]::UtcNow-$script:tokenEm).TotalMinutes -gt 40){
    $t=Invoke-RestMethod -Uri 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fstorage.azure.com%2F' -Headers @{Metadata='true'} -TimeoutSec 10
    $script:token=$t.access_token;$script:tokenEm=[datetime]::UtcNow
  }
  $headers=@{Authorization="Bearer $script:token";'x-ms-version'='2019-02-02';'x-ms-date'=[datetime]::UtcNow.ToString('R');Accept='application/json;odata=nometadata'}
  if($etag){$headers['If-Match']=$etag}
  $opcoesHttp=@{Uri=($base+$sufixo);Method=$metodo;Headers=$headers;UseBasicParsing=$true;TimeoutSec=15}
  if($null -ne $corpo){$opcoesHttp.Body=[Text.Encoding]::UTF8.GetBytes(($corpo|ConvertTo-Json -Depth 8 -Compress));$opcoesHttp.ContentType='application/json'}
  return Invoke-WebRequest @opcoesHttp
}
function Chave([string]$id){return "(PartitionKey='pedidos',RowKey='$id')"}
function Salvar($job,[string]$etag){[void](ChamarTabela 'PUT' (Chave $job.RowKey) $job $etag)}
function ExecutarPedido($pedido){
  if($pedido.acao -notin @('testar','consultar') -or $pedido.cnpj -notmatch '^\d{14}$' -or $pedido.xml.Length -gt 24000){throw 'Operação não permitida.'}
  $emitente=@($config.emitentes | Where-Object {$_.cnpj -eq $pedido.cnpj})
  if($emitente.Count -ne 1 -or $emitente[0].thumbprint -notmatch '^[A-Fa-f0-9]{40}$'){throw 'Emitente não vinculado.'}
  $start=[Diagnostics.ProcessStartInfo]::new()
  $start.FileName=Join-Path $PSHOME 'powershell.exe'
  $assinador=Join-Path $PSScriptRoot 'scripts/executar-nfse-sp.ps1'
  $start.Arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$assinador+'"'
  $start.UseShellExecute=$false;$start.CreateNoWindow=$true
  $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
  $start.StandardOutputEncoding=[Text.UTF8Encoding]::new($false)
  if($start.PSObject.Properties['StandardInputEncoding']){$start.StandardInputEncoding=[Text.UTF8Encoding]::new($false)}
  $start.EnvironmentVariables['NFSE_SP_SOMENTE_TESTE']='true'
  $start.EnvironmentVariables['NFSE_SP_PRODUCAO_HABILITADA']='false'
  $start.EnvironmentVariables['NFSE_SP_CERT_STORE']='LocalMachine'
  $start.EnvironmentVariables['NFSE_SP_CERT_THUMBPRINT']=$emitente[0].thumbprint
  $processo=[Diagnostics.Process]::new();$processo.StartInfo=$start
  try{
    [void]$processo.Start()
    $saida=$processo.StandardOutput.ReadToEndAsync();$erro=$processo.StandardError.ReadToEndAsync()
    $processo.StandardInput.Write(($pedido|ConvertTo-Json -Depth 5 -Compress));$processo.StandardInput.Close()
    if(-not $processo.WaitForExit(75000)){$processo.Kill();throw 'Tempo da assinatura excedido.'}
    if($processo.ExitCode -ne 0){throw 'Assinatura, schema ou comunicação fiscal não concluída.'}
    $json=$saida.Result
    if($json.Length -gt 30000){throw 'Resposta fiscal excede o limite seguro da fila.'}
    $r=$json | ConvertFrom-Json
    if($r.sucesso -isnot [bool] -or $r.teste -ne ($pedido.acao -eq 'testar') -or $r.xml -isnot [string]){throw 'Resposta fiscal inválida.'}
    return $json
  }finally{$processo.Dispose()}
}
$ultimaSaude=[datetime]::MinValue
while($true){
  try{
    if(([datetime]::UtcNow-$ultimaSaude).TotalSeconds -gt 30){
      [void](ChamarTabela 'PUT' "(PartitionKey='servico',RowKey='drserver')" @{PartitionKey='servico';RowKey='drserver';modo='teste';em=[datetime]::UtcNow.ToString('o')})
      $ultimaSaude=[datetime]::UtcNow
    }
    $query='()?$filter='+[Uri]::EscapeDataString("PartitionKey eq 'pedidos' and estado eq 'pendente'")+'&$top=10'
    $lista=(ChamarTabela 'GET' $query).Content | ConvertFrom-Json
    foreach($item in $lista.value){
      if($item.RowKey -notmatch '^[a-f0-9-]{36}$'){continue}
      $resp=ChamarTabela 'GET' (Chave $item.RowKey)
      $atual=$resp.Content | ConvertFrom-Json
      if($atual.estado -ne 'pendente'){continue}
      $job=@{PartitionKey='pedidos';RowKey=$atual.RowKey;pedido=$atual.pedido;hash=$atual.hash;expira=$atual.expira;estado='executando';iniciou=[datetime]::UtcNow.ToString('o')}
      try{Salvar $job $resp.Headers['ETag']}catch{continue}
      try{
        if([datetime]::Parse($job.expira).ToUniversalTime() -lt [datetime]::UtcNow){throw 'Pedido expirado.'}
        $sha=[Security.Cryptography.SHA256]::Create()
        try{$hash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($job.pedido)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
        if($hash -ne $job.hash){throw 'Pedido alterado.'}
        $pedido=$job.pedido|ConvertFrom-Json
        $job.resultado=ExecutarPedido $pedido;$job.estado='concluido'
      }catch{$job.estado='erro';$job.diagnostico=$_.Exception.Message.Substring(0,[Math]::Min(160,$_.Exception.Message.Length))}
      $job.concluiu=[datetime]::UtcNow.ToString('o')
      $versao=ChamarTabela 'GET' (Chave $job.RowKey)
      Salvar $job $versao.Headers['ETag']
    }
  }catch{
    # Nunca registrar tokens, XML, certificados ou stderr em logs do Windows.
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'saude-local.json'),('{"estado":"indisponivel","em":"'+[datetime]::UtcNow.ToString('o')+'"}'))
  }
  Start-Sleep -Seconds 5
}
