import Link from "next/link";

const paths = [
  { name: "Essencial", tag: "Para equipes enxutas", text: "Para quem vende, atende e confere os pedidos — muitas vezes com o próprio dono à frente.", topics: ["Apresentação da coleção em catálogo digital", "Pedidos por cliente, cor e tamanho", "Revisão e acompanhamento dos pedidos"], action: "Conversar sobre o Essencial", source: "modalidade-essencial", featured: true },
  { name: "Crescimento", tag: "Para organizar o time comercial", text: "Para marcas que precisam conectar representantes e acompanhar a operação com mais clareza.", topics: ["Organização da rotina de vendas", "Regras comerciais e contexto do cliente", "Indicadores para acompanhar a coleção"], action: "Conversar sobre Crescimento", source: "modalidade-crescimento", featured: false },
  { name: "Operação integrada", tag: "Para conectar processos e sistemas", text: "Para operações que precisam alinhar a venda aos dados e às particularidades do seu ERP.", topics: ["Mapeamento de cadastros e fluxos", "Integração conforme as interfaces disponíveis", "Validação do cenário antes da operação"], action: "Avaliar minha integração", source: "modalidade-integrada", featured: false },
];

export function CommercialPaths() {
  return (
    <section id="modalidades" aria-labelledby="commercial-title" className="scroll-mt-8 bg-[#07111f] px-6 py-16 text-white sm:py-24 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Do primeiro catálogo à operação integrada</p>
          <h2 id="commercial-title" className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">O próximo passo da sua marca não precisa ser maior que a sua necessidade.</h2>
          <p className="mt-6 text-lg leading-8 text-slate-300">Comece pelo que precisa organizar hoje. Estes caminhos ajudam a orientar a conversa; a proposta define os recursos e serviços contratados, sem presumir um pacote fechado.</p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {paths.map(path => (
            <article key={path.name} className={`flex h-full min-w-0 flex-col rounded-3xl border p-6 sm:p-8 ${path.featured ? "border-cyan-300/60 bg-gradient-to-b from-blue-900/70 to-slate-900 shadow-xl shadow-cyan-950/30" : "border-white/15 bg-white/5"}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">{path.tag}</p>
              <h3 className="mt-4 text-3xl font-black tracking-tight">{path.name}</h3>
              <p className="mt-4 leading-7 text-slate-300">{path.text}</p>
              <p className="mt-7 text-xs font-bold uppercase tracking-widest text-slate-400">Foco da conversa</p>
              <ul className="mb-8 mt-4 space-y-4">{path.topics.map(topic => <li key={topic} className="flex gap-3 text-sm leading-6"><span aria-hidden="true" className="text-emerald-300">✓</span><span>{topic}</span></li>)}</ul>
              <div className="mt-auto border-t border-white/15 pt-6">
                <p className="text-xl font-black">Valores sob consulta</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Recursos, acessos e serviços definidos na proposta.</p>
                <Link href={`/contato?origem=${path.source}&interesse=${path.featured ? "pequenas-marcas" : "avaliacao"}`} className={`mt-6 block rounded-full px-5 py-4 text-center text-sm font-black transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 ${path.featured ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300" : "border border-white/25 text-white hover:bg-white/10"}`}>{path.action} →</Link>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-white/15 p-6 sm:p-8">
          <h3 className="text-lg font-black text-sky-200">Uma proposta clara antes de contratar.</h3>
          <p className="mt-3 max-w-4xl leading-7 text-slate-300">Vamos discriminar recursos, quantidade de acessos, implantação, treinamento, suporte e integração quando necessária. Mensalidade e eventuais serviços adicionais devem estar identificados na proposta. Não há preço, prazo ou condição comercial presumidos nesta página.</p>
        </div>
      </div>
    </section>
  );
}

export function ImplementationJourney() {
  return (
    <section id="implantacao" aria-labelledby="implementation-title" className="scroll-mt-8 bg-[#eef5fb] px-6 py-16 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-16">
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Como começar</p><h2 id="implementation-title" className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Da sua rotina ao SISBlink, com etapas claras.</h2></div>
          <p className="self-end leading-8 text-slate-600">Traga um exemplo de pedido e conte como sua equipe vende. O escopo, os responsáveis e o cronograma são combinados antes da implantação — sem prometer uma integração que ainda não foi validada.</p>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[
          ["Demonstração", "Veja catálogo, grade e pedidos em uma situação próxima da sua rotina."],
          ["Escopo e proposta", "Definimos recursos, acessos, serviços e investimento para o cenário contratado."],
          ["Preparação dos dados", "Alinhamos produtos, imagens, clientes, preços e a forma de disponibilizar os dados."],
          ["Validação e treinamento", "Conferimos o fluxo combinado e orientamos os usuários antes do início."],
          ["Entrada em operação", "A operação começa conforme o planejamento e o suporte definido na proposta."],
        ].map(([title, text], index) => <li key={title} className="rounded-2xl border border-blue-100 bg-white p-6"><span aria-hidden="true" className="text-sm font-black text-blue-600">0{index + 1}</span><h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p></li>)}</ol>
        <Link href="/contato?origem=implantacao&interesse=avaliacao" className="mt-8 inline-flex rounded-full bg-blue-600 px-6 py-4 text-center font-black text-white hover:bg-blue-500">Quero planejar o início da minha marca →</Link>
      </div>
    </section>
  );
}
