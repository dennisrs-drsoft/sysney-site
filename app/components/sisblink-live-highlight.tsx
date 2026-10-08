import Image from "next/image";
import Link from "next/link";

export function SisblinkLiveHighlight() {
  return (
    <section className="bg-[#07111f] px-6 py-16 text-white sm:py-24 lg:px-10" aria-labelledby="sisblink-live-title">
      <div className="mx-auto grid max-w-[1600px] items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">Atendimento comercial ao vivo</p>
          <h2 id="sisblink-live-title" className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">Seu cliente acompanha. Seu representante conduz. O pedido fica claro para os dois.</h2>
          <p className="mt-6 text-lg leading-8 text-slate-300">Apresente a coleção com o catálogo sincronizado, converse por chat e acompanhe a montagem do pedido no mesmo atendimento. Uma experiência de venda assistida que aproxima marca, representante e lojista.</p>
          <ul className="mt-6 space-y-3 text-slate-200">
            <li>✓ Espelhamento da navegação e dos produtos apresentados.</li>
            <li>✓ Chat no contexto do pedido, com sugestão de grade.</li>
            <li>✓ Acesso por link de atendimento, encerrado pelo representante.</li>
          </ul>
          <Link href="/sisblink-em-acao" className="mt-8 inline-flex rounded-full bg-emerald-400 px-7 py-4 font-black text-slate-950 transition hover:bg-emerald-300">Veja as telas e o fluxo completo →</Link>
        </div>
        <figure className="rounded-2xl border border-white/15 bg-white/5 p-3 shadow-2xl shadow-black/30">
          <Image src="/sisblink/telas/espelhamento.webp" alt="Pedido espelhado do SISBlink com catálogo sincronizado e produto apresentado ao cliente" width={1920} height={1080} sizes="(min-width: 1024px) 60vw, 100vw" className="h-auto w-full rounded-lg object-contain" />
          <figcaption className="px-2 pt-3 text-xs leading-6 text-slate-400">Tela real do SISBlink em ambiente de demonstração DRSOFT. Plataforma desenvolvida pela SYSNEY.</figcaption>
        </figure>
      </div>
    </section>
  );
}
