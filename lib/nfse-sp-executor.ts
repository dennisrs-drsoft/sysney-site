import {spawn} from "node:child_process";
import {resolve} from "node:path";
import {executarNaVM} from "./nfse-sp-fila";
import {cadeiaAssinaturaSP,montarXmlSP,montarConsultaSP,type DadosNotaSP,type ResultadoSP} from "./nfse-sp";
export function executorMunicipalDisponivel(){return process.env.NFSE_SP_WORKER_HABILITADO==="true"||(process.platform==="win32" && process.env.ADMIN_BACKEND_EXECUTION!=="true" && process.env.NODE_ENV!=="production");}
export async function executarNotaSP(acao:"testar"|"emitir"|"consultar",dados:DadosNotaSP):Promise<ResultadoSP>{
  if(!executorMunicipalDisponivel())throw Error("Abra o painel neste computador para usar o certificado Windows. O assinador on-line ainda não está instalado.");
  if(acao==="emitir"&&process.env.NFSE_SP_PRODUCAO_HABILITADA!=="true")throw Error("Teste a integração e habilite a produção antes de emitir.");
  const entrada={acao,cnpj:dados.cnpj,xml:acao==="consultar"?montarConsultaSP(dados):montarXmlSP(dados,acao==="testar"),cadeia:cadeiaAssinaturaSP(dados)};
  if(process.env.NFSE_SP_WORKER_HABILITADO==="true"){
    if(acao==="emitir")throw Error("Serviço da VM opera somente em teste e consulta; emissão real bloqueada.");
    return executarNaVM({...entrada,acao});
  }
  return new Promise((done,fail)=>{
    const child=spawn("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",resolve(process.cwd(),"admin-api/scripts/executar-nfse-sp.ps1")],{windowsHide:true,stdio:["pipe","pipe","pipe"]});
    let out="";const timer=setTimeout(()=>{child.kill();fail(Error("Resultado fiscal não confirmado. Consulte antes de repetir; uma autorização do certificado pode estar pendente."));},75000);
    child.stdout.on("data",b=>{out+=b.toString("utf8");if(out.length>2000000){child.kill();}});
    // Não devolver stderr: pode conter certificado, XML e dados pessoais.
    child.stderr.resume();
    child.on("error",()=>{clearTimeout(timer);fail(Error("Não foi possível iniciar o assinador do certificado."));});
    child.on("close",code=>{clearTimeout(timer);if(code!==0)return fail(Error("Falha na assinatura, schema ou comunicação fiscal. Confira os campos e a autorização do certificado. Consulte antes de repetir uma emissão."));try{const r=JSON.parse(out);if(typeof r.sucesso!=="boolean"||typeof r.xml!=="string"||!Array.isArray(r.erros)||r.teste!==(acao==="testar"))throw Error();done(r);}catch{fail(Error("Retorno fiscal não confirmado. Consulte antes de repetir."));}});
    child.stdin.end(JSON.stringify(entrada));
  });
}
