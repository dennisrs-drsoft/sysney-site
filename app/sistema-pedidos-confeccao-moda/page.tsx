import type { Metadata } from "next";
import { CommercialPage, type CommercialPageData } from "../components/commercial-page";
import { ModaPedidoGuide } from "../components/moda-pedido-guide";
import { SisblinkLiveHighlight } from "../components/sisblink-live-highlight";

const title = "Sistema de pedidos para confecção e moda atacado";
const description = "Catálogo digital para representantes, pedidos por grade, cor e tamanho, pré-venda de coleção e pronta entrega. Conheça o SISBlink e avalie a integração ao seu ERP.";
export const metadata: Metadata = {
  title, description, alternates: { canonical: "/sistema-pedidos-confeccao-moda" },
  openGraph: { title, description, url: "/sistema-pedidos-confeccao-moda", type: "website", locale: "pt_BR", siteName: "SISBlink" },
  twitter: { card: "summary_large_image", title, description },
};
const data: CommercialPageData = {
  eyebrow: "Confecções · Marcas · Representantes",
  title: "Da coleção ao pedido: cor, tamanho e grade no mesmo lugar.",
  lead: "Vender moda no atacado exige mais do que uma lista de produtos. O SISBlink reúne catálogo digital, clientes e pedidos para o representante apresentar a coleção e negociar com clareza, sem depender de planilhas e informações espalhadas no WhatsApp.",
  image: { src: "/sisblink/telas/catalogo.webp", alt: "Catálogo digital SISBlink para apresentação de coleções de moda no atacado", width: 1920, height: 1080 },
  benefits: [
    { title: "Pedido por grade, cor e tamanho", text: "Organize variações e quantidades no contexto do produto. Uma conferência clara ajuda a evitar a venda da cor errada, tamanhos esquecidos e retrabalho no pedido." },
    { title: "Catálogo digital para representantes", text: "Apresente imagens e produtos organizados por coleção e categoria pelo navegador. O lojista visualiza o mix enquanto o representante conduz o atendimento." },
    { title: "Pré-venda de coleção", text: "Trabalhe a apresentação da próxima coleção com preços, grades e condições comerciais. Prazos e regras de pré-venda são definidos conforme a configuração da operação." },
    { title: "Pronta entrega e disponibilidade", text: "Consulte saldo e disponibilidade para apoiar pedidos de pronta entrega. A atualização depende dos dados e da frequência de sincronização acordada com o ERP." },
    { title: "Menos redigitação de pedidos", text: "Conecte produtos, clientes, preços e pedidos ao ERP conforme o escopo validado. A equipe ganha um fluxo organizado para vender e conferir." },
    { title: "Confirmação com o comprador", text: "Revise produtos, quantidades e condições com o cliente antes de finalizar. A clareza do pedido ajuda a reduzir dúvidas depois do atendimento." },
  ],
  processTitle: "Um fluxo pensado para o dia a dia da moda",
  process: [
    { title: "Apresente a coleção", text: "Navegue pelo catálogo visual e selecione os produtos adequados ao perfil de cada cliente." },
    { title: "Monte e confira as grades", text: "Registre cores, tamanhos e quantidades com as condições comerciais disponíveis para aquele atendimento." },
    { title: "Confirme e conecte ao ERP", text: "Revise o pedido com o comprador e utilize o fluxo de integração homologado para sua empresa." },
  ],
  audienceTitle: "Para quem vende moda no atacado",
  audiences: ["Confecções", "Marcas de vestuário", "Representantes comerciais", "Distribuidores de moda", "Operações de pré-venda", "Atacado de pronta entrega"],
  faq: [
    { question: "O SISBlink atende pedidos de confecção com grade, cor e tamanho?", answer: "Sim. O catálogo e o pedido trabalham com variações de produto e grades conforme os cadastros e regras da empresa. Na demonstração, avaliamos o modelo de grade usado pela sua confecção." },
    { question: "Posso usar catálogo digital para moda atacado e pedidos de representantes?", answer: "Sim. A plataforma reúne apresentação visual da coleção e pedidos B2B no contexto do cliente e do usuário autorizado." },
    { question: "Como funciona a pré-venda de coleção e a pronta entrega?", answer: "A operação é configurada conforme seus cadastros, condições, prazos e disponibilidade. A SYSNEY avalia os dois cenários com sua equipe para definir as regras e os dados necessários." },
    { question: "O sistema de pedidos de moda integra com Linx Millennium?", answer: "Se sua empresa utiliza Linx Millennium, a SYSNEY avalia as interfaces disponíveis, a versão, os acessos e os fluxos necessários antes de confirmar a integração. O escopo e a homologação são definidos com sua equipe; a compatibilidade não é presumida apenas pelo nome do ERP." },
    { question: "Como comparar o custo com outro sistema de pedidos?", answer: "Compare o mesmo escopo: usuários, catálogo, pedidos, integração, implantação e suporte. Traga seus requisitos para uma demonstração e solicite uma proposta da SYSNEY para avaliar qualidade e custo total lado a lado." },
  ],
  value: { title: "Exija uma experiência profissional. Compare o investimento.", text: "Você não precisa escolher seu sistema apenas pelo tamanho do fornecedor. A SYSNEY reúne experiência em sistemas comerciais e uma plataforma dedicada à moda. Nossa proposta é entregar o que sua operação precisa com foco em custo-benefício, clareza de escopo e qualidade no atendimento.", points: ["Teste o fluxo real: catálogo, grade, pedido e conferência.", "Avalie integração e implantação antes de contratar.", "Compare investimento e suporte para o mesmo escopo."] },
};
export default function Page() { return <CommercialPage data={data}><SisblinkLiveHighlight /><ModaPedidoGuide /></CommercialPage>; }
