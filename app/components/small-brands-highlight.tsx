import Link from "next/link";

export function SmallBrandsHighlight() {
  return (
    <section id="pequenas-marcas" aria-labelledby="small-brands-title" className="scroll-mt-8 border-b border-slate-200 bg-[#eef5fb] px-6 py-16 sm:py-20 lg:px-10">
      <div className="mx-auto grid max-w-[1600px] items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Pequenas marcas · Equipes enxutas</p>
          <h2 id="small-brands-title" className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">Sua marca não precisa ser grande para vender de forma organizada.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Se o próprio dono atende clientes ou poucas pessoas cuidam das vendas, cada conferência e cada redigitação pesam na rotina. O SISBlink também pode apoiar essa operação com catálogo digital, pedidos e acompanhamento comercial.</p>
          <Link href="/sistema-vendas-pequenas-marcas" className="mt-8 inline-flex items-center rounded-full bg-blue-600 px-6 py-4 text-center font-black text-white transition hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">Conheça o SISBlink para pequenas marcas →</Link>
        </div>
        <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-lg shadow-blue-950/5 sm:p-8">
          <p className="text-sm font-black text-blue-800">Mais organização para quem acumula funções.</p>
          <ul className="mt-6 space-y-5">{[
            ["Apresente a coleção", "Catálogo visual para consultar produtos, cores e tamanhos durante a venda."],
            ["Registre e confira o pedido", "Quantidades e condições no contexto do cliente, com revisão antes de finalizar."],
            ["Acompanhe o que foi vendido", "Pedidos e indicadores comerciais para orientar o próximo atendimento."],
          ].map(([title, text], index) => <li key={title} className="flex gap-4"><span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-black text-emerald-700">0{index + 1}</span><div><h3 className="font-black text-slate-900">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div></li>)}</ul>
          <p className="mt-7 border-t border-slate-100 pt-5 text-sm leading-6 text-slate-500">A adequação dos recursos e o investimento são avaliados com a SYSNEY, conforme a rotina da sua marca.</p>
        </div>
      </div>
    </section>
  );
}
