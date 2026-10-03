import { createHash } from "node:crypto";
import { htmlEmail, type EmailCobranca } from "./emails-cobranca";

export function assinaturaEnvio(e: EmailCobranca, remetente: string, logoHash: string, pdfHashes: string[], auditoria = "") {
  // A aprovação cobre o conteúdo efetivamente transmitido, não somente o status.
  return createHash("sha256").update(JSON.stringify({
    empresa:e.empresa, id:e.id, remetente, para:e.para, cc:e.cc, auditoria, po:e.po, contato:e.contato,
    responderPara:e.responderPara, assunto:e.assunto, html:htmlEmail(e,"cid:logo-sysney"),
    anexos:e.anexos, pdfHashes, logoHash,
  })).digest("hex");
}
