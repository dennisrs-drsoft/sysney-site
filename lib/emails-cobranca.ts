import { moeda, dataBr, type Empresa } from "./cobrancas";

export type AnexoEmail = { tipo: "nota" | "boleto" | "ordem-servico"; nome: string; blob: string; tamanho: number };
export const nomesAnexos = {nota:"Nota fiscal",boleto:"Boleto","ordem-servico":"Ordem de serviço"};
export type TentativaEmail = { id: string; data: string; destino: string; cc?: string; bcc?: string; remetente?: string; assunto: string; html: string; status: "processando" | "aceito" | "incerto"; messageId?: string; documentoConciliacaoPix?: string };
export type EmailCobranca = {
  aviso?: {tipo:"lembrete"|"vencimento"|"atraso"|"reenvio";cobrancaId:string;origemId:string;recebidoCentavos:number;saldoCentavos:number;data:string};
  id: string; empresa: Empresa; cliente: string; para: string; cc: string; responderPara?: string;
  assunto: string; saudacao: string; introducao: string; descricao: string;
  po?: string; contato?: string;
  descontoCentavos?: number; descontoMotivo?: string;
  formaPagamento?: "boleto" | "pix"; pixChave?: string; pixBeneficiario?: string;
  competencia: string; centavos: number; vencimento: string; observacoes: string;
  assinatura: string; detalhado: boolean; confirmarRecebimento: boolean;
  status: "rascunho" | "revisado" | "enviando" | "aceito" | "incerto" | "emitindo_documento";
  anexos: AnexoEmail[]; tentativas: TentativaEmail[]; atualizadoEm: string;
  aprovacaoEnvio?: { hash: string; por: string; em: string; remetente: string };
  fluxo?: { cobrancaId: string; nota: string; notaEmissor?:"municipal"|"nacional"; notaChave?:string; boleto: string; documentos?: {hash: string; por: string; em: string} };
};
export function validarPagamento(e:EmailCobranca) {
  if(e.formaPagamento!==undefined && e.formaPagamento!=="boleto" && e.formaPagamento!=="pix")throw new Error("Forma de pagamento inválida.");
  for(const v of [e.pixChave,e.pixBeneficiario])if(v!==undefined&&(typeof v!=="string"||v.length>150||/[\x00-\x1f]/.test(v)))throw new Error("Confira a chave e o beneficiário do PIX (máximo 150 caracteres).");
  if(e.formaPagamento==="pix" && (!e.pixChave?.trim()||!e.pixBeneficiario?.trim()))throw new Error("Preencha a chave e o beneficiário do PIX.");
  if(e.formaPagamento==="pix"&&(e.fluxo?.boleto||e.anexos.some(a=>a.tipo==="boleto")))throw new Error("Há boleto registrado ou anexado. Confira sua baixa antes de mudar para PIX.");
}
export function documentosCompletos(e:EmailCobranca) {
  const requerido=e.formaPagamento==="pix"?"ordem-servico":"boleto";
  return e.anexos.some(a=>a.tipo==="nota")&&e.anexos.some(a=>a.tipo===requerido);
}
export function validarDocumentosEmail(e:EmailCobranca) {
  validarPagamento(e);
  if(!documentosCompletos(e))throw new Error(e.formaPagamento==="pix"?"Anexe os PDFs da nota e da ordem de serviço. Cobrança por PIX não exige boleto.":"Anexe os PDFs da nota e do boleto desta cobrança.");
}
export function novoEmail(empresa: Empresa, cliente = ""): EmailCobranca {
  return { id: "", empresa, cliente, para: "", cc: "", po:"", contato:"", assunto: "{{empresa}} — Demonstrativo de cobrança — {{competencia}}",
    saudacao: "Olá, {{contato}}, tudo bem?", introducao: "Segue o demonstrativo referente ao suporte e à locação do sistema.",
    descricao: "Suporte e locação do sistema SISBlink", competencia: "", centavos: 0, vencimento: "",
    observacoes: "Qualquer dúvida, estamos à disposição.", assinatura: `Financeiro | ${empresa.toUpperCase()}`,
    detalhado: true, confirmarRecebimento: true, status: "rascunho", anexos: [], tentativas: [], atualizadoEm: "" };
}
export function escapar(v: string) { return v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
export function destinatarios(v: string) { return v.split(/[;,]/).map(x => x.trim()).filter(Boolean); }
export function emailsValidos(v: string) { const lista = destinatarios(v); return lista.length > 0 && lista.length <= 10 && lista.every(x => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x)); }
export function variaveisEmail(e:EmailCobranca):Record<string,string> {
  const meses=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const competencia=/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.competencia) ? `${meses[Number(e.competencia.slice(5))-1]}/${e.competencia.slice(0,4)}` : "A confirmar";
  return {empresa:e.empresa.toUpperCase(),competencia,cliente:e.cliente,contato:e.contato || "",po:e.po || "",valor:moeda(e.centavos),vencimento:dataBr(e.vencimento)};
}
export function resolverTextoEmail(texto:string,e:EmailCobranca) {
  const vars=variaveisEmail(e);
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g,(token,chave)=>Object.hasOwn(vars,chave)?vars[chave]:token).replace(/,\s*,/g,",");
}
export function validarModeloEmail(e:EmailCobranca) {
  validarDesconto(e);
  const vars=variaveisEmail(e);
  for(const texto of [e.assunto,e.saudacao]) {
    for(const token of texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) if(!Object.hasOwn(vars,token[1])) throw new Error(`Variável desconhecida: ${token[1]}.`);
    if(resolverTextoEmail(texto,e).includes("{{") || resolverTextoEmail(texto,e).includes("}}")) throw new Error("Confira as variáveis do assunto e da saudação.");
  }
}
// centavos permanece o total final: nunca descontar novamente na nota ou no boleto.
export function validarDesconto(e:Pick<EmailCobranca,"centavos"|"descontoCentavos"|"descontoMotivo">) {
  const desconto=e.descontoCentavos ?? 0;
  if(!Number.isSafeInteger(desconto)||desconto<0||desconto>10000000000||!Number.isSafeInteger(e.centavos+desconto)||e.centavos+desconto>10000000000)throw new Error("Desconto inválido. Confira o valor original e o total final.");
  if(e.descontoMotivo!==undefined&&(typeof e.descontoMotivo!=="string"||e.descontoMotivo.length>200||/[\x00-\x1f]/.test(e.descontoMotivo)))throw new Error("Informe um motivo de desconto válido (até 200 caracteres).");
  if(desconto>0&&(!e.descontoMotivo?.trim()||e.centavos<=0))throw new Error("Informe o motivo do desconto e mantenha o total final maior que zero.");
}
export function valorFormatado(centavos:number) { return (centavos/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
export function valorDigitado(texto:string):number|null {
  if (/[^\d.,\sR$]/.test(texto)) return null;
  const n=Number(texto.replace(/\D/g,""));
  return Number.isSafeInteger(n) && n<=10000000000 ? n : null;
}
export function htmlEmail(e: EmailCobranca, logo = "https://www.sysney.com/logo.png") {
  const esc = (value: string) => escapar(value).replaceAll("\n", "<br>");
  const empresa = e.empresa.toUpperCase();
  const assunto = resolverTextoEmail(e.assunto, e);
  const saudacao = resolverTextoEmail(e.saudacao, e);
  const titulosAviso = {
    lembrete: "Lembrete de pagamento",
    vencimento: "Aviso de vencimento",
    atraso: "Aviso de pagamento em atraso",
    reenvio: "Reenvio de cobrança",
  };
  const titulo = e.aviso ? titulosAviso[e.aviso.tipo] : "Demonstrativo de cobrança";
  const linhas: { rotulo: string; valor: string; destaque?: boolean }[] = [];
  if (e.detalhado) linhas.push({ rotulo: "Descrição", valor: e.descricao });
  if (e.po) linhas.push({ rotulo: "Pedido de compra (PO)", valor: e.po });
  linhas.push({ rotulo: "Competência", valor: e.competencia ? e.competencia.split("-").reverse().join("/") : "A confirmar" });
  const desconto = e.descontoCentavos || 0;
  if (desconto > 0) {
    linhas.push({ rotulo: "Valor original", valor: moeda(e.centavos + desconto) });
    linhas.push({ rotulo: "Desconto comercial", valor: `− ${moeda(desconto)} · ${e.descontoMotivo || ""}` });
  }
  linhas.push({ rotulo: desconto > 0 ? "Total com desconto" : "Valor", valor: e.centavos > 0 ? moeda(e.centavos) : "A confirmar", destaque: !e.aviso });
  linhas.push({ rotulo: "Vencimento", valor: e.vencimento ? dataBr(e.vencimento) : "A confirmar" });
  if (e.formaPagamento === "pix") {
    linhas.push({ rotulo: "Forma de pagamento", valor: "PIX" });
    linhas.push({ rotulo: "Chave PIX", valor: e.pixChave || "A confirmar" });
    linhas.push({ rotulo: "Beneficiário", valor: e.pixBeneficiario || "A confirmar" });
  }
  if (e.aviso) {
    linhas.push({ rotulo: "Valor já recebido", valor: moeda(e.aviso.recebidoCentavos) });
    linhas.push({ rotulo: "Saldo em aberto", valor: moeda(e.aviso.saldoCentavos), destaque: true });
  }
  const resumo = linhas.map(({ rotulo, valor, destaque }) => `
    <tr bgcolor="${destaque ? "#e4f0f6" : "#f5f9f8"}">
      <th scope="row" width="38%" valign="top" align="left" style="padding:12px;border-bottom:1px solid #d1e2e4;font-weight:normal;color:#3e5b67">${rotulo}</th>
      <td valign="top" align="right" style="padding:12px;border-bottom:1px solid #d1e2e4;font-weight:bold;overflow-wrap:anywhere;word-break:break-word;color:#061d29">${esc(valor)}</td>
    </tr>`).join("");
  const documentos = e.anexos.length
    ? `Documentos anexos: ${e.anexos.map(a => escapar(a.nome)).join(" · ")}`
    : "Documentos ainda não anexados — rascunho para revisão.";

  // Tabelas, cores e fontes locais ao e-mail funcionam sem CSS externo ou fontes remotas.
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapar(assunto)}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef5f3;color:#102c39;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#eef5f3">
    <tr><td align="center" style="padding:20px 10px">
      <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:600px;border:1px solid #d1e2e4">
        <tr><td bgcolor="#061d29" style="padding:20px 24px;border-top:4px solid #5099cc">
          <img src="${escapar(logo)}" alt="SYSNEY Informática" width="86" height="86" style="display:block;width:86px;height:86px;border:0;color:#eef5f3">
          <p style="margin:8px 0 0;color:#86c9f2;font-size:12px;font-weight:bold;letter-spacing:1.6px">FINANCEIRO · ${empresa}</p>
        </td></tr>
        <tr><td style="padding:24px;font-size:15px;line-height:1.6">
          <h1 style="margin:0 0 16px;color:#061d29;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:normal;line-height:1.25">${titulo}</h1>
          <p style="margin:0 0 10px">${esc(saudacao)}</p>
          <p style="margin:0 0 18px;color:#3e5b67">${esc(e.introducao)}</p>
          ${e.detalhado ? `<p style="margin:0 0 8px;color:#3e5b67;font-size:13px">Cliente: ${esc(e.cliente || "A confirmar")}</p>` : ""}
          <table aria-label="Dados da cobrança" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;font-size:14px;border:1px solid #d1e2e4">${resumo}</table>
          ${e.confirmarRecebimento ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px"><tr><td bgcolor="#eaf4f8" style="padding:12px;border-left:3px solid #5099cc;color:#183f57;font-size:14px;font-weight:bold">Por favor, confirme o recebimento desta mensagem e dos documentos.</td></tr></table>` : ""}
          ${e.observacoes ? `<p style="margin:18px 0 0;color:#3e5b67">${esc(e.observacoes)}</p>` : ""}
          <p style="margin:18px 0 0;color:#225f84;font-weight:bold">${esc(e.assinatura)}</p>
        </td></tr>
        <tr><td bgcolor="#f5f9f8" style="padding:14px 24px;border-top:1px solid #d1e2e4;font-size:12px;line-height:1.6;color:#3e5b67;overflow-wrap:anywhere">
          <p style="margin:0 0 6px">${documentos}</p>
          <a href="https://www.sysney.com" style="color:#194d70;text-decoration:underline">www.sysney.com</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}
