"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const screens = [
  { id: "catalogo", label: "Catálogo", title: "Sua coleção merece uma apresentação à altura.", text: "Fotos, referências e variações organizadas para o representante apresentar os produtos e montar o pedido sem perder o contexto da coleção.", alt: "Catálogo SISBlink com produtos de moda, foto ampliada e grade de tamanhos", width: 1920 },
  { id: "shopping", label: "Shopping", title: "Uma vitrine de compra conectada à operação B2B.", text: "Uma jornada visual que começa no cliente e na coleção autorizada, reúne produtos e condições comerciais e permite acompanhar a sacola durante a compra.", alt: "Shopping SISBlink com vitrine de produtos e sacola do pedido", width: 1920 },
  { id: "grade", label: "Montagem do pedido", title: "Cor, tamanho, quantidade e prazo. Cada detalhe no seu lugar.", text: "Monte a grade no contexto do produto, consulte os saldos por tamanho e confira o valor selecionado. Os prazos disponíveis apoiam a organização das entregas da coleção.", alt: "Montagem de pedido no SISBlink com fotos, tamanhos PP a GG e prazos de entrega", width: 1920 },
  { id: "confirmacao", label: "Revisão e confirmação", title: "Conferência comercial antes de finalizar.", text: "O fluxo separa revisão, análise comercial e confirmação. Confira os itens e os prazos antes do envio: uma etapa visível para reduzir dúvidas e retrabalho.", alt: "Revisão do pedido SISBlink com itens, quantidades, subtotais e prazo de entrega", width: 1585 },
  { id: "dashboard", label: "Dashboard", title: "A coleção também precisa de uma visão de gestão.", text: "Consulte pedidos, clientes, peças, valores e metas no mesmo contexto comercial. Use os filtros para analisar a coleção e orientar o próximo atendimento.", alt: "Dashboard SISBlink com resumo comercial de pedidos, clientes, peças e metas", width: 1920 },
  { id: "espelhamento", label: "Chat e espelhamento", title: "O cliente vê o que você está apresentando. A conversa acompanha o pedido.", text: "O espelhamento sincroniza o catálogo apresentado pelo representante. O lojista acompanha os produtos, conversa no chat e pode enviar uma sugestão de grade. Ao encerrar o atendimento, o representante invalida o acesso daquela sala.", alt: "Espelhamento do pedido SISBlink com catálogo sincronizado, sugestão de grade e chat ao vivo", width: 1920 },
] as const;

export function SisblinkTour() {
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const screen = screens[selected];
  return <section id="telas" className="scroll-mt-8 bg-[#eef5fb] px-6 py-16 sm:py-24 lg:px-10" aria-labelledby="tour-title">
    <div className="mx-auto max-w-[1600px]">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">Veja o funcionamento</p>
      <h2 id="tour-title" className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Uma jornada comercial. Todas as etapas à vista.</h2>
      <p className="mt-5 max-w-3xl leading-8 text-slate-600">Explore as telas reais e veja como o SISBlink organiza a apresentação da coleção, o atendimento e a conferência do pedido.</p>
      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Escolha a tela do SISBlink">{screens.map((item, index) => <button key={item.id} type="button" aria-pressed={selected === index} aria-controls="tour-screen" onClick={() => setSelected(index)} className={`rounded-full border px-4 py-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 ${selected === index ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700"}`}>{item.label}</button>)}</div>
      <div id="tour-screen" className="mt-8" aria-live="polite">
        <div className="mb-6 grid gap-4 lg:grid-cols-2"><h3 className="text-2xl font-black leading-tight text-slate-950">{screen.title}</h3><p className="leading-7 text-slate-600">{screen.text}</p></div>
        <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-300/40 sm:p-4">
          <button type="button" className="block w-full cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => dialog.current?.showModal()} aria-label={`Ampliar tela: ${screen.label}`}><Image key={screen.id} src={`/sisblink/telas/${screen.id}.webp`} alt={screen.alt} width={screen.width} height={1080} sizes="(min-width: 1600px) 1560px, 100vw" className="max-h-[780px] w-full rounded-lg bg-slate-50 object-contain" /></button>
          <figcaption className="flex flex-wrap items-center justify-between gap-2 px-2 pt-4 text-xs leading-6 text-slate-500"><span>Ambiente de demonstração DRSOFT · SISBlink, desenvolvido pela SYSNEY. Valores ilustram o ambiente, não o preço do sistema.</span><button type="button" onClick={() => dialog.current?.showModal()} className="font-bold text-blue-700 underline underline-offset-4">Ampliar tela ↗</button></figcaption>
        </figure>
      </div>
      <dialog ref={dialog} aria-label={`Tela ampliada: ${screen.label}`} className="m-auto max-h-[95vh] w-[96vw] max-w-[1920px] rounded-2xl bg-[#07111f] p-3 text-white shadow-2xl backdrop:bg-slate-950/85" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className="mb-3 flex items-center justify-between gap-4"><p className="font-bold">{screen.label} · SISBlink</p><button type="button" autoFocus onClick={() => dialog.current?.close()} className="rounded-full border border-white/30 px-4 py-2 text-sm font-bold hover:bg-white/10">Fechar ×</button></div>
        <Image src={`/sisblink/telas/${screen.id}.webp`} alt={screen.alt} width={screen.width} height={1080} sizes="96vw" className="max-h-[82vh] w-full rounded-lg object-contain" />
      </dialog>
    </div>
  </section>;
}
