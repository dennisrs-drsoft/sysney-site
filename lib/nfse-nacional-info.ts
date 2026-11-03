// Informações de apresentação, sem módulos de Node, credenciais ou execução fiscal.
export function pendenciasNacionais(empresa:string){
  const comuns=["Confirmar habilitação para a competência fiscal correta no Emissor Nacional.","Validar código nacional, NBS e enquadramento; não converter o código municipal automaticamente.","Reservar série e sequência DPS exclusivas, separadas dos RPS municipais.","Concluir assinatura, XML, consulta oficial e download do DANFSe antes de liberar produção.","Configurar o serviço fiscal com o certificado do emitente, sem disponibilizar a chave privada ao navegador."];
  return empresa==="sysney"?comuns:["DRSOFT: migração nacional não configurada. Confirmar habilitação para o regime vigente, sem aplicar automaticamente as regras do Simples Nacional.",...comuns];
}
