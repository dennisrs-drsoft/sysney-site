import type { MetadataRoute } from "next";
const routes = ["", "/links", "/sistema-forca-de-vendas", "/plataforma-vendas-b2b", "/vendas-para-franquias-e-multimarcas", "/integracoes-erp", "/sistema-pedidos-confeccao-moda", "/compras-reposicao-multimarcas", "/sisblink-em-acao", "/contato"];
export default function sitemap(): MetadataRoute.Sitemap {
  // Só informar lastModified quando houver uma data verificável de alteração do conteúdo.
  return routes.map((route) => ({ url: `https://www.sysney.com${route}` }));
}
