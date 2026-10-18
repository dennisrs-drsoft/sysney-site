export const LIMITE_CORPO = 5_500_000;

export class ErroRequisicao extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Interrompe o stream antes de guardar o corpo inteiro na memória, mesmo sem Content-Length.
export async function lerCorpoLimitado(request, limite = LIMITE_CORPO, prazoMs = 20_000) {
  const tamanho = request.headers.get("content-length");
  if (tamanho !== null && !/^\d+$/.test(tamanho)) throw new ErroRequisicao(400, "Tamanho da solicitação inválido.");
  if (tamanho !== null && Number(tamanho) > limite) throw new ErroRequisicao(413, "Arquivo muito grande.");
  if (!request.body) return undefined;
  const reader = request.body.getReader(), chunks = [];
  let total = 0, timer;
  const expirou = new Promise((_, reject) => { timer = setTimeout(() => reject(new ErroRequisicao(408, "Tempo de envio excedido. Atualize antes de tentar novamente.")), prazoMs); });
  try {
    while (true) {
      const {done, value} = await Promise.race([reader.read(), expirou]);
      if (done) break;
      total += value.byteLength;
      if (total > limite) throw new ErroRequisicao(413, "Arquivo muito grande.");
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

export const headersPrivados = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "SAMEORIGIN",
};

export function headersNavegador(producao = true) {
  // Inline permanece necessário ao shell estático Next.js e ao HTML de prévia.
  // Não equivale a CSP estrita com nonce; não liberar eval em produção.
  const csp = ["default-src 'self'", `script-src 'self' 'unsafe-inline'${producao ? "" : " 'unsafe-eval'"} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src 'self' blob: https://challenges.cloudflare.com", "frame-ancestors 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
    ...(producao ? ["upgrade-insecure-requests"] : [])].join("; ");
  return [
    {key:"X-Content-Type-Options",value:"nosniff"}, {key:"X-Frame-Options",value:"SAMEORIGIN"},
    {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
    {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=(), payment=()"},
    {key:"Content-Security-Policy",value:csp},
    ...(producao ? [{key:"Strict-Transport-Security",value:"max-age=31536000"}] : []),
  ];
}
