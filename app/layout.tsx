import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SYSNEY Informática | SISBlink",
  description:
    "SISBlink: plataforma B2B para moda, atacado, representantes, franquias e multimarcas.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
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