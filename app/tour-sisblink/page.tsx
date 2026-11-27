import type { Metadata } from "next";
import CollectionExperience from "./experience";

const title = "Tour interativo do SISBlink: da coleção ao pedido";
const description = "Conheça o SISBlink em uma visita guiada: catálogo de moda, cores, estoque, grade, quantidades e montagem do pedido B2B, com telas reais do sistema.";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: "/tour-sisblink" },
  openGraph: { title, description, url: "/tour-sisblink", type: "website", locale: "pt_BR", siteName: "SYSNEY · SISBlink", images: [{ url: "/sisblink/telas/catalogo-detalhado.png", width: 1784, height: 937, alt: "Catálogo de moda e pedidos no SISBlink" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/sisblink/telas/catalogo-detalhado.png"] },
};
export default function TourSisblinkPage() { return <CollectionExperience />; }
