import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const title = "Links oficiais da SYSNEY e do SISBlink";
const description = "Encontre as telas do SISBlink, soluções para pequenas marcas, moda e multimarcas, integrações ERP, demonstração e orientação nos links oficiais da SYSNEY.";
export const metadata: Metadata = {
  title, description, alternates: { canonical: "/links" },
  openGraph: { title, description, url: "/links", type: "website", locale: "pt_BR", siteName: "SISBlink", images: [{ url: "/sisblink/telas/catalogo.webp", width: 1920, height: 1080, alt: "Catálogo digital e pedidos por grade no SISBlink" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/sisblink/telas/catalogo.webp"] },
};

const solutionLinks = [
  { number: "01", eyebrow: "Confecções, marcas e representantes", title: "Pedidos para confecção e moda", description: "Catálogo digital, grade, cor e tamanho. Pré-venda de coleção e pronta entrega no mesmo fluxo comercial.", href: "/sistema-pedidos-confeccao-moda", tag: "Coleção e pedidos" },
  { number: "02", eyebrow: "Lojas multimarcas", title: "Compras e reposição de estoque", description: "Organize o mix, avalie os tamanhos que faltam e planeje compras com atenção ao estoque parado.", href: "/compras-reposicao-multimarcas", tag: "Mix e reposição" },
  { number: "03", eyebrow: "Força de vendas", title: "Sistema comercial para moda", description: "Representantes, clientes, catálogo e pedidos conectados para apoiar a rotina da equipe comercial.", href: "/sistema-forca-de-vendas", tag: "Equipe comercial" },
  { number: "04", eyebrow: "Showroom digital", title: "Plataforma de vendas B2B", description: "Apresente suas coleções e conduza pedidos de atacado com uma experiência visual de compra.", href: "/plataforma-vendas-b2b", tag: "Vendas no atacado" },
  { number: "05", eyebrow: "Canais comerciais", title: "Franquias e multimarcas", description: "Atenda redes e lojistas preservando o contexto de cada cliente, loja e pedido.", href: "/vendas-para-franquias-e-multimarcas", tag: "Redes e lojistas" },
  { number: "06", eyebrow: "Operação conectada", title: "Integrações com ERP", description: "Veja as possibilidades de conectar produtos, clientes, preços, estoque e pedidos ao seu ERP.", href: "/integracoes-erp", tag: "Dados integrados" },
];

const cardFocus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300";

function Arrow({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 ${className}`}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

export default function LinksPage() {
  return <main className="relative min-h-screen overflow-hidden bg-[#06101d] px-5 py-7 text-white sm:px-8 sm:py-10 lg:px-12">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#1d4ed833,transparent_45%),radial-gradient(ellipse_at_top_right,#0891b222,transparent_45%)]" />
    <div className="relative mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <Link href="/" aria-label="Acessar o site da SYSNEY Informática" className={`inline-flex items-center gap-4 rounded-lg ${cardFocus}`}><Image src="/logo.png" alt="SYSNEY Informática" width={220} height={220} sizes="96px" preload className="h-auto w-20 sm:w-24" /><span className="border-l border-white/15 pl-4 text-xs font-black uppercase tracking-[0.18em] text-slate-300">SISBlink<br /><span className="mt-1 block text-[10px] font-medium tracking-wider text-slate-500">Tecnologia para moda</span></span></Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-xs font-semibold text-emerald-200"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Links oficiais</span>
      </header>

      <section aria-labelledby="links-title" className="pb-8 pt-9 sm:pb-10 sm:pt-12">
        <p className="text-[11px] font-black uppercase tracking-[0.26em] text-sky-300">SYSNEY · SISBlink</p>
        <div className="mt-4 grid items-end gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12"><h1 id="links-title" className="max-w-2xl text-3xl font-black leading-[1.12] tracking-tight sm:text-4xl lg:text-5xl">O próximo passo da sua operação começa aqui.</h1><p className="max-w-xl text-sm leading-7 text-slate-300 sm:text-base">Conheça a plataforma, encontre a solução para sua rotina ou fale com a SYSNEY. Todos os caminhos para vender moda B2B com mais clareza e controle.</p></div>
      </section>

      <section aria-label="Comece por aqui" className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Link href="/sisblink-em-acao" className={`group overflow-hidden rounded-3xl border border-sky-300/25 bg-[#0d2033] shadow-xl shadow-black/15 transition hover:border-sky-300/60 ${cardFocus}`}>
          <div className="flex items-start justify-between gap-4 p-6 sm:p-7"><div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Conheça por dentro</span><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">SISBlink em ação</h2><p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">Veja as telas reais: catálogo, shopping, pedido por grade, dashboard, chat e espelhamento.</p></div><span className="rounded-full border border-white/15 bg-white/5 p-3 text-sky-300 transition group-hover:translate-x-1"><Arrow /></span></div>
          <div className="mx-4 rounded-t-xl border border-b-0 border-white/15 bg-white/5 p-1.5 sm:mx-7"><Image src="/sisblink/telas/catalogo.webp" alt="Catálogo do SISBlink com produtos, foto ampliada e montagem do pedido por tamanho" width={1920} height={1080} sizes="(min-width: 1024px) 680px, 100vw" className="h-auto w-full rounded-t-lg object-contain" /></div>
        </Link>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Link href="/contato?origem=instagram-links&interesse=avaliacao" className={`group flex flex-col justify-between gap-6 rounded-3xl bg-blue-500 p-6 shadow-xl shadow-blue-950/25 transition hover:bg-blue-400 sm:p-7 ${cardFocus}`}>
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">Gratuita e sem compromisso</p><h2 className="mt-3 text-2xl font-black leading-tight">Solicitar demonstração</h2><p className="mt-3 text-sm leading-6 text-blue-50">Avalie o SISBlink no contexto da sua empresa e receba uma proposta para sua operação.</p></div><span className="flex items-center justify-between text-sm font-black">Quero conhecer o SISBlink<Arrow className="transition group-hover:translate-x-1" /></span>
          </Link>
          <Link href="/contato?origem=instagram-links" className={`group flex flex-col justify-between gap-6 rounded-3xl border border-white/15 bg-white/[0.04] p-6 transition hover:border-emerald-300/40 hover:bg-white/[0.07] sm:p-7 ${cardFocus}`}><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Contato comercial</p><h2 className="mt-3 text-xl font-black">Falar com a SYSNEY</h2><p className="mt-3 text-sm leading-6 text-slate-300">Converse sobre funcionalidades, integração, implantação e as necessidades da sua equipe.</p></div><span className="flex items-center justify-between text-sm font-bold text-emerald-200">Conte o que sua empresa precisa<Arrow className="transition group-hover:translate-x-1" /></span></Link>
        </div>
      </section>

      <Link href="/sistema-vendas-pequenas-marcas" className={`group mt-6 flex flex-col justify-between gap-5 rounded-3xl border border-emerald-300/25 bg-emerald-300/5 p-6 transition hover:border-emerald-300/50 hover:bg-emerald-300/10 sm:flex-row sm:items-center sm:p-7 ${cardFocus}`}><span><span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Pequenas marcas · Equipes enxutas</span><span className="mt-2 block text-xl font-black">Sua marca não precisa ser grande para vender de forma organizada.</span><span className="mt-3 block max-w-3xl text-sm leading-6 text-slate-300">Catálogo, pedidos e acompanhamento comercial para quem tem poucas pessoas nas vendas ou atende os clientes pessoalmente.</span></span><span className="flex shrink-0 items-center gap-3 text-sm font-bold text-emerald-200">Conheça a solução<Arrow className="transition group-hover:translate-x-1" /></span></Link>

      <section aria-labelledby="links-solucoes" className="mt-12 sm:mt-16">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">Encontre sua solução</p><h2 id="links-solucoes" className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Qual é o desafio da sua operação?</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{solutionLinks.map(item => <Link key={item.href} href={item.href} className={`group flex flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-0.5 hover:border-sky-300/40 hover:bg-white/[0.065] ${cardFocus}`}><div className="flex items-center justify-between gap-3"><span aria-hidden="true" className="text-xs font-bold tracking-wider text-slate-500">{item.number}</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium text-slate-300">{item.tag}</span></div><p className="mt-6 text-[10px] font-black uppercase tracking-[0.15em] text-sky-300">{item.eyebrow}</p><h3 className="mt-2 text-lg font-black leading-snug">{item.title}</h3><p className="mb-6 mt-3 text-sm leading-6 text-slate-400">{item.description}</p><span className="mt-auto flex items-center justify-between text-xs font-bold text-sky-200">Conhecer a solução<Arrow className="h-4 w-4 transition group-hover:translate-x-1" /></span></Link>)}</div>
      </section>

      <section aria-labelledby="links-apoio" className="mt-10 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:mt-12 sm:p-7"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Para quem já usa o SISBlink</p><h2 id="links-apoio" className="mt-3 text-xl font-black">Ajuda para representantes</h2><Link href="/suporte/confirmacao-whatsapp" rel="nofollow" className={`group mt-5 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-emerald-300/40 ${cardFocus}`}><span><span className="block text-sm font-bold">Guia de confirmação pelo WhatsApp</span><span className="mt-1 block text-xs leading-5 text-slate-400">Passo a passo visual para confirmar e solicitar a reabertura de pedidos.</span></span><Arrow className="text-emerald-200 transition group-hover:translate-x-1" /></Link></section>

      <footer className="mt-10 flex flex-col items-start justify-between gap-5 border-t border-white/10 py-7 sm:flex-row sm:items-center"><div><p className="text-sm font-black text-slate-200">SYSNEY Informática</p><p className="mt-2 text-xs leading-5 text-slate-500">SISBlink · Sistema de força de vendas B2B para moda</p></div><Link href="/" className={`inline-flex items-center gap-3 rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-slate-200 transition hover:border-sky-300/40 hover:text-sky-200 ${cardFocus}`}>Site completo<Arrow className="h-4 w-4" /></Link></footer>
    </div>
  </main>;
}
