import Image from "next/image";
import Link from "next/link";

export function ModaPedidoGuide() {
  return <section className="bg-slate-50 px-6 py-16 sm:py-24 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">Do catálogo à confirmação</p>
      <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Como organizar um pedido de moda por grade.</h2>
      <p className="mt-5 max-w-3xl leading-8 text-slate-600">Comece pelo cliente e pela coleção. Confira a tabela disponível, escolha os produtos e revise as quantidades por variação antes de confirmar o pedido.</p>
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-2">
        <figure className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><Image src="/sisblink/catalogo-pedido.webp" alt="Tela do SISBlink com catálogo e montagem de pedido de coleção" width={1916} height={1073} sizes="(min-width: 1024px) 50vw, 100vw" className="h-auto w-full rounded-lg object-contain" /><figcaption className="px-2 py-4 text-sm leading-6 text-slate-600">Catálogo e pedido no SISBlink. Produtos e condições exibidos dependem da configuração da marca.</figcaption></figure>
        <div className="space-y-4">{[
          ["1. Cliente e tabela", "Selecione o cliente autorizado e confira suas condições comerciais antes de montar o pedido."],
          ["2. Produto, cor e tamanho", "Apresente o produto no catálogo e distribua as quantidades entre as variações cadastradas."],
          ["3. Revisão da grade", "Confira se as cores e os tamanhos escolhidos correspondem ao que foi negociado com o comprador."],
          ["4. Confirmação e envio", "Revise o pedido consolidado e siga o fluxo de confirmação e integração definido para a operação."],
        ].map(([title, text]) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black text-blue-800">{title}</h3><p className="mt-2 leading-7 text-slate-600">{text}</p></article>)}</div>
      </div>
      <div className="mt-10 rounded-2xl border border-blue-200 bg-blue-50 p-6"><h3 className="text-xl font-black text-blue-900">Exemplo ilustrativo de conferência</h3><p className="mt-3 leading-7 text-slate-700">Uma camiseta em azul: 2 unidades P, 4 M e 2 G. Em preto: 1 P, 2 M e 1 G. O total é de 12 peças. Conferir apenas o total não basta: o comprador precisa validar a distribuição por cor e tamanho. Este exemplo explica a revisão; não representa um pedido real.</p></div>
      <h2 className="mt-16 text-3xl font-black tracking-tight">Pré-venda e pronta entrega: o que muda no pedido?</h2>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[560px] text-left text-sm"><caption className="sr-only">Diferenças comerciais entre pré-venda de coleção e pronta entrega</caption><thead className="bg-blue-900 text-white"><tr><th scope="col" className="p-5">Conferência</th><th scope="col" className="p-5">Pré-venda de coleção</th><th scope="col" className="p-5">Pronta entrega</th></tr></thead><tbody>{[
        ["Objetivo", "Negociar a coleção com entrega futura.", "Vender itens com disponibilidade para atendimento."],
        ["Disponibilidade", "Validar as regras de venda da coleção e os limites definidos pela marca.", "Conferir o saldo comercial e a atualização recebida da fonte de estoque."],
        ["Prazo", "Conferir a janela de entrega acordada.", "Confirmar separação, faturamento e entrega com a operação."],
        ["Antes de confirmar", "Revisar mix, grades, preços e condições da coleção.", "Revisar variações, quantidades, preços e disponibilidade."],
      ].map(([label, pre, pronta]) => <tr key={label} className="border-t border-slate-200"><th scope="row" className="p-5 font-bold">{label}</th><td className="p-5 leading-6 text-slate-600">{pre}</td><td className="p-5 leading-6 text-slate-600">{pronta}</td></tr>)}</tbody></table></div>
      <p className="mt-5 leading-7 text-slate-600">As regras de prazo, limite de venda e sincronização são avaliadas na implantação. A demonstração deve reproduzir o cenário que sua empresa precisa atender.</p>
      <Link href="/contato?origem=pedido-moda-avaliacao&interesse=avaliacao" className="mt-7 inline-flex rounded-full bg-blue-600 px-7 py-4 font-black text-white hover:bg-blue-500">Avaliar meu fluxo de pedidos →</Link>
    </div>
  </section>;
}
