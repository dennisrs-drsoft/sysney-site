import type { Metadata } from "next";
import "./globals.css";
import { ScrollToTop } from "./components/scroll-to-top";

const siteUrl = "https://www.sysney.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "SISBlink | Sistema de Força de Vendas B2B para Moda", template: "%s | SISBlink" },
  description: "Sistema de força de vendas B2B com catálogo digital, pedidos, gestão comercial e integrações ERP para indústrias, franquias e multimarcas de moda.",
  applicationName: "SISBlink",
  authors: [{ name: "SYSNEY Informática", url: siteUrl }],
  creator: "SYSNEY Informática",
  publisher: "SYSNEY Informática",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "pt_BR", url: siteUrl, siteName: "SISBlink", title: "SISBlink | Sistema de Força de Vendas B2B para Moda", description: "Catálogo digital, pedidos e gestão comercial para indústrias, representantes, franquias e multimarcas." },
  twitter: { card: "summary_large_image", title: "SISBlink | Sistema de Força de Vendas B2B para Moda", description: "Venda coleções com catálogo visual, pedidos B2B e integração ao seu ERP." },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: [{ url: "/icon.png", sizes: "32x32", type: "image/png" }, { url: "/icon.png", sizes: "192x192", type: "image/png" }], apple: "/icon.png" },
};

const organizationJsonLd = { "@context": "https://schema.org", "@type": "Organization", name: "SYSNEY Informática", url: siteUrl, logo: `${siteUrl}/logo.png`, brand: { "@type": "Brand", name: "SISBlink" }, description: "Desenvolvedora do SISBlink, plataforma de força de vendas B2B para o mercado de moda." };
const softwareJsonLd = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "SISBlink", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: siteUrl, inLanguage: "pt-BR", description: "Sistema de força de vendas B2B com catálogo digital, gestão de clientes e pedidos e integração a ERPs.", publisher: { "@type": "Organization", name: "SYSNEY Informática" } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />{children}<ScrollToTop /></body></html>;
}
