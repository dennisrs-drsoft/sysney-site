import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sistema de Força de Vendas B2B para Moda",
  description: "O SISBlink é um sistema de força de vendas B2B com catálogo digital, pedidos e integrações ERP para indústrias, representantes, franquias e multimarcas.",
  alternates: { canonical: "/" },
};

const metrics = [
  { value: "20+", label: "anos em sistemas comerciais", icon: "👥" },
  { value: "B2B", label: "moda, atacado e franquias", icon: "🛍️" },
  { value: "360°", label: "catálogo, pedido e gestão", icon: "📈" },
];

const pillars = [
  {
    title: "Catálogo visual",
    text: "Produtos organizados por coleção, categoria, gênero, favoritos, keylook, saldo e regras de compra.",
  },
  {
    title: "Pedidos B2B",
    text: "Fluxo para representantes, franquias, multimarcas e clientes com filtros, valores e ações comerciais.",
  },
  {
    title: "Dashboard comercial",
    text: "Indicadores de meta, clientes atendidos, peças vendidas, oportunidades e faturamento.",
  },
];

const integrations = [
  "Microvix",
  "Linx",
  "EasyLinx",
  "Bling",
  "Excia",
  "Excel",
  "APIs",
  "Webservices",
  "ERPs em geral",
];

const trustedBrands = ["Levi’s", "Lacoste", "Vörr", "Twenty Four Seven", "Skyler", "Aeropostale", "Náutica", "Red Feather", "TXC"];

const businessNumbers = [
  { value: "+35", label: "clientes", detail: "operações apoiadas", icon: "♥" },
  { value: "+26", label: "marcas", detail: "no ecossistema", icon: "◆" },
  { value: "+53 mil", label: "pedidos", detail: "processados", icon: "▤" },
  { value: "R$ 854 mi", label: "em vendas", detail: "movimentadas", icon: "↗" },
];

const painPoints = [
  { title: "Estoque descentralizado", text: "Informações espalhadas dificultam a venda, frustram o cliente e geram retrabalho na separação e conferência dos pedidos.", result: "Estoque e disponibilidade no contexto da venda" },
  { title: "Catálogos presos ao e-mail", text: "Anexos pesados, mensagens que voltam ou caem no spam tornam a apresentação da coleção lenta e pouco confiável.", result: "Catálogo visual acessível pelo navegador" },
  { title: "Planilhas e perda de informação", text: "Arquivos difíceis de compartilhar e alterações não salvas colocam dados comerciais importantes em risco.", result: "Dados centralizados e fluxo rastreável" },
  { title: "Demora para iniciar pedidos", text: "Copiar modelos, preencher clientes e redigitar produtos consome o tempo que deveria ser usado para atender e vender.", result: "Cliente, produto e regras no mesmo processo" },
  { title: "Clientes que não confirmam o pedido", text: "E-mails podem ficar sem resposta, cair no spam ou atrasar a assinatura do termo de venda, deixando o pedido pendente e exigindo cobranças manuais.", result: "PDF e resumo pelo WhatsApp, confirmação automática por botão, controle da resposta, auditoria e documento com assinatura digital" },
];

const testimonials = [
  { quote: "Esse sistema é uma nave.", name: "Pedro", company: "Slim Representações" },
  { quote: "O melhor sistema que já trabalhei. Ele me proporciona trabalhar sem mostruário.", name: "Wanderlan", company: "VHV Gestão de Marcas" },
  { quote: "O melhor sistema de digitação de pedidos. Até os clientes elogiam o sistema.", name: "Gisele", company: "Pozza Representações" },
  { quote: "O sistema está tão rápido que não dá tempo do cliente pensar em desistir. Isso ajuda muito a vender.", name: "Clarissa", company: "Original Representações" },
  { quote: "É, sem dúvida, a melhor ferramenta de inovação que tivemos nos últimos tempos.", name: "André Buffon", company: "Due Representações" },
  { quote: "Você tinha que colocar esse sistema em todas as marcas do Brasil. O negócio roda fino demais.", name: "Pedro Neto", company: "Slim Representações" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white pb-20 text-slate-950 md:pb-0">
      <section className="relative min-h-screen overflow-hidden bg-[#07111f] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#2563eb66,transparent_32%),radial-gradient(circle_at_bottom_right,#0ea5e966,transparent_28%),linear-gradient(180deg,#05101f,#07111f)]" />
        <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle,#1d4ed855_1px,transparent_1px)] bg-[length:18px_18px] opacity-30" />

        <div className="relative mx-auto max-w-[1600px] px-5 py-6 sm:px-6 lg:px-10 xl:px-12">
          <header className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-8">
              <Link href="/">
                <Image
                  src="/logo.png"
                  alt="SYSNEY Informática"
                  width={260}
                  height={260}
                  sizes="(min-width: 768px) 160px, 128px"
                  priority
                  className="h-auto w-32 md:w-40"
                />
              </Link>

              <div className="hidden h-12 w-px bg-white/20 lg:block" />

              <div className="hidden lg:block">
                <p className="text-3xl font-black text-blue-400">SISBLINK</p>
                <p className="text-sm uppercase tracking-[0.28em] text-sky-300">
                  Plataforma B2B
                </p>
              </div>
            </div>

            <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-200 lg:flex">
              <Link href="/sistema-forca-de-vendas" className="hover:text-sky-300">Força de vendas</Link>
              <Link href="/plataforma-vendas-b2b" className="hover:text-sky-300">Vendas B2B</Link>
              <Link href="/vendas-para-franquias-e-multimarcas" className="hover:text-sky-300">Franquias</Link>
              <Link href="/integracoes-erp" className="hover:text-sky-300">Integrações</Link>
              <a href="#sobre" className="hover:text-sky-300">Sobre</a>
            </nav>

            <Link
              href="/contato"
              className="rounded-full bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
            >
              Demonstração gratuita
            </Link>
          </header>

          <div className="grid items-center gap-10 py-10 sm:py-14 lg:min-h-[calc(100vh-112px)] lg:grid-cols-[0.82fr_1.18fr] lg:py-16 xl:gap-16">
            <div>
              <div className="mb-6 inline-flex rounded-full border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-sky-200">
                Plataforma completa para moda e atacado B2B
              </div>

              <h1 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-tight md:text-7xl">
                Sistema de força de vendas B2B para moda{" "}
                <span className="text-blue-400">que conecta toda a operação.</span>
              </h1>

              <div className="mt-6 h-1 w-20 rounded-full bg-emerald-400" />

              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
                O SISBlink centraliza catálogo, pedidos, estoque, clientes,
                regras comerciais, integrações e dashboards em uma experiência
                visual criada para marcas que vendem melhor quando têm controle.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/contato"
                  className="rounded-full bg-blue-500 px-8 py-4 text-center font-black text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
                >
                  Solicitar demonstração gratuita ↗
                </Link>

                <a
                  href="#funcionalidades"
                  className="rounded-full border border-blue-400/60 px-8 py-4 text-center font-black text-white transition hover:bg-blue-500/10"
                >
                  Conhecer o SISBlink
                </a>
              </div>

              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
                <span className="text-emerald-300">✓</span> Gratuita, personalizada e sem compromisso.
              </p>

              <a
                href="#seguranca"
                aria-label="Conheça os recursos de segurança do SISBlink"
                className="mt-5 inline-flex items-center gap-3 rounded-xl border border-emerald-300/35 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100 shadow-[0_0_0_1px_#34d3990a,0_12px_35px_#052e2b33] backdrop-blur transition hover:border-emerald-300/60 hover:bg-emerald-300/15"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-300">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3 5.5 5.6v5.1c0 4.4 2.7 8.2 6.5 10.3 3.8-2.1 6.5-5.9 6.5-10.3V5.6L12 3Z" />
                    <path d="m9.2 12 1.8 1.8 3.9-4" />
                  </svg>
                </span>
                <span><span className="block">Ambiente seguro</span><span className="block text-[11px] font-medium text-emerald-100/65">Proteção aplicada em toda a operação</span></span>
                <span aria-hidden="true" className="ml-1 text-emerald-300">→</span>
              </a>

              <div className="mt-8 grid max-w-2xl grid-cols-3 gap-2 sm:mt-10 sm:gap-4">
                {metrics.map((item) => (
                  <div
                    key={item.value}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-xl shadow-black/10 sm:p-5"
                  >
                    <p className="hidden text-2xl sm:block">{item.icon}</p>
                    <p className="text-2xl font-black sm:mt-2 sm:text-3xl">{item.value}</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-300 sm:text-sm sm:leading-5">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[510px] overflow-hidden rounded-[2rem] border border-white/15 bg-[#102035] shadow-2xl shadow-black/40 sm:min-h-[680px] lg:min-h-[720px] xl:min-h-[760px]">
              <Image src="/sisblink/catalogo.webp" alt="Ambiente de coleção integrado ao SISBlink" width={1214} height={929} sizes="(min-width: 1024px) 52vw, 100vw" priority className="absolute inset-0 h-full w-full object-cover opacity-25" />
              <div className="absolute inset-0 bg-[linear-gradient(115deg,#061321_12%,#0d2a3be8_48%,#164e63aa),radial-gradient(circle_at_75%_20%,#38bdf855,transparent_30%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(#ffffff08_1px,transparent_1px),linear-gradient(90deg,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]" />

              <div className="absolute left-6 top-6 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur md:left-8 md:top-8"><p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-200">SISBlink Web</p><p className="mt-1 text-xs font-bold text-white">Sales platform</p></div>
              <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-xs font-bold text-emerald-100 backdrop-blur"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" /> Operação conectada</div>

              <div className="absolute left-7 top-28 max-w-[88%] sm:top-32 md:left-10 md:top-36"><p className="text-xs font-black uppercase tracking-[0.35em] text-sky-200">Coleção atual</p><p className="mt-3 text-3xl font-black uppercase leading-none tracking-[-0.04em] text-white/95 sm:text-4xl md:text-6xl xl:text-7xl">Identidade<br/><span className="text-sky-300">em movimento.</span></p><div className="mt-5 flex gap-2 sm:mt-6" aria-label="Cartela de cores da coleção"><span className="h-5 w-5 rounded-full border border-white/30 bg-[#e8ded0]"/><span className="h-5 w-5 rounded-full border border-white/30 bg-[#29465b]"/><span className="h-5 w-5 rounded-full border border-white/30 bg-[#b65b46]"/><span className="h-5 w-5 rounded-full border border-white/30 bg-[#8ba59c]"/></div></div>

              <div className="absolute right-5 top-[330px] hidden w-[42%] rotate-2 overflow-hidden rounded-2xl border border-white/20 bg-white p-2 text-slate-950 shadow-2xl sm:block md:right-8 md:top-[350px] md:w-[36%] xl:top-[380px] xl:w-[34%]"><div className="overflow-hidden rounded-xl bg-slate-50"><Image src="/sisblink/produto-2.png" alt="Produto integrado à coleção no SISBlink" width={1141} height={500} sizes="280px" className="h-28 w-full object-cover object-left md:h-36 xl:h-40" /></div><div className="flex items-center justify-between px-2 pb-1 pt-3"><div><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Produto conectado</p><p className="text-xs font-black">Cor · Grade · Preço</p></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black text-emerald-700">Disponível</span></div></div>

              <div className="absolute bottom-6 left-5 right-5 rounded-[1.5rem] border border-white/15 bg-[#07111f]/90 p-5 shadow-2xl backdrop-blur-xl md:bottom-8 md:left-8 md:right-auto md:w-[62%] md:p-6 xl:w-[58%]"><p className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-200">A experiência da marca, com a precisão da operação.</p><p className="mt-3 text-xl font-black leading-tight text-white md:text-2xl">SISBlink Web + coleção da marca</p><p className="mt-3 max-w-lg text-xs leading-5 text-slate-300 md:text-sm">Identidade visual, contexto comercial e controle seguro para conduzir todo o ciclo de vendas.</p><div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-300"><span className="rounded-full border border-white/15 px-3 py-1.5">Catálogo</span><span className="rounded-full border border-white/15 px-3 py-1.5">Pedido</span><span className="rounded-full border border-white/15 px-3 py-1.5">Estoque</span></div></div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Resultados e marcas" className="relative border-y border-slate-200 bg-slate-50 px-6 py-12 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-center text-sm font-black uppercase tracking-[0.3em] text-blue-700">Experiência construída em operações reais</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-center text-3xl font-black tracking-tight md:text-4xl">Marcas reconhecidas presentes em operações atendidas pelo SISBlink.</h2>
          <div className="-mx-6 mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-3 sm:mx-0 sm:mt-9 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0">
            {trustedBrands.map((brand) => <span key={brand} className="shrink-0 snap-start rounded-full border border-slate-200 bg-white px-5 py-3 text-base font-black tracking-tight text-slate-700 shadow-sm sm:text-lg">{brand}</span>)}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4 lg:grid-cols-4">
            {businessNumbers.map((item) => <article key={item.label} className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-7"><span className="absolute right-4 top-3 text-2xl text-blue-100 sm:right-5 sm:top-4 sm:text-3xl">{item.icon}</span><p className="text-3xl font-black tracking-tight text-blue-700 sm:text-4xl md:text-5xl">{item.value}</p><p className="mt-1 font-black text-slate-900 sm:mt-2 sm:text-lg">{item.label}</p><p className="text-xs text-slate-500 sm:text-sm">{item.detail}</p></article>)}
          </div>
          <p className="mt-5 text-center text-xs text-slate-500">Números consolidados do histórico de operações atendidas pela plataforma.</p>
        </div>
      </section>

      <section className="bg-white px-6 py-14 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-blue-700">Soluções por desafio</p>
          <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-5xl">Tecnologia comercial para vender coleções a franquias, multimarcas e outros clientes B2B.</h2>
          <div className="-mx-6 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:mt-10 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4">
            {[
              ["Sistema de força de vendas", "Organize representantes, clientes, catálogo e pedidos em uma jornada conectada.", "/sistema-forca-de-vendas"],
              ["Plataforma de vendas B2B", "Transforme a coleção em um showroom digital preparado para o atacado.", "/plataforma-vendas-b2b"],
              ["Franquias e multimarcas", "Atenda diferentes lojas e grupos preservando o contexto de cada pedido.", "/vendas-para-franquias-e-multimarcas"],
              ["Integrações ERP", "Conecte produtos, clientes, preços, estoque e pedidos ao ecossistema da empresa.", "/integracoes-erp"],
            ].map(([title, text, href]) => <Link key={href} href={href} className="group min-w-[82vw] snap-center rounded-3xl border border-slate-200 bg-slate-50 p-6 transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl md:min-w-0"><h3 className="text-xl font-black text-blue-800">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p><span className="mt-5 inline-block font-black text-blue-600 group-hover:text-blue-500">Saiba mais →</span></Link>)}
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="bg-white px-6 py-14 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <h2 className="text-center text-3xl font-black tracking-tight md:text-4xl">
            Do catálogo ao pedido finalizado, com controle total.
          </h2>

          <div className="-mx-6 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 lg:mx-0 lg:mt-10 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0">
            {pillars.map((item, index) => (
              <div
                key={item.title}
                className="min-w-[82vw] snap-center rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl lg:min-w-0"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-2xl font-black text-white shadow-lg shadow-blue-500/30">
                  {index === 0 ? "▣" : index === 1 ? "▤" : "↗"}
                </div>
                <h3 className="mt-6 text-xl font-black text-blue-700">
                  {item.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-[#07111f] px-6 py-16 text-white sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="max-w-4xl"><p className="text-sm font-black uppercase tracking-[0.35em] text-sky-300">Problemas que custam vendas</p><h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Quando a operação depende de e-mails, planilhas e informações dispersas, o time perde velocidade.</h2><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">O SISBlink foi evoluído a partir da rotina comercial para eliminar atritos que aparecem antes, durante e depois do atendimento.</p></div>
          <div className="-mx-6 mt-9 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:mt-12 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0">
            {painPoints.map((pain, index) => <article key={pain.title} className="min-w-[85vw] snap-center rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur md:min-w-0 md:p-7"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-400/10 font-black text-red-300">0{index + 1}</span><div><h3 className="text-xl font-black">{pain.title}</h3><p className="mt-3 leading-7 text-slate-300">{pain.text}</p><p className="mt-5 border-t border-white/10 pt-4 font-bold text-emerald-300">✓ {pain.result}</p></div></div></article>)}
          </div>
        </div>
      </section>

      <section id="solucoes" className="bg-[#eef5fb] px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-[1600px] items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="mb-4 text-sm font-black uppercase tracking-[0.35em] text-blue-700">
              Showroom digital
            </p>
            <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">
              Da apresentação da coleção ao pedido finalizado.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-700">
              O SISBlink foi criado para transformar o processo comercial em uma
              jornada visual: o cliente navega, compara produtos, consulta
              disponibilidade, seleciona quantidades e acompanha valores em
              tempo real.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                "Catálogo por coleção, gênero, família, categoria e produto",
                "Produtos com imagem, cor, grade, preço e saldo disponível",
                "Pedido com valores, quantidades, status e regras comerciais",
                "Filtros, favoritos, keylook, não pedidos e busca inteligente",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-5 font-bold text-slate-800 shadow-sm"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[#07111f] p-3 shadow-2xl shadow-slate-300">
            <div className="overflow-hidden bg-white">
              <Image
                src="/sisblink/catalogo-pedido.webp"
                alt="Catálogo SISBlink"
                width={1916}
                height={1073}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="hidden bg-white px-6 py-16 sm:py-24 md:block lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-10 max-w-3xl">
            <p className="mb-4 text-sm font-black uppercase tracking-[0.35em] text-blue-700">
              Catálogo visual
            </p>
            <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">
              Produtos, imagens, cores, grades e disponibilidade em uma tela pensada para vender.
            </h2>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xl shadow-slate-200">
            <div className="overflow-hidden bg-white">
              <Image
                src="/sisblink/catalogo.webp"
                alt="Catálogo visual SISBlink"
                width={1214}
                height={929}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="hidden bg-[#07111f] px-6 py-16 text-white sm:py-24 md:block lg:px-8">
        <div className="mx-auto grid max-w-[1600px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="overflow-hidden bg-white">
              <Image
                src="/sisblink/estoque.webp"
                alt="Saldo por tamanho SISBlink"
                width={1258}
                height={892}
                sizes="(min-width: 1024px) 53vw, 100vw"
                className="h-auto w-full"
              />
            </div>
          </div>

          <div>
            <p className="mb-4 text-sm font-black uppercase tracking-[0.35em] text-sky-300">
              Controle operacional
            </p>
            <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">
              Estoque, grade e vendas por tamanho, cor e produto.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Tenha uma leitura clara do que está disponível, do que já foi
              vendido e de onde existem oportunidades. O SISBlink ajuda o time
              comercial a vender com informação, não com tentativa.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#eef5fb] px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-[1600px] items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="mb-4 text-sm font-black uppercase tracking-[0.35em] text-blue-700">
              Gestão comercial
            </p>
            <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">
              Pedidos, clientes, status e ações comerciais em um painel único.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-700">
              Consulte pedidos, filtre clientes, execute ações comerciais,
              acompanhe valores e tenha uma visão operacional clara da campanha.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-300">
            <div className="overflow-hidden bg-white">
              <Image
                src="/sisblink/pedidos.webp"
                alt="Painel de pedidos SISBlink"
                width={1363}
                height={767}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#07111f] px-6 py-16 text-white sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-[1600px] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="overflow-hidden bg-white">
              <Image
                src="/sisblink/dashboard.webp"
                alt="Dashboard comercial SISBlink"
                width={1263}
                height={847}
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="h-auto w-full"
              />
            </div>
          </div>

          <div>
            <p className="mb-4 text-sm font-black uppercase tracking-[0.35em] text-sky-300">
              Inteligência comercial
            </p>
            <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">
              Métricas, metas, oportunidades e leitura de coleção.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Acompanhe clientes atendidos, referências digitadas, faturamento,
              peças vendidas, categorias e oportunidades para agir durante a
              campanha, não depois dela.
            </p>
          </div>
        </div>
      </section>

      <section id="integracoes" className="bg-white px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="mb-4 text-sm font-black uppercase tracking-[0.35em] text-blue-700">
                Integrações
              </p>
              <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">
                Conecte o SISBlink ao ecossistema da sua empresa.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-700">
                O SISBlink pode atuar integrado a ERPs, plataformas comerciais,
                planilhas, APIs, webservices e rotinas personalizadas para manter
                produtos, clientes, estoque, preços e pedidos sincronizados.
              </p>
              <Link href="/integracoes-erp" className="mt-7 inline-flex font-black text-blue-700 hover:text-blue-500">Conheça as possibilidades de integração →</Link>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {integrations.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center text-xs font-black shadow-sm sm:rounded-3xl sm:p-6 sm:text-base"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="seguranca" className="scroll-mt-8 bg-[#eef5fb] px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-[1600px] items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div><p className="text-sm font-black uppercase tracking-[0.35em] text-blue-700">Segurança por arquitetura</p><h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Informações comerciais protegidas em todas as etapas.</h2><p className="mt-6 text-lg leading-8 text-slate-700">Segurança não é apenas um selo visual. O SISBlink valida identidade, empresa, marca, coleção e permissões no servidor antes de liberar dados ou executar ações.</p><Link href="/contato" className="mt-7 inline-flex font-black text-blue-700 hover:text-blue-500">Converse sobre os requisitos da sua operação →</Link></div>
          <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [&>article]:min-w-[78vw] [&>article]:snap-center sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 sm:[&>article]:min-w-0">
            {[["Acesso controlado", "Perfis, permissões e escopo comercial por usuário."], ["Regras no servidor", "Preços, estoque e validações sensíveis não dependem do navegador."], ["Infraestrutura Azure", "Aplicação publicada com HTTPS e serviços gerenciados na nuvem Microsoft."], ["Contato protegido", "Formulário com Cloudflare Turnstile, validação e proteção contra automações."], ["Segredos protegidos", "Chaves e credenciais permanecem no ambiente seguro do servidor."], ["Rastreabilidade", "Operações críticas possuem validações e registros para apoio à gestão."]].map(([title, text]) => <article key={title} className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-black text-emerald-700">✓</div><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-2 leading-7 text-slate-600">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1600px]"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-black uppercase tracking-[0.35em] text-blue-700">Quem usa, recomenda</p><h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">A experiência de quem vende todos os dias com o SISBlink.</h2></div>
          <div className="-mx-6 mt-9 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:mt-12 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3">{testimonials.map((item) => <figure key={`${item.name}-${item.company}`} className="flex min-h-60 min-w-[82vw] snap-center flex-col rounded-3xl border border-slate-200 bg-slate-50 p-7 shadow-sm md:min-h-64 md:min-w-0"><div className="text-4xl font-black leading-none text-blue-300">“</div><blockquote className="mt-4 flex-1 text-lg font-bold leading-8 text-slate-800">{item.quote}</blockquote><figcaption className="mt-6 border-t border-slate-200 pt-5"><p className="font-black text-blue-800">{item.name}</p><p className="text-sm text-slate-500">{item.company}</p></figcaption></figure>)}</div>
          <p className="mt-6 text-center text-sm text-slate-500">Depoimentos espontâneos de usuários, reproduzidos com pequenos ajustes de pontuação e clareza.</p>
        </div>
      </section>

      <section id="contato" className="bg-blue-500 px-6 py-16 text-white sm:py-24 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-4 text-sm font-black uppercase tracking-[0.35em]">
            Próximo passo
          </p>
          <h2 className="text-4xl font-black leading-tight tracking-tight md:text-6xl">
            Quer transformar sua operação B2B com o SISBlink?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-blue-50">
            Agende uma conversa para entender como o SISBlink pode apoiar sua
            marca, representantes, franquias, multimarcas e canais B2B.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/contato"
              className="rounded-full bg-white px-8 py-4 font-black text-blue-700 transition hover:bg-slate-100"
            >
              Solicitar demonstração
            </Link>
            <Link
              href="/contato"
              className="rounded-full border border-white px-8 py-4 font-black text-white transition hover:bg-white hover:text-blue-700"
            >
              Falar com a SYSNEY
            </Link>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-2xl border border-emerald-300/25 bg-[#07111f]/95 p-2.5 shadow-2xl shadow-black/40 backdrop-blur-xl md:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2 text-xs font-bold text-emerald-100"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-300">✓</span><span className="truncate">Ambiente seguro</span></div>
        <Link href="/contato" className="shrink-0 rounded-xl bg-blue-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/30">Demonstração grátis</Link>
      </div>

      <footer id="sobre" className="bg-[#07111f] px-6 py-10 text-slate-400 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black text-white">SYSNEY Informática</p>
            <p className="text-sm">SISBlink - Plataforma B2B para moda.</p>
          </div>
          <p className="text-sm">
            © {new Date().getFullYear()} SYSNEY. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}
