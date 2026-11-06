import { DirectionalArrow } from "./components/directional-arrow";
import { HomeOpening } from "./components/home-opening";
import "./design-system/studio.css";
import "./components/solutions.css";
import "./components/home-redesign.css";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { SisblinkLiveHighlight } from "./components/sisblink-live-highlight";
import { SmallBrandsHighlight } from "./components/small-brands-highlight";
import { CommercialPaths, ImplementationJourney } from "./components/commercial-paths";
import { WebsiteDesignHighlight } from "./components/website-design-highlight";

export const metadata: Metadata = {
  title: "Sistema de Força de Vendas B2B para Moda",
  description: "Conheça o SISBlink, sistema B2B de catálogo e pedidos para moda, e a criação de sites com IA da SYSNEY, com entrega em até 3 dias úteis para projetos elegíveis.",
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
  { value: "R$ 854 mi", label: "em vendas", detail: "movimentadas", icon: "↗︎" },
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
    <main id="inicio" className="home-redesign min-h-screen pb-32 md:pb-0">
      <HomeOpening metrics={metrics} />

      <WebsiteDesignHighlight />
      <SmallBrandsHighlight />

      <section id="resultados" aria-label="Resultados e marcas" className="relative border-y border-slate-200 bg-slate-50 px-6 py-12 sm:py-16 lg:px-8">
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

      <section className="relative overflow-hidden bg-[#07111f] px-6 py-16 text-white sm:py-24 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,#2563eb33,transparent_28%),radial-gradient(circle_at_85%_75%,#10b98126,transparent_30%)]" />
        <div className="relative mx-auto max-w-[1600px]">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-sky-300">
              Produto bom precisa de força comercial
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
              As melhores coleções não vendem sozinhas.
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              Roupas desejadas, mostruários impecáveis e estoque disponível são
              o ponto de partida. Sem uma operação que transforme tudo isso em
              ritmo, informação e ação comercial, oportunidades esfriam e
              vendas ficam pelo caminho.
            </p>
          </div>

          <div className="mt-10 grid items-stretch gap-5 lg:mt-14 lg:grid-cols-[1fr_auto_1fr]">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ["01", "Coleção forte", "Produtos com desejo e potencial de mercado."],
                ["02", "Mostruário de alto nível", "Uma apresentação que valoriza cada detalhe."],
                ["03", "Estoque disponível", "Capacidade real para atender a demanda."],
              ].map(([number, title, text]) => (
                <article
                  key={title}
                  className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur sm:p-6"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sm font-black text-sky-300">
                      {number}
                    </span>
                    <div>
                      <h3 className="text-lg font-black">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="flex items-center justify-center" aria-hidden="true">
              <span className="flex h-14 w-14 rotate-90 items-center justify-center rounded-full border border-sky-300/30 bg-sky-300/10 text-2xl font-black text-sky-300 lg:rotate-0">
                →
              </span>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-emerald-300/25 bg-gradient-to-br from-blue-600/25 via-sky-500/10 to-emerald-400/15 p-7 shadow-2xl shadow-blue-950/40 sm:p-9">
              <div className="absolute right-0 top-0 h-40 w-40 translate-x-12 -translate-y-12 rounded-full bg-sky-400/20 blur-3xl" />
              <div className="relative">
                <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-emerald-200">
                  Com SISBlink
                </span>
                <h3 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">
                  Potencial comercial em movimento.
                </h3>
                <p className="mt-5 leading-7 text-slate-300">
                  O SISBlink conecta produto, disponibilidade, cliente e estratégia
                  em uma jornada de venda mais rápida, visual e orientada por dados.
                </p>

                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-[#07111f]/55 p-5">
                    <p className="font-black text-sky-300">Para o representante</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Mais agilidade para apresentar, argumentar, montar pedidos e
                      acompanhar cada cliente, sem planilhas ou retrabalho.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#07111f]/55 p-5">
                    <p className="font-black text-emerald-300">Para a marca</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Mais padrão na execução, visibilidade da campanha e ação para
                      transformar estoque disponível em pedidos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-9 flex flex-col items-center justify-between gap-6 rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-center sm:p-8 lg:flex-row lg:text-left">
            <p className="max-w-3xl text-xl font-black leading-8 sm:text-2xl">
              O SISBlink não substitui o talento do representante nem a força da marca.
              <span className="text-sky-300"> Ele potencializa os dois.</span>
            </p>
            <Link
              href="/contato"
              className="shrink-0 rounded-full bg-blue-500 px-7 py-4 font-black text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
            >
              Ver o SISBlink em ação ↗︎
            </Link>
          </div>
        </div>
      </section>

      <section id="solucoes-por-desafio" className="bg-white px-6 py-14 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-blue-700">Soluções por desafio</p>
          <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-5xl">Tecnologia comercial para vender coleções a franquias, multimarcas e outros clientes B2B.</h2>
          <div className="-mx-6 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:mt-10 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4">
            {[
              ["Sistema de força de vendas", "Organize representantes, clientes, catálogo e pedidos em uma jornada conectada.", "/sistema-forca-de-vendas"],
              ["Plataforma de vendas B2B", "Transforme a coleção em um showroom digital preparado para o atacado.", "/plataforma-vendas-b2b"],
              ["Franquias e multimarcas", "Atenda diferentes lojas e grupos preservando o contexto de cada pedido.", "/vendas-para-franquias-e-multimarcas"],
              ["Integrações ERP", "Conecte produtos, clientes, preços, estoque e pedidos ao ecossistema da empresa.", "/integracoes-erp"],
            ].map(([title, text, href]) => <Link key={href} href={href} className="solution-link-row"><h3 className="text-xl font-black text-blue-800">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p><span className="mt-5 inline-block font-black text-blue-600 group-hover:text-blue-500">Saiba mais →</span></Link>)}
          </div>
        </div>
      </section>

      <section className="bg-[#07111f] px-6 py-16 text-white sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-sky-300">Soluções para o dia a dia da moda</p>
          <h2 className="mt-4 max-w-4xl text-3xl font-black tracking-tight md:text-5xl">Da grade da confecção ao mix da multimarcas.</h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">Pedidos com cor e tamanho, coleção em pré-venda, pronta entrega e reposição: conheça como o SISBlink apoia cada etapa comercial e avalie o custo-benefício para sua operação.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {[
              ["Sistema de pedidos para confecção e moda atacado", "Catálogo digital para representantes, pedidos por grade, cor e tamanho, pré-venda de coleção e pronta entrega. Usa Linx Millennium? Avaliamos a integração ao seu ERP.", "/sistema-pedidos-confeccao-moda"],
              ["Compras e reposição para lojas multimarcas", "Estoque parado e falta de tamanhos pedem uma compra mais criteriosa. Veja como organizar o mix e os pedidos B2B com apoio dos dados da sua operação.", "/compras-reposicao-multimarcas"],
            ].map(([title, text, href]) => <Link key={href} href={href} className="group rounded-3xl border border-white/15 bg-white/5 p-7 transition hover:border-sky-400 hover:bg-white/10"><h3 className="text-2xl font-black text-sky-200">{title}</h3><p className="mt-4 leading-7 text-slate-300">{text}</p><span className="mt-6 inline-block font-black text-emerald-300">Conhecer a solução →</span></Link>)}
          </div>
          <p className="mt-8 max-w-3xl leading-7 text-slate-300">Qualidade se avalia na prática. Compare catálogo, pedidos, integração, implantação e suporte no mesmo escopo. <Link href="/contato" className="font-bold text-emerald-300 underline underline-offset-4">Solicite uma demonstração e uma proposta da SYSNEY.</Link></p>
        </div>
      </section>

      <SisblinkLiveHighlight />

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
                  {index === 0 ? "▣" : index === 1 ? "▤" : "↗︎"}
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

      <section id="desafios" className="overflow-hidden bg-[#07111f] px-6 py-16 text-white sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="max-w-4xl"><p className="text-sm font-black uppercase tracking-[0.35em] text-sky-300">Problemas que custam vendas</p><h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Quando a operação depende de e-mails, planilhas e informações dispersas, o time perde velocidade.</h2><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">O SISBlink foi evoluído a partir da rotina comercial para eliminar atritos que aparecem antes, durante e depois do atendimento.</p></div>
          <div className="-mx-6 mt-9 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:mt-12 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0">
            {painPoints.map((pain, index) => <article key={pain.title} className="pain-row" data-reveal><span className="row-index">0{index + 1}</span><h3>{pain.title}</h3><div><p>{pain.text}</p><p className="pain-result"><span aria-hidden="true"><DirectionalArrow /></span> {pain.result}</p></div></article>)}
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

          <div className="screen-showcase">
            <div className="overflow-hidden bg-white">
              <Image
                src="/sisblink/telas/catalogo-detalhado.png"
                unoptimized
                alt="Catálogo SISBlink"
                width={1784}
                height={937}
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

          <div className="screen-showcase">
            <div className="overflow-hidden bg-white">
              <Image
                src="/sisblink/telas/catalogo-detalhado.png"
                unoptimized
                alt="Catálogo visual SISBlink com produtos e detalhes da blusa terracota"
                width={1784}
                height={937}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="hidden bg-[#07111f] px-6 py-16 text-white sm:py-24 md:block lg:px-8">
        <div className="mx-auto grid max-w-[1600px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="screen-showcase">
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

          <div className="screen-showcase">
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
          <div className="screen-showcase">
            <div className="overflow-hidden bg-white">
              <Image
                src="/sisblink/telas/dashboard.webp"
                alt="Dashboard comercial SISBlink"
                width={1920}
                height={1080}
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

      <CommercialPaths />
      <ImplementationJourney />

      <section id="seguranca" className="scroll-mt-8 bg-[#eef5fb] px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-[1600px] items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div><p className="text-sm font-black uppercase tracking-[0.35em] text-blue-700">Segurança por arquitetura</p><h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Informações comerciais protegidas em todas as etapas.</h2><p className="mt-6 text-lg leading-8 text-slate-700">Segurança não é apenas um selo visual. O SISBlink valida identidade, empresa, marca, coleção e permissões no servidor antes de liberar dados ou executar ações.</p><Link href="/contato" className="mt-7 inline-flex font-black text-blue-700 hover:text-blue-500">Converse sobre os requisitos da sua operação →</Link></div>
          <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [&>article]:min-w-[78vw] [&>article]:snap-center sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 sm:[&>article]:min-w-0">
            {[["Acesso controlado", "Perfis, permissões e escopo comercial por usuário."], ["Regras no servidor", "Preços, estoque e validações sensíveis não dependem do navegador."], ["Infraestrutura Azure", "Aplicação publicada com HTTPS e serviços gerenciados na nuvem Microsoft."], ["Contato protegido", "Formulário com Cloudflare Turnstile, validação e proteção contra automações."], ["Segredos protegidos", "Chaves e credenciais permanecem no ambiente seguro do servidor."], ["Rastreabilidade", "Operações críticas possuem validações e registros para apoio à gestão."]].map(([title, text]) => <article key={title} className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-black text-emerald-700">✓</div><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-2 leading-7 text-slate-600">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section id="depoimentos" className="bg-white px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-[1600px]"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-black uppercase tracking-[0.35em] text-blue-700">Quem usa, recomenda</p><h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">A experiência de quem vende todos os dias com o SISBlink.</h2></div>
          <div className="-mx-6 mt-9 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:mt-12 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3">{testimonials.map((item) => <figure key={`${item.name}-${item.company}`} className="flex min-h-60 min-w-[82vw] snap-center flex-col rounded-3xl border border-slate-200 bg-slate-50 p-7 shadow-sm md:min-h-64 md:min-w-0"><div className="text-4xl font-black leading-none text-blue-300">“</div><blockquote className="mt-4 flex-1 text-lg font-bold leading-8 text-slate-800">{item.quote}</blockquote><figcaption className="mt-6 border-t border-slate-200 pt-5"><p className="font-black text-blue-800">{item.name}</p><p className="text-sm text-slate-500">{item.company}</p></figcaption></figure>)}</div>
          <p className="mt-6 text-center text-sm text-slate-500">Depoimentos espontâneos de usuários, reproduzidos com pequenos ajustes de pontuação e clareza.</p>
        </div>
      </section>

      <section id="contato" className="closing-scene" aria-labelledby="closing-title">
        <div className="closing-horizon" aria-hidden="true" />
        <div className="closing-intro"><span className="closing-dot" /> O PRÓXIMO CAPÍTULO É SEU.</div>
        <div className="closing-composition">
          <h2 id="closing-title">Sua empresa.<br />Um novo<br /><em>horizonte.</em></h2>
          <div className="closing-emblem" aria-hidden="true"><span /><Image src="/sysney-cisne-3d.png" alt="" width={440} height={440} sizes="(max-width: 700px) 220px, 440px" /></div>
        </div>
        <div className="closing-bottom">
          <p>Da coleção ao pedido. Da ideia ao site no ar.<br />Tecnologia com a sua identidade — e a SYSNEY ao seu lado.</p>
          <div className="closing-paths">
            <Link href="/contato?origem=home-encerramento-b2b"><span><small>QUERO VENDER MAIS</small><strong>Conhecer o SISBlink</strong></span><span className="closing-arrow" aria-hidden="true"><DirectionalArrow /></span></Link>
            <Link href="/contato?interesse=criacao-de-sites&origem=home-encerramento-sites"><span><small>QUERO MINHA MARCA NO AR</small><strong>Criar meu site</strong></span><span className="closing-arrow" aria-hidden="true"><DirectionalArrow /></span></Link>
          </div>
        </div>
      </section>

      <div className="home-mobile-action fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-2xl border border-emerald-300/25 bg-[#07111f]/95 p-2.5 shadow-2xl shadow-black/40 backdrop-blur-xl md:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2 text-xs font-bold text-emerald-100"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-300">✓</span><span className="truncate">Ambiente seguro</span></div>
        <Link href="/contato" className="shrink-0 rounded-xl bg-blue-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/30">Demonstração grátis</Link>
      </div>

      <footer id="sobre" className="closing-footer">
        <div><Image src="/sysney-logo.svg" alt="SYSNEY Informática" width={90} height={90} /><p>Tecnologia para o seu<br /><strong>próximo movimento.</strong></p></div>
        <nav aria-label="Links do rodapé"><Link href="/sistema-vendas-pequenas-marcas">SISBlink para pequenas marcas <DirectionalArrow /></Link><Link href="/contato">Falar com a SYSNEY <DirectionalArrow /></Link><a href="#inicio">Voltar ao início ↑</a></nav>
        <small>© {new Date().getFullYear()} SYSNEY. Todos os direitos reservados.</small>
      </footer>
    </main>
  );
}
