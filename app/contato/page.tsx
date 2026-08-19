import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { AntiBotFields } from "./anti-bot-fields";
import { enviarContato } from "./actions";

export const metadata: Metadata = {
  title: "Solicite uma Demonstração",
  description: "Converse com a SYSNEY e veja como o SISBlink pode apoiar sua força de vendas, catálogo, pedidos B2B e integrações ERP.",
  alternates: { canonical: "/contato" },
};

type Props = {
  searchParams?: Promise<{
    enviado?: string;
    origem?: string;
    erro?: string;
  }>;
};

export default async function ContatoPage({ searchParams }: Props) {
  const params = await searchParams;
  const enviado = params?.enviado === "1";
  const origem = params?.origem || "site-contato";
  const erro = params?.erro;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#2563eb66,transparent_32%),radial-gradient(circle_at_bottom_left,#0ea5e955,transparent_28%),linear-gradient(180deg,#05101f,#07111f)]" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-10 lg:grid-cols-[0.85fr_1.15fr] lg:px-8 lg:py-20">
          <div>
            <Link href="/" className="text-sm font-bold text-sky-300 hover:text-white">
              ← Voltar para o site
            </Link>

            <p className="mt-14 text-sm font-black uppercase tracking-[0.35em] text-sky-300">
              Demonstração
            </p>

            <h1 className="mt-4 text-5xl font-black leading-tight md:text-6xl">
              Vamos entender sua operação B2B?
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Preencha o formulário para avaliarmos como o SISBlink pode apoiar
              sua marca, representantes, franquias, multimarcas e integrações
              comerciais.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                "Catálogo digital",
                "Pedidos B2B",
                "Integrações com ERP",
                "Dashboards comerciais",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 font-bold"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <form
            action={enviarContato}
            className="rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl lg:p-10"
          >
            <input type="hidden" name="origem" value={origem} />
            <AntiBotFields />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden opacity-0"
            >
              <label htmlFor="confirmacao_empresa">Não preencha este campo</label>
              <input
                id="confirmacao_empresa"
                name="confirmacao_empresa"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {enviado && (
              <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                <p className="font-black">Contato enviado com sucesso.</p>
                <p className="mt-1 text-sm">
                  Recebemos sua mensagem e retornaremos em breve.
                </p>
              </div>
            )}

            {erro && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                <p className="font-black">Não foi possível enviar o contato.</p>
                <p className="mt-1 text-sm">
                  {erro === "verificacao"
                    ? "Atualize a página, conclua a verificação de segurança e tente novamente."
                    : "Revise os campos informados e tente novamente."}
                </p>
              </div>
            )}

            <h2 className="text-3xl font-black">Solicitar demonstração</h2>
            <p className="mt-2 text-slate-600">
              Quanto mais contexto você enviar, melhor conseguimos preparar a conversa.
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <input
                name="nome"
                required
                maxLength={120}
                placeholder="Seu nome *"
                className="rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-500"
              />

              <input
                name="empresa"
                required
                maxLength={160}
                placeholder="Empresa *"
                className="rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-500"
              />

              <input
                name="cargo"
                maxLength={120}
                placeholder="Cargo"
                className="rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-500"
              />

              <input
                name="email"
                required
                type="email"
                maxLength={254}
                placeholder="E-mail *"
                className="rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-500"
              />

              <input
                name="whatsapp"
                required
                maxLength={40}
                placeholder="WhatsApp *"
                className="rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-500"
              />

              <input
                name="site"
                maxLength={300}
                placeholder="Site da empresa"
                className="rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-500"
              />

              <input
                name="cidade"
                maxLength={120}
                placeholder="Cidade"
                className="rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-500"
              />

              <input
                name="estado"
                maxLength={60}
                placeholder="Estado"
                className="rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-500"
              />

              <select
                name="representantes"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-blue-500"
                defaultValue=""
              >
                <option value="" disabled>
                  Quantidade de representantes
                </option>
                <option value="Até 5">Até 5</option>
                <option value="6 a 20">6 a 20</option>
                <option value="21 a 50">21 a 50</option>
                <option value="Acima de 50">Acima de 50</option>
                <option value="Não se aplica">Não se aplica</option>
              </select>

              <select
                name="erp"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-4 outline-none focus:border-blue-500"
                defaultValue=""
              >
                <option value="" disabled>
                  ERP atual
                </option>
                <option value="Microvix">Microvix</option>
                <option value="Linx">Linx</option>
                <option value="EasyLinx">EasyLinx</option>
                <option value="Bling">Bling</option>
                <option value="Totvs">Totvs</option>
                <option value="SAP">SAP</option>
                <option value="Excel / Planilhas">Excel / Planilhas</option>
                <option value="Outro">Outro</option>
                <option value="Ainda não possui">Ainda não possui</option>
              </select>

              <textarea
                name="mensagem"
                required
                maxLength={4000}
                placeholder="Conte rapidamente o que você procura *"
                rows={6}
                className="md:col-span-2 rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-500"
              />

              {turnstileSiteKey ? (
                <div className="md:col-span-2">
                  <Script
                    src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                    strategy="afterInteractive"
                  />
                  <div
                    className="cf-turnstile"
                    data-sitekey={turnstileSiteKey}
                    data-action="contato"
                    data-theme="light"
                    data-language="pt-BR"
                  />
                </div>
              ) : (
                <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Verificação de segurança temporariamente indisponível.
                </div>
              )}

              <button
                type="submit"
                disabled={!turnstileSiteKey}
                className="md:col-span-2 rounded-full bg-blue-600 px-8 py-4 font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Enviar contato
              </button>
            </div>

            <p className="mt-5 text-sm text-slate-500">
              Campos com * são obrigatórios.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
