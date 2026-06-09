"use server";

import sgMail from "@sendgrid/mail";
import { redirect } from "next/navigation";

function limpar(valor: FormDataEntryValue | null) {
  return String(valor || "").trim();
}

function escaparHtml(valor: string) {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function enviarContato(formData: FormData) {
  const nome = limpar(formData.get("nome"));
  const empresa = limpar(formData.get("empresa"));
  const cargo = limpar(formData.get("cargo"));
  const email = limpar(formData.get("email"));
  const whatsapp = limpar(formData.get("whatsapp"));
  const cidade = limpar(formData.get("cidade"));
  const estado = limpar(formData.get("estado"));
  const site = limpar(formData.get("site"));
  const representantes = limpar(formData.get("representantes"));
  const erp = limpar(formData.get("erp"));
  const origem = limpar(formData.get("origem")) || "site-contato";
  const mensagem = limpar(formData.get("mensagem"));

  if (!nome || !empresa || !email || !whatsapp || !mensagem) {
    throw new Error("Preencha nome, empresa, e-mail, WhatsApp e mensagem.");
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const toEmail = process.env.SENDGRID_TO_EMAIL;

  if (!apiKey || !fromEmail || !toEmail) {
    throw new Error("Configuração de e-mail incompleta no servidor.");
  }

  sgMail.setApiKey(apiKey);

  const assunto = `Novo lead SISBlink - ${empresa}`;

  const texto = `
Novo lead SISBlink

Nome: ${nome}
Empresa: ${empresa}
Cargo: ${cargo}
E-mail: ${email}
WhatsApp: ${whatsapp}
Cidade/Estado: ${cidade} / ${estado}
Site: ${site}
Representantes: ${representantes}
ERP atual: ${erp}
Origem: ${origem}

Mensagem:
${mensagem}
`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2>Novo lead SISBlink</h2>

      <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
        ${[
          ["Nome", nome],
          ["Empresa", empresa],
          ["Cargo", cargo],
          ["E-mail", email],
          ["WhatsApp", whatsapp],
          ["Cidade/Estado", `${cidade} / ${estado}`],
          ["Site", site],
          ["Representantes", representantes],
          ["ERP atual", erp],
          ["Origem", origem],
        ]
          .map(
            ([label, value]) => `
              <tr>
                <td style="padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: bold; width: 180px;">
                  ${escaparHtml(label)}
                </td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">
                  ${escaparHtml(value)}
                </td>
              </tr>
            `
          )
          .join("")}
      </table>

      <h3 style="margin-top: 24px;">Mensagem</h3>
      <div style="max-width: 720px; padding: 16px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 12px;">
        ${escaparHtml(mensagem).replace(/\n/g, "<br />")}
      </div>
    </div>
  `;

  await sgMail.send({
    to: toEmail,
    from: fromEmail,
    replyTo: email,
    subject: assunto,
    text: texto,
    html,
  });

  redirect("/contato?enviado=1");
}