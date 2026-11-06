import { DirectionalArrow } from "./directional-arrow";
import Image from "next/image";
import Link from "next/link";

export type CommercialPageData = {
  eyebrow: string; title: string; lead: string;
  image: { src: string; alt: string; width: number; height: number };
  benefits: { title: string; text: string }[];
  processTitle: string; process: { title: string; text: string }[];
  audienceTitle: string; audiences: string[];
  faq: { question: string; answer: string }[];
  value?: { title: string; text: string; points: string[] };
};

import { SiteHeader, SiteFooter } from "./site-chrome";
import "../design-system/studio.css";
import "./solutions.css";

export function CommercialPage({ data, children }: { data: CommercialPageData; children?: React.ReactNode }) {
  return <main className="studio solution-page">
    <SiteHeader />
    <section className="studio-hero solution-hero">
      <div data-reveal><p className="studio-eyebrow">{data.eyebrow}</p><h1>{data.title}</h1><p className="studio-intro">{data.lead}</p><div className="studio-actions"><Link href="/contato" className="studio-button">Solicitar demonstração <span><DirectionalArrow /></span></Link><Link href="/sisblink-em-acao" className="studio-text-link">Explore as telas →</Link></div></div>
      <div className="product-stage" data-reveal><div className="stage-orbit" aria-hidden="true"/><div className="product-window"><div className="window-top"><span>● ● ●</span><span>SISBLINK / SUA OPERAÇÃO</span></div><Image src={data.image.src} alt={data.image.alt} width={data.image.width} height={data.image.height} sizes="(min-width: 1000px) 50vw, 90vw" priority /></div></div>
    </section>
    {children && <div className="solution-detail">{children}</div>}
    <section className="studio-services"><div className="section-heading" data-reveal><p className="studio-eyebrow">NA PRÁTICA</p><h2>Mais contexto.<br/><em>Em cada etapa.</em></h2></div>{data.benefits.map((item,index)=><article className="service-row" key={item.title} data-reveal><span className="service-number">{String(index+1).padStart(2,"0")}</span><h3>{item.title}</h3><p>{item.text}</p><span className="service-arrow" aria-hidden="true"><DirectionalArrow /></span></article>)}</section>
    <section className="studio-language solution-process"><div data-reveal><p className="studio-eyebrow">OPERAÇÃO CONECTADA</p><h2>{data.processTitle}</h2></div><ol className="journey-line">{data.process.map((item,index)=><li key={item.title} data-reveal><span>{String(index+1).padStart(2,"0")}</span><h3>{item.title}</h3><p>{item.text}</p></li>)}</ol></section>
    <section className="studio-components solution-audience"><div data-reveal><p className="studio-eyebrow">PARA QUEM É</p><h2>{data.audienceTitle}</h2></div><ul>{data.audiences.map(item=><li key={item} data-reveal><span aria-hidden="true"><DirectionalArrow /></span>{item}</li>)}</ul></section>
    <section className="studio-language solution-faq"><div className="section-heading" data-reveal><p className="studio-eyebrow">DÚVIDAS FREQUENTES</p><h2>Antes do próximo<br/><em>movimento.</em></h2></div><div>{data.faq.map(item=><details key={item.question} data-reveal><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>
    {data.value && <section className="studio-components solution-value" data-reveal><p className="studio-eyebrow">QUALIDADE E CUSTO-BENEFÍCIO</p><h2>{data.value.title}</h2><p>{data.value.text}</p><ul>{data.value.points.map(point=><li key={point}>{point}</li>)}</ul><Link href="/contato" className="studio-button">Comparar minha operação <span><DirectionalArrow /></span></Link></section>}
    <SiteFooter />
  </main>;
}
