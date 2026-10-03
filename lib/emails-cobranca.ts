import { moeda, dataBr, type Empresa } from "./cobrancas";

export type AnexoEmail = { tipo: "nota" | "boleto"; nome: string; blob: string; tamanho: number };
export type TentativaEmail = { id: string; data: string; destino: string; assunto: string; html: string; status: "processando" | "aceito" | "incerto"; messageId?: string };
export type EmailCobranca = {
  id: string; empresa: Empresa; cliente: string; para: string; cc: string; responderPara?: string;
  assunto: string; saudacao: string; introducao: string; descricao: string;
  competencia: string; centavos: number; vencimento: string; observacoes: string;
  assinatura: string; detalhado: boolean; confirmarRecebimento: boolean;
  status: "rascunho" | "revisado" | "enviando" | "aceito" | "incerto";
  anexos: AnexoEmail[]; tentativas: TentativaEmail[]; atualizadoEm: string;
  aprovacaoEnvio?: { hash: string; por: string; em: string; remetente: string };
  fluxo?: { cobrancaId: string; nota: string; boleto: string; documentos?: {hash: string; por: string; em: string} };
};
export function novoEmail(empresa: Empresa, cliente = ""): EmailCobranca {
  return { id: "", empresa, cliente, para: "", cc: "", assunto: "Cobrança mensal — suporte e locação SISBlink",
    saudacao: "Olá, tudo bem?", introducao: "Segue o demonstrativo referente ao suporte e à locação do sistema.",
    descricao: "Suporte e locação do sistema SISBlink", competencia: "", centavos: 0, vencimento: "",
    observacoes: "Qualquer dúvida, estamos à disposição.", assinatura: `Financeiro | ${empresa.toUpperCase()}`,
    detalhado: true, confirmarRecebimento: true, status: "rascunho", anexos: [], tentativas: [], atualizadoEm: "" };
}
export function escapar(v: string) { return v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
export function destinatarios(v: string) { return v.split(/[;,]/).map(x => x.trim()).filter(Boolean); }
export function emailsValidos(v: string) { const lista = destinatarios(v); return lista.length > 0 && lista.length <= 10 && lista.every(x => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x)); }
export function htmlEmail(e: EmailCobranca, logo = "https://www.sysney.com/logo.png") {
  const esc = (v: string) => escapar(v).replaceAll("\n", "<br>");
  const linha = (nome: string, valor: string) => `<tr><td style="padding:14px;border-bottom:1px solid #dde5ee;color:#475569">${nome}</td><td style="padding:14px;border-bottom:1px solid #dde5ee;text-align:right;font-weight:bold">${esc(valor)}</td></tr>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(e.assunto)}</title></head><body style="margin:0;background:#edf2f7;font-family:Arial,Helvetica,sans-serif;color:#14253b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="padding:24px;background:#071b30"><img src="${escapar(logo)}" alt="SYSNEY Informática" width="110" height="110" style="display:block;width:110px;height:110px;object-fit:contain"><p style="margin:12px 0 0;color:#8ed6f3;font-size:12px;letter-spacing:2px">FINANCEIRO · ${e.empresa.toUpperCase()}</p></td></tr><tr><td style="padding:28px"><p>${esc(e.saudacao)}</p><h1 style="font-size:23px;line-height:1.3">Demonstrativo de cobrança</h1><p style="line-height:1.7;color:#475569">${esc(e.introducao)}</p>${e.detalhado ? `<p style="font-size:13px;color:#64748b">Cliente: ${esc(e.cliente || "A confirmar")}</p>` : ""}<table width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;border:1px solid #dde5ee;border-radius:8px">${e.detalhado ? linha("Descrição", e.descricao) : ""}${linha("Competência", e.competencia ? e.competencia.split("-").reverse().join("/") : "A confirmar")}${linha("Valor", e.centavos > 0 ? moeda(e.centavos) : "A confirmar")}${linha("Vencimento", e.vencimento ? dataBr(e.vencimento) : "A confirmar")}</table>${e.confirmarRecebimento ? '<p style="padding:14px;background:#eff6ff;color:#1d4ed8;font-weight:bold">Por favor, confirme o recebimento desta mensagem e dos documentos.</p>' : ""}<p style="line-height:1.7;color:#475569">${esc(e.observacoes)}</p><p style="line-height:1.6;font-weight:bold;color:#187bad">${esc(e.assinatura)}</p><p style="font-size:12px;color:#64748b">${e.anexos.length ? `Documentos anexos: ${e.anexos.map(a => escapar(a.nome)).join(" · ")}` : "Documentos ainda não anexados — rascunho para revisão."}</p><a href="https://www.sysney.com" style="font-size:12px;color:#187bad">www.sysney.com</a></td></tr></table></td></tr></table></body></html>`;
}
