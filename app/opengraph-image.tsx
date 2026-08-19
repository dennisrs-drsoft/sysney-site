import { ImageResponse } from "next/og";

export const alt = "SISBlink — Sistema de Força de Vendas B2B para Moda";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", color: "white", background: "radial-gradient(circle at 85% 15%, #2563eb 0, #07111f 45%, #030712 100%)", fontFamily: "Arial" }}>
      <div style={{ display: "flex", color: "#60a5fa", fontSize: 34, fontWeight: 900, letterSpacing: 4 }}>SISBLINK</div>
      <div style={{ display: "flex", maxWidth: 970, marginTop: 40, fontSize: 70, lineHeight: 1.05, fontWeight: 900 }}>Sistema de força de vendas B2B para moda</div>
      <div style={{ display: "flex", marginTop: 34, fontSize: 28, color: "#cbd5e1" }}>Catálogo digital · Pedidos · Gestão comercial · Integrações ERP</div>
      <div style={{ display: "flex", marginTop: 50, width: 140, height: 8, borderRadius: 8, background: "#34d399" }} />
    </div>,
    size,
  );
}
