import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administração financeira",
  description: "Área administrativa privada da SYSNEY e da DRSOFT.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
