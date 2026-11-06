import { DirectionalArrow } from "./directional-arrow";
import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return <header className="studio-header">
    <Link href="/" aria-label="SYSNEY — início"><Image src="/sysney-logo.svg" alt="SYSNEY Informática" width={150} height={150} className="site-logo" /></Link>
    <nav aria-label="Navegação principal"><Link href="/sistema-forca-de-vendas">SISBlink</Link><Link href="/#criacao-de-sites">Sites com IA</Link><Link href="/integracoes-erp">Integrações</Link></nav>
    <details className="site-menu"><summary>Explorar <span>+</span></summary><div>{[["Início","/"],["Remodele seu site","/remodelacao-de-sites"],["Pequenas marcas","/sistema-vendas-pequenas-marcas"],["Vendas B2B","/plataforma-vendas-b2b"],["Franquias e multimarcas","/vendas-para-franquias-e-multimarcas"],["Pedidos de moda","/sistema-pedidos-confeccao-moda"],["Compras e reposição","/compras-reposicao-multimarcas"],["Telas do SISBlink","/sisblink-em-acao"],["Todas as soluções","/links"],["Design system","/design-system"]].map(([label,href])=><Link href={href} key={href}>{label} <DirectionalArrow /></Link>)}</div></details>
    <Link className="studio-contact" href="/contato">Vamos conversar <span><DirectionalArrow /></span></Link>
  </header>;
}

export function SiteFooter() {
  return <footer className="studio-footer"><p>Vamos criar o seu<br/><em>próximo movimento?</em></p><Link href="/contato" className="studio-button">Comece uma conversa <span><DirectionalArrow /></span></Link><div><span>SYSNEY INFORMÁTICA</span><Link href="/links">Todas as soluções</Link><Link href="/suporte/confirmacao-whatsapp">Guia de confirmação</Link><Link href="/">Voltar ao início ↑</Link></div></footer>;
}
