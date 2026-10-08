import Link from "next/link";

export function IntegrationGuide() {
  return <section className="bg-slate-50 px-6 py-16 lg:px-8"><div className="mx-auto max-w-7xl">
    <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">Escopo da integração</p>
    <h2 className="mt-4 text-3xl font-black md:text-4xl">O que conferir antes de conectar seu ERP.</h2>
    <p className="mt-5 max-w-3xl leading-8 text-slate-600">O nome do sistema é o começo da conversa. Versão, interfaces disponíveis e regras comerciais determinam quais informações podem ser trocadas e como o fluxo será acompanhado.</p>
    <div className="mt-8 grid gap-5 md:grid-cols-2">{[
      ["Dados de entrada", "Definir produtos, variações, imagens, clientes, tabelas e saldo comercial necessários ao catálogo e ao pedido."],
      ["Dados de saída", "Definir como pedidos e respectivos status serão enviados ou recebidos, evitando duplicidade e redigitação."],
      ["Frequência e indisponibilidade", "Acordar atualização em tempo real ou programada, tratamento de falhas e como identificar informações desatualizadas."],
      ["Homologação", "Conferir cenários reais de preços, grades, clientes e pedidos antes da entrada em produção. Exceções precisam fazer parte do escopo."],
    ].map(([title, text]) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-xl font-black text-blue-800">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div>
    <div className="mt-8 rounded-2xl bg-blue-50 p-6"><h3 className="text-xl font-black text-blue-900">Sua empresa utiliza Linx Millennium?</h3><p className="mt-3 leading-7 text-slate-700">Informe a versão, os fluxos desejados e o responsável pelo ERP. A SYSNEY avalia os meios de conexão antes de confirmar compatibilidade, prazo e investimento. Sistemas da mesma família podem ter interfaces diferentes.</p></div>
    <Link href="/contato?origem=integracao-avaliacao&interesse=avaliacao" className="mt-7 inline-flex rounded-full bg-blue-600 px-7 py-4 font-black text-white hover:bg-blue-500">Avaliar a integração com meu ERP →</Link>
  </div></section>;
}
