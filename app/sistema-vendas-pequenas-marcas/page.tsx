import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CommercialPaths, ImplementationJourney } from "../components/commercial-paths";

const route = "/sistema-vendas-pequenas-marcas";
const contact = "/contato?origem=pequenas-marcas&interesse=pequenas-marcas";
const title = "Sistema de vendas para pequenas marcas de moda";
const description = "Catálogo digital e pedidos por grade para pequenas marcas de moda. Conheça os caminhos de contratação do SISBlink, implantação e investimento sob consulta.";
export const metadata: Metadata = {
  title, description, alternates: { canonical: route },
  openGraph: { title, description, url: route, type: "website", locale: "pt_BR", siteName: "SISBlink", images: [{ url: "/sisblink/telas/catalogo.webp", width: 1920, height: 1080, alt: "Catálogo e pedido por grade no SISBlink" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/sisblink/telas/catalogo.webp"] },
};

const dailyWork = [
  {
    situation: "A venda começa no WhatsApp e termina na planilha.",
    text: "As conversas continuam importantes. O catálogo e os pedidos do SISBlink ajudam a organizar produtos e quantidades sem depender só do histórico de mensagens.",
    resource: "Catálogo e pedido no mesmo fluxo",
  },
  {
    situation: "Uma pessoa vende, confere e resolve as dúvidas depois.",
    text: "Confira cor, tamanho, quantidade e prazo no contexto do produto. Uma revisão clara ajuda a identificar divergências antes de finalizar o pedido.",
    resource: "Grade e revisão comercial",
  },
  {
    situation: "No fim do dia, é preciso juntar tudo para saber como foram as vendas.",
    text: "Consulte os pedidos e os indicadores do contexto comercial configurado para a marca. Use essas informações para preparar o próximo atendimento.",
    resource: "Pedidos e acompanhamento comercial",
  },
];

const questions = [
  ["O que está incluído na contratação?", "A proposta identifica os recursos, a quantidade de acessos e os serviços contratados. Os caminhos Essencial, Crescimento e Operação integrada orientam a conversa, mas não são pacotes com condições presumidas. Implantação, treinamento, suporte e integração devem ter seu escopo e seus valores discriminados."],
  ["Quanto tempo leva para começar?", "O cronograma é definido após conhecer os dados, as regras e as integrações necessárias. Antes da entrada em operação, alinhamos preparação dos cadastros, validação do fluxo e orientação dos usuários. Não há prazo único anunciado para todos os cenários."],
  ["O SISBlink é só para grandes empresas?", "Não. O catálogo, os pedidos e o acompanhamento comercial também podem apoiar pequenas marcas. O tamanho da equipe é uma parte da avaliação: a SYSNEY considera seus produtos, sua forma de vender e os dados necessários para confirmar a adequação da plataforma."],
  ["Faz sentido quando o próprio dono também vende?", "Sim, esse cenário pode ser avaliado. A mesma pessoa pode precisar apresentar a coleção, registrar quantidades e conferir pedidos. Na demonstração, mostre essa rotina para validar como os recursos e os acessos serão organizados."],
  ["Como avaliar se o investimento vale a pena?", "Considere o tempo gasto redigitando e conferindo pedidos, os erros que exigem correção e a dificuldade de acompanhar as vendas. Depois, compare esses pontos com os recursos demonstrados e com o custo total da proposta, incluindo implantação, integração quando necessária e suporte."],
  ["Minha marca precisa ter um ERP para conversar com a SYSNEY?", "Não precisa ter um ERP para iniciar a avaliação. Conte se você usa um sistema, planilhas ou outro processo. A viabilidade e a forma de disponibilizar produtos, clientes, preços e pedidos serão definidas com a SYSNEY antes da contratação."],
  ["Como saber o preço para minha marca?", "Os valores são sob consulta. O investimento considera o escopo, a quantidade de acessos, os serviços de implantação e a integração quando necessária. Solicite uma proposta que separe mensalidade e eventuais serviços adicionais, sem presumir preço ou condição comercial."],
];

export default function SmallBrandsPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="relative overflow-hidden bg-[#07111f] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,#155e7566,transparent_60%)]" />
        <div className="relative mx-auto max-w-[1600px] px-6 lg:px-10 xl:px-12">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 py-6">
            <Link href="/" aria-label="SYSNEY — página inicial" className="rounded-lg focus-visible:outline-2 focus-visible:outline-sky-300"><Image src="/logo.png" alt="SYSNEY Informática" width={150} height={150} sizes="112px" className="h-auto w-24 sm:w-28" /></Link>
            <nav aria-label="Navegação para pequenas marcas" className="flex flex-wrap items-center gap-4 text-sm font-bold sm:gap-6">
              <Link href="/sisblink-em-acao" className="text-slate-300 hover:text-sky-300">Ver as telas</Link>
              <Link href="#modalidades" className="text-slate-300 hover:text-sky-300">Modalidades</Link>
              <Link href="#implantacao" className="text-slate-300 hover:text-sky-300">Como começar</Link>
              <Link href="/links" className="text-slate-300 hover:text-sky-300">Todas as soluções</Link>
              <Link href={contact} className="rounded-full bg-blue-500 px-5 py-3 hover:bg-blue-400">Conversar com a SYSNEY</Link>
            </nav>
          </header>
          <div className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:py-20">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">SISBlink para pequenas marcas de moda</p>
              <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">Equipe enxuta.<br /><span className="text-sky-300">Venda organizada.</span></h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Você não precisa ter um grande time para organizar suas vendas. Apresente a coleção, monte pedidos por cor e tamanho e acompanhe o atendimento em um mesmo fluxo com o SISBlink.</p>
              <p className="mt-5 max-w-xl leading-7 text-slate-300">Para quem acumula funções, clareza faz diferença. Conheça os recursos na demonstração e receba uma proposta para a sua operação, com valores sob consulta.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href={contact} className="rounded-full bg-emerald-400 px-6 py-4 text-center font-black text-slate-950 transition hover:bg-emerald-300">Solicitar proposta para minha marca</Link>
                <Link href="#rotina" className="rounded-full border border-white/30 px-6 py-4 text-center font-bold transition hover:bg-white/10">Veja como funciona ↓</Link>
              </div>
            </div>
            <figure className="rounded-2xl border border-white/15 bg-white/5 p-3 shadow-2xl shadow-black/25">
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3 text-xs font-bold text-sky-200"><span>Apresente. Registre. Confira.</span><span className="rounded-full border border-white/15 px-3 py-1 text-emerald-200">SISBlink Web</span></div>
              <Image src="/sisblink/telas/catalogo.webp" alt="Tela real do SISBlink com catálogo visual, produto selecionado e pedido por grade de tamanhos" width={1920} height={1080} preload sizes="(min-width: 1600px) 780px, (min-width: 1024px) 52vw, 100vw" className="h-auto w-full rounded-lg object-contain" />
              <figcaption className="px-2 pt-3 text-xs leading-6 text-slate-400">Tela real do ambiente de demonstração DRSOFT. Os valores exibidos pertencem ao pedido de demonstração, não ao preço do sistema.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section id="rotina" aria-labelledby="routine-title" className="scroll-mt-8 bg-[#eef5fb] px-6 py-16 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Reconhece essa rotina?</p>
          <h2 id="routine-title" className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">Quando poucas pessoas fazem tudo, cada retrabalho pesa.</h2>
          <p className="mt-5 max-w-3xl leading-8 text-slate-600">Não é só sobre o volume de vendas. É sobre o trabalho de apresentar produtos, anotar escolhas e conferir o que foi combinado com cada cliente.</p>
          <div className="mt-9 grid gap-5 lg:grid-cols-3">{dailyWork.map(item => (
            <article key={item.situation} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 sm:p-7">
              <h3 className="text-xl font-black leading-snug text-slate-900">{item.situation}</h3>
              <p className="mb-6 mt-4 leading-7 text-slate-600">{item.text}</p>
              <p className="mt-auto border-t border-slate-100 pt-5 text-sm font-bold text-blue-700">No SISBlink: {item.resource}</p>
            </article>
          ))}</div>
        </div>
      </section>

      <section aria-labelledby="flow-title" className="px-6 py-16 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Do atendimento à conferência</p>
          <h2 id="flow-title" className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Uma rotina que você pode experimentar na demonstração.</h2>
          <div className="mt-9 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <figure className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-lg shadow-slate-200/60">
              <Image src="/sisblink/telas/grade.webp" alt="Montagem do pedido com fotos, saldo por tamanho e quantidades no SISBlink" width={1920} height={1080} sizes="(min-width: 1024px) 52vw, 100vw" className="h-auto w-full rounded-lg object-contain" />
              <figcaption className="px-2 pt-3 text-xs leading-6 text-slate-500">Produto e grade no ambiente de demonstração. Cadastros, dados e regras são definidos para a operação.</figcaption>
            </figure>
            <ol className="space-y-5">{[
              ["Apresente a coleção", "Use o catálogo digital para mostrar produtos e consultar as informações comerciais disponíveis."],
              ["Monte o pedido por cliente", "Confira as variações, as quantidades e os prazos que fazem parte da negociação."],
              ["Revise antes de finalizar", "Passe pelos itens e pelas condições do pedido para identificar dúvidas enquanto o atendimento ainda está em contexto."],
              ["Acompanhe os pedidos", "Consulte status e indicadores para ter uma leitura do que foi registrado e preparar suas próximas ações comerciais."],
            ].map(([heading, text], index) => <li key={heading} className="flex gap-4"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-black text-blue-700">{index + 1}</span><div><h3 className="font-black">{heading}</h3><p className="mt-1 leading-7 text-slate-600">{text}</p></div></li>)}</ol>
          </div>
          <Link href="/sisblink-em-acao" className="mt-8 inline-flex font-black text-blue-700 underline underline-offset-4 hover:text-blue-500">Explore também o dashboard, o chat e o pedido espelhado →</Link>
        </div>
      </section>

      <CommercialPaths />
      <ImplementationJourney />

      <section aria-labelledby="value-title" className="bg-[#07111f] px-6 py-16 text-white sm:py-20 lg:px-10">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Custo-benefício para sua realidade</p>
          <h2 id="value-title" className="mt-4 max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">O tempo de uma equipe pequena também precisa entrar na conta.</h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">Refazer uma grade, procurar uma informação no WhatsApp ou redigitar um pedido ocupa quem também precisa atender e vender. Organizar esse fluxo pode ajudar a reduzir retrabalho e facilitar a conferência — esse é um benefício que vale avaliar na prática.</p>
          <div className="mt-9 grid gap-5 md:grid-cols-3">{[
            ["Onde você perde tempo?", "Identifique o que precisa copiar, procurar ou conferir de novo a cada venda."],
            ["O que o sistema resolve?", "Teste uma situação parecida com a sua e confira quais tarefas os recursos demonstrados podem organizar."],
            ["Qual é o investimento completo?", "Compare a proposta considerando recursos, acessos, implantação, integração quando necessária e suporte."],
          ].map(([heading, text]) => <article key={heading} className="rounded-2xl border border-white/15 bg-white/5 p-6"><h3 className="text-lg font-black text-sky-200">{heading}</h3><p className="mt-3 leading-7 text-slate-300">{text}</p></article>)}</div>
          <p className="mt-7 max-w-3xl text-sm leading-7 text-slate-400">Avalie o custo-benefício com base na sua rotina e no escopo da proposta. A demonstração ajuda a comparar o trabalho de hoje com o funcionamento dos recursos que serão entregues.</p>
          <Link href={contact} className="mt-7 inline-flex rounded-full bg-emerald-400 px-6 py-4 text-center font-black text-slate-950 hover:bg-emerald-300">Conversar sobre adequação e investimento →</Link>
        </div>
      </section>

      <section aria-labelledby="growth-title" className="px-6 py-16 sm:py-20 lg:px-10">
        <div className="mx-auto grid max-w-[1600px] gap-10 lg:grid-cols-2 lg:gap-16">
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Seu momento e seus próximos passos</p><h2 id="growth-title" className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">Organize a marca de hoje. Planeje o que vem depois.</h2><p className="mt-6 leading-8 text-slate-600">Comece a conversa pelo processo que você já tem: quem atende, como a coleção é apresentada e onde os pedidos são registrados. Se a equipe, os canais ou a integração mudarem, os próximos requisitos podem ser avaliados com a SYSNEY.</p><p className="mt-4 leading-8 text-slate-600">O SISBlink atende diferentes contextos comerciais. A proposta para uma equipe enxuta deve considerar o que ela precisa fazer agora e o que merece ser planejado para o futuro.</p><Link href="/sistema-pedidos-confeccao-moda" className="mt-6 inline-flex font-bold text-blue-700 underline underline-offset-4">Entenda os pedidos para confecção e moda →</Link></div>
          <div className="rounded-3xl border border-blue-100 bg-[#eef5fb] p-6 sm:p-8"><h3 className="text-xl font-black text-blue-900">Traga sua rotina para a demonstração.</h3><ul className="mt-6 space-y-4 leading-7 text-slate-700">{["Quem vende hoje: você, uma equipe interna ou representantes?", "Como apresenta a coleção e registra os pedidos?", "O que exige conferência manual ou costuma gerar dúvida?", "Quais sistemas ou planilhas já fazem parte da operação?"].map(item => <li key={item} className="flex gap-3"><span aria-hidden="true" className="font-black text-emerald-700">✓</span><span>{item}</span></li>)}</ul><p className="mt-6 border-t border-blue-100 pt-5 text-sm leading-7 text-slate-600">A partir disso, avaliamos recursos, dados necessários, implantação e investimento. Você não precisa ter todas as respostas para iniciar a conversa.</p></div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="bg-slate-50 px-6 py-16 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-4xl"><p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Antes de decidir</p><h2 id="faq-title" className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Dúvidas de quem tem uma pequena marca.</h2><div className="mt-8 space-y-3">{questions.map(([question, answer]) => <details key={question} className="rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-black leading-7 text-slate-900">{question}</summary><p className="mt-3 leading-8 text-slate-600">{answer}</p></details>)}</div></div>
      </section>

      <section className="bg-blue-600 px-6 py-16 text-center text-white sm:py-20">
        <h2 className="mx-auto max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">Sua próxima conversa pode começar com a rotina que você tem hoje.</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-blue-100">Mostre como sua marca vende. Vamos avaliar juntos se o SISBlink faz sentido para sua equipe e para o investimento que você está planejando.</p>
        <Link href={contact} className="mt-8 inline-flex rounded-full bg-white px-7 py-4 font-black text-blue-700 hover:bg-slate-100">Solicitar uma demonstração para minha marca</Link>
      </section>
      <footer className="bg-[#07111f] px-6 py-8 text-sm text-slate-400"><div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-5"><p><span className="font-black text-white">SYSNEY Informática</span><span className="mt-1 block">SISBlink · Tecnologia comercial para moda.</span></p><nav aria-label="Outros caminhos" className="flex flex-wrap gap-5"><Link href="/" className="hover:text-white">Site completo</Link><Link href="/links" className="hover:text-white">Todas as soluções</Link><Link href="/integracoes-erp" className="hover:text-white">Integrações ERP</Link></nav></div></footer>
    </main>
  );
}
