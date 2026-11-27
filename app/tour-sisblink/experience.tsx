"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SwanScene from "./swan-scene";
import "./experience.css";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const range = (value: number, start: number, end: number) => clamp((value - start) / (end - start));

export default function CollectionExperience() {
  const track = useRef<HTMLDivElement>(null);
  const guidePath = useRef<SVGPathElement>(null);
  const brandTarget = useRef<HTMLImageElement>(null);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });

  useEffect(() => {
    // This isolated motion preview is explicitly requested by the visitor.
    // Pausing remains available without changing the operating system preference.
    const restoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, behavior: "instant" });
    const resize = () => setViewport({ width: document.documentElement.clientWidth, height: innerHeight });
    resize();
    addEventListener("resize", resize);
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!track.current) return;
      const bounds = track.current.getBoundingClientRect();
      setProgress(clamp(-bounds.top / Math.max(1, bounds.height - innerHeight)));
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("resize", scroll);
    return () => {
      removeEventListener("resize", resize);
      removeEventListener("scroll", scroll);
      removeEventListener("resize", scroll);
      history.scrollRestoration = restoration;
      cancelAnimationFrame(frame);
    };
  }, []);

  // Keep the approved collection choreography, then continue into ordering.
  const introProgress = clamp(progress / .56);
  const collection = ease(range(introProgress, .15, .3));
  const catalog = ease(range(introProgress, .52, .72));
  const mobile = viewport.width <= 850;
  const observedPiece = introProgress < .37 ? 0 : introProgress < .51 ? 1 : 2;
  const dataStep = introProgress < .85 ? 0 : introProgress < .92 ? 1 : 2;
  const details = [
    { title: "Cor que identifica.", description: "A referência e a cor acompanham a peça escolhida.", x: 1074, y: 516, width: 610, height: 72, label: "Referência e cor" },
    { title: "Grade para compor o pedido.", description: "Do PP ao GG: os tamanhos disponíveis no mesmo catálogo.", x: 1074, y: 846, width: 270, height: 68, label: "Grade de tamanhos" },
    { title: "Disponibilidade para decidir.", description: "Consulte o estoque da peça antes de seguir com o pedido.", x: 1070, y: 790, width: 86, height: 62, label: "Estoque" },
  ];
  const orderScenes = [
    { start: .56, title: "Da coleção à escolha.", description: "No Shopping SISBlink, escolha a peça que vai compor o pedido.", label: "Shopping da coleção", src: "/sisblink/telas/shopping.webp", width: 1920, height: 1080, x: 108, y: 478, boxWidth: 440, boxHeight: 570 },
    { start: .65, title: "Escolha o prazo.", description: "Defina a entrega antes de distribuir as quantidades por tamanho.", label: "Prazo de entrega", src: "/sisblink/telas/grade.webp", width: 1920, height: 1080, x: 933, y: 509, boxWidth: 568, boxHeight: 121 },
    { start: .69, title: "Monte a grade.", description: "Informe as quantidades de PP a GG e acompanhe o total selecionado.", label: "Tamanhos e quantidades", src: "/sisblink/telas/grade.webp", width: 1920, height: 1080, x: 932, y: 704, boxWidth: 570, boxHeight: 164 },
    { start: .74, title: "A peça entra no pedido.", description: "Depois de conferir a grade, use a ação de adicionar à sacola.", label: "Adicionar à sacola", src: "/sisblink/telas/grade.webp", width: 1920, height: 1080, x: 933, y: 871, boxWidth: 568, boxHeight: 61 },
    { start: .79, title: "Confira o pedido montado.", description: "Revise os itens, quantidades, subtotais e prazos antes de concluir.", label: "Revisão dos itens", src: "/sisblink/telas/confirmacao.webp", width: 1585, height: 1080, x: 285, y: 599, boxWidth: 1288, boxHeight: 462 },
  ];
  const orderScene = [...orderScenes].reverse().find(scene => progress >= scene.start);
  const isOrdering = !reduced && Boolean(orderScene);
  const screen = isOrdering && orderScene ? orderScene : { src: "/sisblink/telas/catalogo-detalhado.png", width: 1784, height: 937 };
  const detail = isOrdering && orderScene ? { ...orderScene, width: orderScene.boxWidth, height: orderScene.boxHeight } : details[dataStep];
  const catalogWidth = Math.min(viewport.width * (mobile ? .94 : .82), 1100, viewport.height * .55 * screen.width / screen.height);
  const catalogLeft = (viewport.width - catalogWidth) / 2;
  const catalogTop = viewport.height * (mobile ? .43 : .34);
  const cardWidth = Math.min(viewport.width * .25, 250);
  const dock = ease(range(progress, .88, .975));
  const handoff = ease(range(progress, .978, 1));
  const showFocus = !reduced && progress > .44 && progress < .88;
  const chapter = progress < .14 ? 0 : progress < .33 ? 1 : progress < .56 ? 2 : progress < .65 ? 3 : progress < .79 ? 4 : 5;

  return (
    <main className={`collection-preview ${reduced ? "collection-reduced" : ""}`}>
      <header className="collection-header">
        <Link href="/" aria-label="Voltar à SYSNEY"><Image src="/sysney-logo.svg" alt="SYSNEY" width={92} height={92} /></Link>
        <button type="button" onClick={() => setReduced(!reduced)} aria-pressed={!reduced}>{reduced ? "Ativar movimento" : "Pausar movimento"}</button>
        <Link href="/contato?interesse=sisblink&origem=tour-sisblink">Vamos conversar ↗︎</Link>
      </header>
      <div className="collection-track" ref={track}>
        <section className="collection-stage" aria-label="Da coleção à montagem do pedido">
          <div className="collection-light" aria-hidden="true" />
          <div className="collection-orbit" aria-hidden="true" style={{ transform: `translate(-50%, -50%) rotate(${introProgress * 80}deg) scale(${1 + collection * 0.3})` }} />
          <div className="collection-copy" style={{ opacity: 1 - range(introProgress, 0.12, 0.25), transform: `translateY(${-introProgress * 120}px)` }}>
            <p className="collection-eyebrow">TECNOLOGIA COM A SUA IDENTIDADE</p>
            <h1>Sua coleção<br />tem identidade.<br /><em>Sua venda também.</em></h1>
            <p>O SISBlink conecta a apresentação da coleção à construção de cada pedido.</p>
          </div>
          <SwanScene progress={reduced ? 0 : Math.min(introProgress, .97)} reduced={reduced} dock={reduced ? 0 : dock} handoff={reduced ? 0 : handoff} brandTarget={brandTarget} screenBottom={catalogTop + 32 + catalogWidth * screen.height / screen.width} onEyePosition={eye => {
            const path = guidePath.current;
            if (!path) return;
            const targetX = catalogLeft + catalogWidth * (detail.x + detail.width) / screen.width + 4;
            const targetY = catalogTop + 32 + catalogWidth * (detail.y + detail.height / 2) / screen.width;
            const controlX = eye.x + (targetX - eye.x) * .3;
            path.setAttribute("d", `M ${eye.x} ${eye.y} Q ${controlX} ${targetY} ${targetX} ${targetY}`);
          }} />
          <div className="collection-swan-fallback" style={{ opacity: 1 - range(introProgress, .6, .8) }} aria-hidden="true">
            <Image src="/sysney-cisne-3d.png" alt="" width={650} height={650} priority />
          </div>
          <div className="collection-pieces" aria-hidden={!reduced && chapter !== 1}>
            {["Preta · malha fina", "Rosa antigo · chiffon", "Terracota · viscose"].map((label, index) => {
              const merge = ease(range(introProgress, .56 + index * .035, .78 + index * .035));
              const appear = ease(range(introProgress, .16 + index * .04, .29 + index * .04));
              const startX = viewport.width * (.19 + index * .31) - cardWidth / 2;
              const endX = catalogLeft + catalogWidth * (261 + index * 263) / 1784;
              const endY = catalogTop + 32 + catalogWidth * 138 / 1784;
              const width = lerp(cardWidth, catalogWidth * 251 / 1784, merge);
              return (
                <figure key={label} data-observed={!reduced && introProgress > .26 && introProgress < .57 && observedPiece === index ? "true" : undefined} style={{
                  left: lerp(startX, endX, merge),
                  top: lerp(viewport.height * (.46 + (index === 1 ? -.035 : .025)), endY, merge),
                  width,
                  opacity: appear * (1 - ease(range(introProgress, .84, .89))),
                  transform: `perspective(1000px) translateY(${(1 - appear) * 90}px) rotateY(${Math.sin(introProgress * 9 + index) * 12 * (1 - merge)}deg) rotateZ(${(index - 1) * 7 * (1 - merge)}deg)`,
                  borderRadius: lerp(14, 0, merge),
                  boxShadow: `0 ${30 * (1 - merge)}px ${60 * (1 - merge)}px #0004`,
                }}>
                  <div className={`collection-product product-${index}`}>
                    <Image src="/sisblink/telas/catalogo-detalhado.png" alt={label} width={1784} height={937} sizes="(max-width: 850px) 180vw, 1800px" />
                  </div>
                  <figcaption style={{ opacity: 1 - merge, maxHeight: (1 - merge) * 90, padding: `${(1 - merge) * 16}px 6px` }}>{label}<span>{!reduced && observedPiece === index && introProgress > .26 && introProgress < .57 ? "PEÇA EM DESTAQUE" : "COLEÇÃO DE DEMONSTRAÇÃO"}</span></figcaption>
                </figure>
              );
            })}
          </div>
          <div className="collection-middle" style={{ opacity: range(introProgress, 0.24, 0.34) * (1 - range(introProgress, 0.54, 0.64)) }}>
            <p className="collection-eyebrow">CADA PEÇA, EM DETALHES</p>
            <h2>Uma coleção.<br /><em>Muitas possibilidades.</em></h2>
          </div>
          <div className="collection-catalog" key={screen.src} data-screen={screen.src} style={reduced ? undefined : { opacity: catalog * (1 - ease(range(progress, .875, .91))), width: catalogWidth, left: catalogLeft, top: catalogTop }}>
            <div className="collection-window"><span>● ● ●</span><span>SISBLINK / AMBIENTE REAL</span></div>
            {showFocus && <div className="collection-data-focus" style={{ left: `${detail.x / screen.width * 100}%`, top: `calc(32px + ${detail.y / screen.width * catalogWidth}px)`, width: `${detail.width / screen.width * 100}%`, height: detail.height / screen.width * catalogWidth }} aria-hidden="true" />}
            <Image src={screen.src} alt={isOrdering ? detail.title + " — tela real do SISBlink" : "Catálogo real do SISBlink com produtos, cores, tamanhos e detalhe da blusa terracota"} width={screen.width} height={screen.height} sizes="90vw" priority />
          </div>
          {showFocus && <svg className="collection-guide-line" viewBox={`0 0 ${viewport.width} ${viewport.height}`} aria-hidden="true">
            <path ref={guidePath} />
          </svg>}
          <div className="collection-final-copy" style={{ opacity: range(introProgress, .78, .9) * (1 - ease(range(progress, .875, .90))) }}>
            <p className="collection-eyebrow">{isOrdering ? "DA ESCOLHA À MONTAGEM DO PEDIDO" : "SUA COLEÇÃO, PRONTA PARA VENDER"}</p>
            <h2>{showFocus ? detail.title : <>Do primeiro olhar<br /><em>ao próximo pedido.</em></>}</h2>
            <p>{showFocus ? detail.description : "Imagens, cores, grade e disponibilidade em uma experiência conectada."}</p>
            {showFocus && <span className="collection-focus-label">{detail.label}</span>}
          </div>
          {reduced && <div className="collection-reading-tour">{orderScenes.filter((scene, index) => index === 0 || scene.src !== orderScenes[index - 1].src).map(scene => <section key={scene.start}><p className="collection-eyebrow">DA COLEÇÃO AO PEDIDO</p><h2>{scene.src.includes("grade") ? "Prazo, grade e quantidades." : scene.title}</h2><p>{scene.src.includes("grade") ? "Escolha o prazo, distribua as quantidades por tamanho, confira o total e adicione a peça à sacola." : scene.description}</p><Image src={scene.src} alt={scene.title + " — captura de demonstração do SISBlink"} width={scene.width} height={scene.height} sizes="90vw" /></section>)}</div>}
          <div className="collection-end-backdrop" style={{ opacity: reduced ? 0 : dock }} aria-hidden="true" />
          <section className="collection-end" style={{ opacity: reduced ? 1 : range(progress, .89, .95), pointerEvents: reduced || progress > .94 ? "auto" : "none" }} aria-hidden={!reduced && progress < .89}>
            <Image ref={brandTarget} className="collection-end-logo" src="/sysney-logo.svg" alt="SYSNEY Informática" width={188} height={184} style={{ opacity: reduced ? 1 : handoff }} />
            <div className="collection-end-copy"><p className="collection-eyebrow">PLATAFORMA DESENVOLVIDA PELA SYSNEY</p>
            <h2>A coleção é sua.<br /><em>O próximo passo também.</em></h2>
            <p className="collection-demo-note">Telas reais do ambiente de demonstração. A visita apresenta o fluxo sem gravar ou enviar pedidos.</p>
            <Link tabIndex={reduced || progress > .94 ? 0 : -1} href="/contato?interesse=sisblink&origem=tour-sisblink">Quero uma demonstração</Link>
            <Link tabIndex={reduced || progress > .94 ? 0 : -1} href="/sisblink-em-acao">Explorar as telas reais →</Link></div>
          </section>
          <div className="collection-chapters" aria-label="Etapa da experiência">
            {["Identidade", "Coleção", "Catálogo", "Shopping", "Grade", "Pedido"].map((label, index) => <span key={label} aria-current={chapter === index ? "step" : undefined}>{label}</span>)}
          </div>
          <div className="collection-progress" aria-hidden="true"><span style={{ width: `${progress * 100}%` }} /></div>
          <p className="collection-scroll">ROLE PARA EXPLORAR ↓</p>
        </section>
      </div>

    </main>
  );
}
