import type { MetadataRoute } from "next";
const routes = ["", "/sistema-forca-de-vendas", "/plataforma-vendas-b2b", "/vendas-para-franquias-e-multimarcas", "/integracoes-erp", "/contato"];
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return routes.map((route, index) => ({ url: `https://www.sysney.com${route}`, lastModified, changeFrequency: index === 0 ? "weekly" : "monthly", priority: index === 0 ? 1 : route === "/contato" ? 0.7 : 0.9 }));
}
