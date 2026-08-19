import type { Metadata } from "next";
import { CommercialPage, type CommercialPageData } from "../components/commercial-page";
export const metadata: Metadata = { title: "Sistema de Força de Vendas para Moda", description: "Sistema de força de vendas para indústrias de moda: catálogo digital, representantes, clientes, pedidos, estoque e gestão comercial em uma plataforma B2B.", alternates: { canonical: "/sistema-forca-de-vendas" } };
const data: CommercialPageData = {
  eyebrow: "Sistema de força de vendas para moda", title: "Equipe comercial, catálogo e pedidos B2B trabalhando no mesmo fluxo.", lead: "O SISBlink organiza a venda de coleções para que representantes, gestores e backoffice consultem informações confiáveis, apresentem produtos e conduzam pedidos sem depender de processos espalhados.",
  image: { src: "/sisblink/home.webp", alt: "Painel do sistema de força de vendas SISBlink", width: 1918, height: 1079 },
  benefits: [
    { title: "Catálogo conectado à venda", text: "Apresente produtos, imagens, cores, grades, prazos, preços e disponibilidade no contexto comercial de cada pedido." },
    { title: "Gestão de clientes e pedidos", text: "Consulte a carteira, filtre pedidos, acompanhe status e execute ações conforme o perfil e as permissões do usuário." },
    { title: "Operação multipedido", text: "Trabalhe com mais de um pedido e preserve o contexto de cada cliente, tabela e regra comercial durante a digitação." },
    { title: "Confirmação comercial", text: "Revise itens, quantidades, condições e informações comerciais antes de confirmar e enviar o pedido." },
    { title: "Informação para decidir", text: "Acompanhe indicadores e oportunidades de coleção para orientar o time durante a campanha de vendas." },
    { title: "Segurança por perfil", text: "Sessão, empresa, marca, coleção, permissões e escopo comercial são validados no servidor." },
  ],
  processTitle: "Uma jornada comercial do atendimento à confirmação", process: [{ title: "Selecione cliente e pedido", text: "O representante acessa somente o contexto comercial autorizado para sua operação." }, { title: "Apresente e monte a venda", text: "O catálogo visual reúne produtos e informações necessárias para digitar o pedido." }, { title: "Revise, confirme e envie", text: "O pedido passa por conferência antes do envio pelos canais configurados para a empresa." }],
  audienceTitle: "Uma plataforma para todos os envolvidos na venda", audiences: ["Indústrias e marcas de moda", "Representantes comerciais", "Gestores e supervisores", "Equipes de backoffice", "Franquias e lojas próprias", "Clientes multimarcas"],
  faq: [{ question: "O SISBlink substitui planilhas e catálogos separados?", answer: "Ele centraliza o fluxo comercial em uma aplicação web. O desenho final depende das integrações e regras usadas por cada empresa." }, { question: "O representante consegue usar pelo navegador?", answer: "Sim. O SISBlink é uma plataforma web responsiva, preparada para acesso em computadores, tablets e celulares compatíveis." }, { question: "As regras comerciais ficam no navegador?", answer: "Não. Regras, permissões, preços e validações sensíveis são resolvidos e revalidados no backend." }],
};
export default function Page() { return <CommercialPage data={data} />; }
