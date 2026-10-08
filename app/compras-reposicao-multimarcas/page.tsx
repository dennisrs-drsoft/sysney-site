import type { Metadata } from "next";
import { CommercialPage, type CommercialPageData } from "../components/commercial-page";

const title = "Compras e reposição para lojas multimarcas de moda";
const description = "Estoque parado, falta de tamanhos e compras de coleção: veja como organizar o mix e os pedidos B2B da sua multimarcas com o SISBlink e os dados do ERP.";
export const metadata: Metadata = {
  title, description, alternates: { canonical: "/compras-reposicao-multimarcas" },
  openGraph: { title, description, url: "/compras-reposicao-multimarcas", type: "website", locale: "pt_BR", siteName: "SISBlink" },
  twitter: { card: "summary_large_image", title, description },
};
const data: CommercialPageData = {
  eyebrow: "Lojas multimarcas · Compradores · Redes",
  title: "Sua próxima compra precisa fazer sentido para o mix da loja.",
  lead: "Estoque parado de um lado, falta de cores e tamanhos do outro. Para uma loja multimarcas de moda, planejar compras e reposição exige enxergar o que já existe e conferir o que será pedido. O SISBlink apoia a organização do mix e dos pedidos B2B, em conjunto com os dados e processos da sua operação.",
  image: { src: "/sisblink/pedidos.webp", alt: "Pedidos B2B no SISBlink para organização do mix de lojas multimarcas", width: 1363, height: 767 },
  benefits: [
    { title: "Planejamento de compras por coleção", text: "Apresente e revise o mix no catálogo por coleção e categoria. O comprador pode conferir as escolhas e quantidades antes da confirmação do pedido." },
    { title: "Grades coerentes com a loja", text: "Confira cores, tamanhos e quantidades por produto. Essa revisão ajuda a identificar compras desequilibradas antes de fechar o pedido." },
    { title: "Estoque parado exige contexto", text: "Antes de comprar mais, confronte o mix proposto com o estoque e o histórico de vendas da loja. A SYSNEY avalia quais dados do ERP podem apoiar esse processo." },
    { title: "Reposição com disponibilidade", text: "O saldo comercial do fornecedor ajuda a orientar o pedido de reposição. Ele depende da integração e não deve ser confundido com o estoque próprio da loja." },
    { title: "Pedidos separados por loja", text: "Mantenha o pedido no contexto de cada cliente, com sua tabela e condições. Redes e grupos podem organizar o atendimento conforme os perfis configurados." },
    { title: "Comprador e representante alinhados", text: "Revise o pedido em conjunto para reduzir dúvidas sobre o que foi negociado. A confirmação consolida as escolhas antes da finalização." },
  ],
  processTitle: "Do diagnóstico do mix à revisão do pedido",
  process: [
    { title: "Entenda o estoque e a necessidade", text: "Reúna os dados de estoque e vendas do ERP da loja e identifique excessos e faltas com sua equipe." },
    { title: "Organize a compra no catálogo", text: "Use o SISBlink para selecionar produtos, conferir variações e montar o pedido por cliente dentro da operação B2B configurada." },
    { title: "Valide antes de confirmar", text: "Revise o mix, as quantidades e as condições com o representante, considerando as necessidades identificadas pela loja." },
  ],
  audienceTitle: "Para compras B2B com mais clareza",
  audiences: ["Lojas multimarcas de moda", "Compradores de coleção", "Redes de lojas", "Lojas franqueadas", "Marcas que atendem lojistas", "Representantes de moda"],
  faq: [
    { question: "O SISBlink é um software de estoque para loja multimarcas?", answer: "O SISBlink atua no catálogo e nos pedidos B2B. O controle de estoque da loja permanece no sistema responsável por essa gestão. A SYSNEY avalia como conectar os dados disponíveis para apoiar a jornada comercial." },
    { question: "Como a ferramenta pode ajudar com estoque parado e reposição?", answer: "Ela organiza o catálogo, as variações e os pedidos para que o comprador revise o mix. A análise de estoque parado e das necessidades de reposição exige dados de estoque e vendas da loja; o escopo para utilizá-los deve ser avaliado com a SYSNEY." },
    { question: "O sistema faz planejamento de compras ou prevê a demanda automaticamente?", answer: "A plataforma apoia a montagem e a revisão dos pedidos. Previsão automática de demanda e sugestões automáticas de compra não estão incluídas nesta proposta de funcionalidades. Apresente seu processo para avaliarmos o atendimento necessário." },
    { question: "Preciso trocar o ERP da minha multimarcas?", answer: "Não necessariamente. A viabilidade de manter e conectar o sistema atual depende das interfaces, dos dados e das regras disponíveis. Essa avaliação faz parte da definição do projeto." },
  ],
  value: { title: "Invista no que melhora sua rotina de compras.", text: "Uma boa comparação começa pelo problema que você precisa resolver. Veja o SISBlink em uma demonstração, avalie o fluxo de pedidos e peça uma proposta com implantação, integração e suporte definidos. O objetivo é encontrar uma solução adequada à sua operação, com investimento bem dimensionado.", points: ["Demonstração orientada ao seu processo de compra.", "Escopo claro para dados, pedidos e integração.", "Comparação do custo total, incluindo implantação e suporte."] },
};
export default function Page() { return <CommercialPage data={data} />; }
