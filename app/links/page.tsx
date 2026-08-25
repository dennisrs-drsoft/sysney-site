import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Links Oficiais",
  description:
    "Acesse as soluções, demonstração gratuita e canais oficiais da SYSNEY Informática e do SISBlink.",
  alternates: { canonical: "/links" },
  openGraph: {
    title: "SYSNEY Informática | Links Oficiais",
    description:
      "Conheça o SISBlink, sistema de força de vendas B2B para moda, e solicite uma demonstração gratuita.",
    url: "/links",
  },
};

const solutionLinks = [
  {
    eyebrow: "Força de vendas",
    title: "Sistema comercial para moda",
    description: "Representantes, clientes, catálogo e pedidos no mesmo fluxo.",
    href: "/sistema-forca-de-vendas",
    color: "from-blue-500 to-cyan-400",
    icon: "↗",
  },
  {
    eyebrow: "Showroom digital",
    title: "Plataforma de vendas B2B",
    description: "Apresente coleções e conduza pedidos com uma experiência visual.",
    href: "/plataforma-vendas-b2b",
    color: "from-cyan-400 to-emerald-400",
    icon: "▦",
  },
  {
    eyebrow: "Canais comerciais",
    title: "Franquias e multimarcas",
    description: "Atenda redes e lojistas preservando o contexto de cada cliente.",
    href: "/vendas-para-franquias-e-multimarcas",
    color: "from-violet-500 to-blue-500",
    icon: "◇",
  },
  {
    eyebrow: "Operação conectada",
    title: "Integrações com ERP",
    description: "Produtos, clientes, preços, estoque e pedidos integrados.",
    href: "/integracoes-erp",
    color: "from-emerald-400 to-cyan-400",
    icon: "⌁",
  },
];

export default function LinksPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101d] px-5 py-8 text-white sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,#2563eb55,transparent_28%),radial-gradient(circle_at_90%_45%,#0891b233,transparent_30%),linear-gradient(180deg,#071426,#06101d)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(#ffffff08_1px,transparent_1px),linear-gradient(90deg,#ffffff08_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:linear-gradient(to_bottom,black,transparent_65%)]" />

      <div className="relative mx-auto max-w-xl">
        <header className="text-center">
          <Link href="/" aria-label="Acessar o site da SYSNEY Informática" className="inline-flex">
            <Image
              src="/logo.png"
              alt="SYSNEY Informática"
              width={220}
              height={220}
              sizes="144px"
              priority
              className="h-auto w-36"
            />
          </Link>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-300">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 5.5 5.6v5.1c0 4.4 2.7 8.2 6.5 10.3 3.8-2.1 6.5-5.9 6.5-10.3V5.6L12 3Z" />
                <path d="m9.2 12 1.8 1.8 3.9-4" />
              </svg>
            </span>
            Canal oficial · Ambiente seguro
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.34em] text-sky-300">
            SYSNEY · SISBlink
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            Tecnologia para vender moda B2B com mais controle.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Escolha abaixo o assunto que mais combina com o desafio da sua operação.
          </p>
        </header>

        <section aria-label="Contato comercial" className="mt-8">
          <Link
            href="/contato?origem=instagram-links"
            className="group flex items-center justify-between gap-4 rounded-2xl bg-blue-500 p-4 shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-400"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl">✦</span>
              <span>
                <span className="block text-xs font-bold uppercase tracking-wider text-blue-100">Gratuita e sem compromisso</span>
                <span className="mt-0.5 block text-lg font-black">Solicitar demonstração</span>
              </span>
            </span>
            <span aria-hidden="true" className="text-2xl transition group-hover:translate-x-1">→</span>
          </Link>
        </section>

        <section aria-labelledby="links-solucoes" className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-4 px-1">
            <h2 id="links-solucoes" className="text-sm font-black uppercase tracking-[0.22em] text-slate-300">
              Conheça nossas soluções
            </h2>
            <span className="text-xs text-slate-500">Toque para acessar</span>
          </div>

          <div className="space-y-3">
            {solutionLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/10 backdrop-blur transition hover:-translate-y-0.5 hover:border-sky-300/35 hover:bg-white/[0.08]"
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-xl font-black text-white shadow-lg`}>
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">{item.eyebrow}</span>
                  <span className="mt-1 block font-black text-white">{item.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{item.description}</span>
                </span>
                <span aria-hidden="true" className="text-lg text-slate-500 transition group-hover:translate-x-1 group-hover:text-sky-300">→</span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-label="Outros acessos" className="mt-5 grid grid-cols-2 gap-3">
          <Link href="/" className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center text-sm font-bold text-slate-200 transition hover:border-sky-300/35 hover:bg-white/[0.08]">
            Site completo
          </Link>
          <Link href="/contato?origem=instagram-links" className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center text-sm font-bold text-slate-200 transition hover:border-sky-300/35 hover:bg-white/[0.08]">
            Falar com a SYSNEY
          </Link>
        </section>

        <footer className="mt-9 border-t border-white/10 pt-6 text-center">
          <p className="text-sm font-black text-white">SYSNEY Informática</p>
          <p className="mt-1 text-xs text-slate-500">SISBlink · Sistema de força de vendas B2B para moda</p>
          <p className="mt-4 text-[11px] text-slate-600">www.sysney.com</p>
        </footer>
      </div>
    </main>
  );
}
