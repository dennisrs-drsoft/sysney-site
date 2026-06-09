import Image from "next/image";
import Link from "next/link";

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

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="relative overflow-hidden bg-[#07111f] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#2563eb66,transparent_32%),radial-gradient(circle_at_bottom_right,#0ea5e966,transparent_28%),linear-gradient(180deg,#05101f,#07111f)]" />
        <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle,#1d4ed855_1px,transparent_1px)] bg-[length:18px_18px] opacity-30" />

        <div className="relative mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <header className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-8">
              <Link href="/">
                <Image
                  src="/logo.png"
                  alt="SYSNEY Informática"
                  width={280}
                  height={90}
                  priority
                  className="h-auto w-[190px] md:w-[250px]"
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
              <a href="#solucoes" className="hover:text-sky-300">Soluções</a>
              <a href="#funcionalidades" className="hover:text-sky-300">Funcionalidades</a>
              <a href="#integracoes" className="hover:text-sky-300">Integrações</a>
              <a href="#sobre" className="hover:text-sky-300">Sobre</a>
            </nav>

            <Link
              href="/contato"
              className="rounded-full bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
            >
              Solicitar demonstração
            </Link>
          </header>

          <div className="grid items-center gap-16 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
            <div>
              <div className="mb-6 inline-flex rounded-full border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-sky-200">
                Plataforma completa para moda e atacado B2B
              </div>

              <h1 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-tight md:text-7xl">
                Transforme sua venda B2B em um showroom digital{" "}
                <span className="text-blue-400">completo.</span>
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
                  Quero uma demonstração ↗
                </Link>

                <a
                  href="#funcionalidades"
                  className="rounded-full border border-blue-400/60 px-8 py-4 text-center font-black text-white transition hover:bg-blue-500/10"
                >
                  Conhecer o SISBlink
                </a>
              </div>

              <div className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
                {metrics.map((item) => (
                  <div
                    key={item.value}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10"
                  >
                    <p className="text-2xl">{item.icon}</p>
                    <p className="mt-2 text-3xl font-black">{item.value}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-300">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[520px]">
              <div className="absolute left-0 top-6 w-[82%] overflow-hidden rounded-xl border border-blue-300/30 bg-slate-900 p-2 shadow-2xl shadow-blue-950/50">
                <div className="overflow-hidden bg-white">
                  <Image
                    src="/sisblink/home.png"
                    alt="Tela principal do SISBlink"
                    width={1500}
                    height={850}
                    className="h-auto w-full"
                    priority
                  />
                </div>
              </div>

              <div className="absolute right-0 top-28 w-[38%] rounded-2xl bg-white p-5 text-slate-950 shadow-2xl shadow-black/30">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-black">Pedidos por grupo</p>
                  <p className="text-xs text-slate-500">tempo real</p>
                </div>

                {[
                  ["Grupo Atlas", "82%", "bg-cyan-400"],
                  ["Grupo Vértice", "64%", "bg-blue-500"],
                  ["Grupo Milano", "46%", "bg-violet-500"],
                  ["Grupo Aurora", "72%", "bg-emerald-400"],
                ].map(([name, width, color]) => (
                  <div key={name} className="mb-4">
                    <div className="mb-1 flex justify-between text-xs font-bold">
                      <span>{name}</span>
                      <span>{width}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div
                        className={`h-2 rounded-full ${color}`}
                        style={{ width }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="absolute bottom-6 left-2 w-[52%] rounded-2xl border border-blue-400/40 bg-[#07111f]/95 p-5 shadow-2xl shadow-black/30 backdrop-blur">
                <p className="font-bold text-slate-200">História da coleção</p>
                <p className="mt-3 text-3xl font-black">R$ 165.562,00</p>
                <p className="mt-1 text-sm text-slate-400">
                  Meta: R$ 180.000,00, 92,0% atingido
                </p>
                <div className="mt-5 h-2 rounded-full bg-white/10">
                  <div className="h-2 w-[92%] rounded-full bg-emerald-400" />
                </div>
              </div>

              <div className="absolute bottom-8 right-0 w-[38%] rounded-2xl border border-blue-400/40 bg-[#07111f]/95 p-5 shadow-2xl shadow-black/30 backdrop-blur">
                <p className="font-bold text-slate-200">Clientes x Meta</p>
                <p className="mt-2 text-3xl font-black">2</p>
                <div className="mt-5 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span>Cliente Alfa</span>
                    <span className="text-emerald-400">104,01%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cliente Beta</span>
                    <span className="text-red-300">0,00%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="bg-white px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-black tracking-tight md:text-4xl">
            Do catálogo ao pedido finalizado, com controle total.
          </h2>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {pillars.map((item, index) => (
              <div
                key={item.title}
                className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
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

      <section id="solucoes" className="bg-[#eef5fb] px-6 py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
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
                src="/sisblink/catalogo-pedido.png"
                alt="Catálogo SISBlink"
                width={1600}
                height={950}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
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
                src="/sisblink/catalogo.png"
                alt="Catálogo visual SISBlink"
                width={1600}
                height={950}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#07111f] px-6 py-24 text-white lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="overflow-hidden bg-white">
              <Image
                src="/sisblink/estoque.png"
                alt="Saldo por tamanho SISBlink"
                width={1500}
                height={950}
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

      <section className="bg-[#eef5fb] px-6 py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
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
                src="/sisblink/pedidos.png"
                alt="Painel de pedidos SISBlink"
                width={1600}
                height={950}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#07111f] px-6 py-24 text-white lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="overflow-hidden bg-white">
              <Image
                src="/sisblink/dashboard.png"
                alt="Dashboard comercial SISBlink"
                width={1500}
                height={950}
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

      <section id="integracoes" className="bg-white px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
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
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {integrations.map((item) => (
                <div
                  key={item}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center font-black shadow-sm"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contato" className="bg-blue-500 px-6 py-24 text-white lg:px-8">
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

      <footer id="sobre" className="bg-[#07111f] px-6 py-10 text-slate-400 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
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