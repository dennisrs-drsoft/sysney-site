import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./studio.css";
import "./component-lab.css";
import "../components/solutions.css";
import { SiteHeader } from "../components/site-chrome";
import { ComponentLab } from "./component-lab";

export const metadata: Metadata = { title: "SYSNEY em movimento — Design system", description: "Prévia da nova identidade digital da SYSNEY.", robots: { index: false, follow: false } };

const services = [
  ["01", "Venda com contexto.", "SISBlink B2B", "Coleção, cliente, grade e regras comerciais no mesmo fluxo.", "/sistema-pedidos-confeccao-moda"],
  ["02", "Sua marca, presente.", "Sites com IA", "Design com revisão humana e sites de escopo simples no ar em até 3 dias úteis, após aprovação e entrega dos materiais.", "/contato?interesse=criacao-de-sites&origem=design-system"],
  ["03", "Operação conectada.", "Integrações ERP", "Uma conversa entre sistemas, respeitando os dados e as regras da sua empresa.", "/integracoes-erp"],
];

export default function DesignSystem() {
  return <main className="studio">
    <SiteHeader />
    <section className="studio-hero">
      <div className="studio-hero-copy" data-reveal>
        <p className="studio-eyebrow"><span /> TECNOLOGIA COM DIREÇÃO</p>
        <h1>O próximo<br />movimento<br />é <em>seu.</em></h1>
        <p className="studio-intro">Da primeira visita ao próximo pedido.<br />Criamos experiências digitais que aproximam sua marca de quem compra.</p>
        <div className="studio-actions"><a className="studio-button" href="#solucoes">Encontre sua solução <span>↗</span></a><Link className="studio-text-link" href="/sisblink-em-acao">Conheça o SISBlink <span>→</span></Link></div>
        <div className="studio-signature"><strong>20+</strong><span>anos conectando<br />tecnologia e negócios</span><span className="signature-line" /><span>SYSNEY<br />EM MOVIMENTO</span></div>
      </div>
      <div className="product-stage" data-reveal>
        <div className="stage-orbit" aria-hidden="true" /><div className="stage-orbit stage-orbit-inner" aria-hidden="true" />
        <span className="stage-coordinate">SYSNEY / CONEXÕES REAIS</span>
        <div className="product-window"><div className="window-top"><span>● ● ●</span><span>SISBLINK / COLEÇÃO</span><span>↗</span></div><Image src="/sisblink/telas/catalogo.webp" width={1920} height={1080} priority sizes="(min-width: 1000px) 50vw, 90vw" alt="Catálogo real do SISBlink com produtos da coleção" /></div>
        <div className="stage-caption"><span className="status-dot" /><div><strong>Uma coleção. Muitas possibilidades.</strong><p>Catálogo / grade / pedido / atendimento</p></div></div>
        <span className="stage-index">01 — SISTEMAS QUE CONECTAM</span>
      </div>
    </section>
    <section id="solucoes" className="studio-services">
      <div className="section-heading" data-reveal><p className="studio-eyebrow">ESCOLHA SEU PRÓXIMO PASSO</p><h2>Boas ideias precisam<br />de <em>estrutura.</em></h2><p>Seu negócio tem uma história.<br />A tecnologia deve ajudá-lo a ir além.</p></div>
      {services.map(([number,title,label,description,href]) => <Link href={href} key={number} className="service-row" data-reveal><span className="service-number">{number}</span><div><p className="studio-eyebrow">{label}</p><h3>{title}</h3></div><p>{description}</p><span className="service-arrow">↗</span></Link>)}
    </section>
    <section id="linguagem" className="studio-language" data-reveal><p className="studio-eyebrow">DESIGN SYSTEM / 01</p><h2>Precisão na base.<br /><em>Personalidade</em> na expressão.</h2><div className="palette">{[["Profundo","#061d29"],["Azul SYSNEY · principal","#5099cc"],["Azul luz","#86c9f2"],["Verde","#54d7a0"],["Mineral","#eef5f3"]].map(([name,color])=><div key={name}><span style={{background:color}} /><strong>{name}</strong><small>{color}</small></div>)}</div><div className="type-specimen"><p className="studio-eyebrow">HIERARQUIA & RITMO</p><h3>Conectar. <em>Transformar.</em></h3><p>Títulos amplos, detalhes precisos e espaço para a mensagem respirar. A tecnologia aparece na interação; a personalidade, na composição.</p></div></section>
    <section id="componentes" className="studio-components"><div className="section-heading" data-reveal><p className="studio-eyebrow">DESIGN SYSTEM / 02</p><h2>Uma experiência<br />que <em>responde.</em></h2></div><div className="component-examples"><article data-reveal><span className="studio-eyebrow">AÇÕES</span><h3>Um convite claro.</h3><Link href="/contato" className="studio-button">Converse com a SYSNEY <span>↗</span></Link><p>Experimente o hover, o clique e a navegação por teclado. Ative o som no controle da tela para ouvir o feedback.</p></article><article data-reveal><span className="studio-eyebrow">INFORMAÇÃO</span><details><summary>Como começa um projeto? <span>+</span></summary><p>Conversamos sobre sua operação, definimos o escopo e apresentamos uma proposta com recursos, serviços e investimento.</p></details><details><summary>O SISBlink atende pequenas marcas? <span>+</span></summary><p>Sim. Avaliamos a rotina de quem vende sozinho ou com uma equipe enxuta para definir os recursos adequados.</p></details></article></div></section>
    <ComponentLab />
    <footer className="studio-footer"><p>Vamos criar o seu<br /><em>próximo movimento?</em></p><Link href="/contato" className="studio-button">Comece uma conversa <span>↗</span></Link><div><span>SYSNEY INFORMÁTICA</span><span>SYSNEY · Identidade visual e componentes</span><Link href="/">Voltar ao site →</Link></div></footer>
  </main>;
}
