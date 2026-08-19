"use server";

import sgMail from "@sendgrid/mail";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileResponse = {
  success: boolean;
  hostname?: string;
  action?: string;
};

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

function validarTamanho(valor: string, limite: number) {
  return valor.length <= limite;
}

async function validarTurnstile(token: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new Error("Proteção anti-bot não configurada no servidor.");
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const remoteip = forwardedFor?.split(",")[0]?.trim();
  const host = requestHeaders.get("host")?.split(":")[0]?.toLowerCase();

  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set("remoteip", remoteip);

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) return false;

  const resultado = (await response.json()) as TurnstileResponse;
  const hostnameValido = !host || resultado.hostname?.toLowerCase() === host;

  return resultado.success && resultado.action === "contato" && hostnameValido;
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
  const campoArmadilha = limpar(formData.get("confirmacao_empresa"));
  const iniciadoEm = Number(limpar(formData.get("iniciadoEm")));
  const turnstileToken = limpar(formData.get("cf-turnstile-response"));

  const tempoPreenchimento = Date.now() - iniciadoEm;
  const tempoValido =
    Number.isFinite(iniciadoEm) &&
    tempoPreenchimento >= 2_000 &&
    tempoPreenchimento <= 2 * 60 * 60 * 1_000;

  if (campoArmadilha || !tempoValido) {
    redirect("/contato?erro=verificacao");
  }

  if (!nome || !empresa || !email || !whatsapp || !mensagem) {
    redirect("/contato?erro=campos");
  }

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const tamanhosValidos = [
    [nome, 120],
    [empresa, 160],
    [cargo, 120],
    [email, 254],
    [whatsapp, 40],
    [cidade, 120],
    [estado, 60],
    [site, 300],
    [representantes, 50],
    [erp, 80],
    [origem, 100],
    [mensagem, 4_000],
  ].every(([valor, limite]) => validarTamanho(String(valor), Number(limite)));

  if (!emailValido || !tamanhosValidos || turnstileToken.length > 2_048) {
    redirect("/contato?erro=campos");
  }

  if (!turnstileToken || !(await validarTurnstile(turnstileToken))) {
    redirect("/contato?erro=verificacao");
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const toEmail = process.env.SENDGRID_TO_EMAIL;

  if (!apiKey || !fromEmail || !toEmail) {
    throw new Error("Configuração de e-mail incompleta no servidor.");
  }

  sgMail.setApiKey(apiKey);

  const assunto = `Novo lead SISBlink - ${empresa.replace(/[\r\n]+/g, " ")}`;

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
