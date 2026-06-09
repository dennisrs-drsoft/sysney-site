import "./globals.css";

export const metadata = {
  title: {
    default: "SISBlink | Plataforma B2B para Moda e Atacado",
    template: "%s | SISBlink",
  },
  description:
    "Catálogo digital, pedidos B2B, dashboards, integrações ERP e gestão comercial para marcas de moda, atacado e franquias.",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}