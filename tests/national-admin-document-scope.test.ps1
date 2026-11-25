$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../admin-api/scripts/nacional-admin-native.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Script nacional contém erro de sintaxe.'}
$function=$ast.Find({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-NationalDocumentPartition'},$true)
if(!$function){throw 'Controle de origem documental ausente.'}
Invoke-Expression $function.Extent.Text
foreach($empresa in @('sysney','drsoft')){
 if((Get-NationalDocumentPartition ([pscustomobject]@{}) $empresa) -ne ('emails-'+$empresa)){throw 'Fluxo comum alterado.'}
 if((Get-NationalDocumentPartition ([pscustomobject]@{origem='regularizacao'}) $empresa) -ne ('regularizacao-documentos-'+$empresa)){throw 'Origem de regularização incorreta.'}
 $rejeitado=$false;try{[void](Get-NationalDocumentPartition ([pscustomobject]@{origem='outra'}) $empresa)}catch{$rejeitado=$true};if(!$rejeitado){throw 'Origem desconhecida aceita.'}
}
'Regularizacao e cobranca comum isoladas no transporte nativo. Nenhuma rede ou certificado utilizado.'
