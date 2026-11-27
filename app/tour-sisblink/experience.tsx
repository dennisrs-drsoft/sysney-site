"use client";

import Image from "../components/site-image";
import Link from "next/link";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import SwanScene from "./swan-scene";
import { advanceProgress, journeyPhase, type TourFrame } from "./motion";
import "./experience.css";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const range = (value: number, start: number, end: number) => clamp((value - start) / (end - start));

const tourScreens = [
  { src: "/sisblink/telas/catalogo-detalhado.webp", width: 1784, height: 937 },
  { src: "/sisblink/telas/shopping.webp", width: 1920, height: 1080 },
  { src: "/sisblink/telas/grade.webp", width: 1920, height: 1080 },
  { src: "/sisblink/telas/confirmacao.webp", width: 1585, height: 1080 },
];
const TourScreens = memo(function TourScreens({ active, onLoaded, onFailed }: {
  active: string; onLoaded: (src: string) => void; onFailed: (src: string) => void;
}) {
  return <div className="collection-screen-stack">{tourScreens.map((screen, index) =>
    <Image key={screen.src} src={screen.src} alt={active === screen.src ? "Tela real do SISBlink — ambiente de demonstração" : ""}
      aria-hidden={active !== screen.src} width={screen.width} height={screen.height} sizes="(max-width: 850px) 94vw, 1100px"
      loading="eager" fetchPriority={index === 0 ? "high" : "low"} onLoad={() => onLoaded(screen.src)} onError={() => onFailed(screen.src)}
      style={{ opacity: active === screen.src ? 1 : 0 }} />
  )}</div>;
});

export default function CollectionExperience() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const paintFrame = useRef<TourFrame | null>(null);
  const liveProgress = useRef(0);
  const renderSwan = useRef<TourFrame | null>(null);
  const frameTime = useRef(0);
  const guidePath = useRef<SVGPathElement>(null);
  const brandTarget = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const onLoaded = useCallback((src: string) => setLoaded(value => value[src] ? value : { ...value, [src]: true }), []);
  const onFailed = useCallback((src: string) => setFailed(value => ({ ...value, [src]: true })), []);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });

  useEffect(() => {
    // Honor the device preference; the visitor can still change the reading mode.
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReduced(preference.matches);
    syncPreference();
    preference.addEventListener("change", syncPreference);
    const restoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, behavior: "instant" });
    let scrollStart = 0, scrollDistance = 1, frozenHeight = 0, lastWidth = 0;
    let frame = 0, lastTime = 0, current = 0, target = 0, measure = true, phase = journeyPhase(0);
    const stageElement = track.current?.querySelector<HTMLElement>(".collection-stage");
    const touch = matchMedia("(max-width: 1024px), (pointer: coarse)");
    const resize = () => {
      const width = document.documentElement.clientWidth;
      const measuredHeight = Math.max(620, Math.round(window.visualViewport?.height ?? innerHeight));
      const reframe = !frozenHeight || width !== lastWidth || (!touch.matches && measuredHeight !== frozenHeight);
      const preserve = frozenHeight > 0 && reframe && !root.current?.classList.contains("collection-reduced");
      // Ignore toolbar-only height changes on touch: keep one pixel-sized stage
      // throughout a gesture, including browsers where svh changes with chrome.
      if (reframe) {
        frozenHeight = measuredHeight;
        lastWidth = width;
        root.current?.style.setProperty("--tour-height", `${frozenHeight}px`);
        root.current?.style.setProperty("--tour-track-height", `${frozenHeight * 9.4}px`);
        const height = frozenHeight;
        setViewport(previous => previous.width === width && previous.height === height ? previous : { width, height });
      }
      if (track.current) {
        scrollStart = track.current.getBoundingClientRect().top + scrollY;
        scrollDistance = Math.max(1, track.current.offsetHeight - (stageElement?.clientHeight ?? frozenHeight));
        if (preserve) window.scrollTo({ top: scrollStart + current * scrollDistance, behavior: "instant" });
      }
      measure = true;
    };
    const update = (time: number) => {
      if (measure) { target = clamp((scrollY - scrollStart) / scrollDistance); measure = false; }
      const dt = lastTime ? (time - lastTime) / 1000 : 1 / 60;
      lastTime = time;
      current = advanceProgress(current, target, dt);
      liveProgress.current = current;
      frameTime.current = time;
      const nextPhase = journeyPhase(current);
      if (nextPhase !== phase) { phase = nextPhase; setProgress(current); }
      paintFrame.current?.(time, current);
      frame = requestAnimationFrame(update);
    };
    const scroll = () => { measure = true; };
    const visibility = () => { lastTime = 0; measure = true; };
    resize();
    document.addEventListener("visibilitychange", visibility);
    addEventListener("resize", resize);
    addEventListener("scroll", scroll, { passive: true });
    const stageObserver = new ResizeObserver(resize);
    if (stageElement) stageObserver.observe(stageElement);
    frame = requestAnimationFrame(update);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      stageObserver.disconnect();
      preference.removeEventListener("change", syncPreference);
      removeEventListener("resize", resize);
      removeEventListener("scroll", scroll);
      history.scrollRestoration = restoration;
      cancelAnimationFrame(frame);
    };
  }, []);

  // Keep the approved collection choreography, then continue into ordering.
  const introProgress = clamp(progress / .56);
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
  const requestedScene = [...orderScenes].reverse().find(scene => progress >= scene.start);
  const orderScene = [...orderScenes].reverse().find(scene => progress >= scene.start && loaded[scene.src]);
  const preparingScreen = !reduced && requestedScene && !loaded[requestedScene.src];
  const isOrdering = !reduced && Boolean(orderScene);
  const screen = isOrdering && orderScene ? orderScene : { src: "/sisblink/telas/catalogo-detalhado.webp", width: 1784, height: 937 };
  const detail = isOrdering && orderScene ? { ...orderScene, width: orderScene.boxWidth, height: orderScene.boxHeight } : details[dataStep];
  const catalogWidth = Math.min(viewport.width * (mobile ? .94 : .82), 1100, viewport.height * .55 * screen.width / screen.height);
  const catalogLeft = (viewport.width - catalogWidth) / 2;
  const catalogTop = viewport.height * (mobile ? .43 : .34);
  const cardWidth = Math.min(viewport.width * .25, 250);
  const showFocus = !reduced && progress > .44 && progress < .88;
  const chapter = progress < .14 ? 0 : progress < .33 ? 1 : progress < .56 ? 2 : progress < .65 ? 3 : progress < .79 ? 4 : 5;

  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const nodes = Object.fromEntries(["orbit", "copy", "swan-fallback", "middle", "catalog", "final-copy", "end-backdrop", "end", "end-logo"].map(name => [name, host.querySelector<HTMLElement>(`.collection-${name}`)]));
    const pieces = [...host.querySelectorAll<HTMLElement>(".collection-pieces figure")];
    const bar = host.querySelector<HTMLElement>(".collection-progress span");
    if (!reduced) {
      pieces.forEach(piece => { piece.style.width = `${cardWidth}px`; });
      const element = nodes.catalog;
      if (element) {
        element.style.width = `${catalogWidth}px`;
        element.style.left = `${catalogLeft}px`;
        element.style.top = `${catalogTop}px`;
        element.style.aspectRatio = `${screen.width} / ${screen.height + 32 * screen.width / catalogWidth}`;
      }
    }
    const opacity = (name: string, value: number) => { if (nodes[name]) nodes[name]!.style.opacity = String(value); };
    let lastPainted = -1;
    const paint: TourFrame = (time, p) => {
      if (!reduced && p !== lastPainted) {
        lastPainted = p;
        const ip = clamp(p / .56), collection = ease(range(ip, .15, .3));
        if (nodes.orbit) nodes.orbit.style.transform = `translate(-50%, -50%) rotate(${ip * 80}deg) scale(${1 + collection * .3})`;
        opacity("copy", 1 - range(ip, .12, .25));
        if (nodes.copy) nodes.copy.style.transform = `translate3d(0,${-ip * 120}px,0)`;
        opacity("swan-fallback", 1 - range(ip, .6, .8));
        pieces.forEach((piece, index) => {
          const merge = ease(range(ip, .56 + index * .035, .78 + index * .035));
          const appear = ease(range(ip, .16 + index * .04, .29 + index * .04));
          const startX = viewport.width * (.19 + index * .31) - cardWidth / 2;
          const endX = catalogLeft + catalogWidth * (261 + index * 263) / 1784;
          const endY = catalogTop + 32 + catalogWidth * 138 / 1784;
          const x = lerp(startX, endX, merge);
          const y = lerp(viewport.height * (.46 + (index === 1 ? -.035 : .025)), endY, merge) + (1 - appear) * 90;
          const scale = lerp(1, catalogWidth * 251 / 1784 / cardWidth, merge);
          piece.style.transform = `translate3d(${x}px,${y}px,0) perspective(1000px) rotateY(${Math.sin(ip * 9 + index) * 12 * (1 - merge)}deg) rotateZ(${(index - 1) * 7 * (1 - merge)}deg) scale(${scale})`;
          piece.style.opacity = String(appear * (1 - ease(range(ip, .84, .89))));
          const caption = piece.querySelector("figcaption");
          if (caption) caption.style.opacity = String(1 - merge);
        });
        opacity("middle", range(ip, .24, .34) * (1 - range(ip, .54, .64)));
        opacity("catalog", ease(range(ip, .52, .72)) * (1 - ease(range(p, .875, .91))));
        opacity("final-copy", range(ip, .78, .9) * (1 - ease(range(p, .875, .9))));
        opacity("end-backdrop", ease(range(p, .88, .975)));
        opacity("end", range(p, .89, .95));
        opacity("end-logo", ease(range(p, .978, 1)));
        if (bar) bar.style.transform = `scaleX(${p})`;
      }
      renderSwan.current?.(time, p);
    };
    paintFrame.current = paint;
    paint(frameTime.current, liveProgress.current);
    return () => { paintFrame.current = null; };
  }, [viewport, reduced, loaded, progress, cardWidth, catalogWidth, catalogLeft, catalogTop, screen.width, screen.height]);

  return (
    <main ref={root} className={`collection-preview ${reduced ? "collection-reduced" : ""}`}>
      <header className="collection-header">
        <Link href="/" aria-label="Voltar à SYSNEY"><Image src="/sysney-logo.svg" alt="SYSNEY" width={92} height={92} /></Link>
        <button type="button" onClick={() => setReduced(!reduced)} aria-pressed={!reduced}>{reduced ? "Ativar movimento" : "Pausar movimento"}</button>
        <Link href="/contato?interesse=sisblink&origem=tour-sisblink">Vamos conversar ↗︎</Link>
      </header>
      <div className="collection-track" ref={track}>
        <section className="collection-stage" aria-label="Da coleção à montagem do pedido">
          <div className="collection-light" aria-hidden="true" />
          <div className="collection-orbit" aria-hidden="true" />
          <div className="collection-copy">
            <p className="collection-eyebrow">TECNOLOGIA COM A SUA IDENTIDADE</p>
            <h1>Sua coleção<br />tem identidade.<br /><em>Sua venda também.</em></h1>
            <p>O SISBlink conecta a apresentação da coleção à construção de cada pedido.</p>
          </div>
          <SwanScene frameRef={renderSwan} reduced={reduced} brandTarget={brandTarget} screenBottom={catalogTop + 32 + catalogWidth * screen.height / screen.width} onEyePosition={eye => {
            const path = guidePath.current;
            if (!path) return;
            const targetX = catalogLeft + catalogWidth * (detail.x + detail.width) / screen.width + 4;
            const targetY = catalogTop + 32 + catalogWidth * (detail.y + detail.height / 2) / screen.width;
            const controlX = eye.x + (targetX - eye.x) * .3;
            const d = `M ${eye.x} ${eye.y} Q ${controlX} ${targetY} ${targetX} ${targetY}`;
            if (path.getAttribute("d") !== d) path.setAttribute("d", d);
          }} />
          <div className="collection-swan-fallback" aria-hidden="true">
            <Image src="/sysney-cisne-3d.png" alt="" width={650} height={650} priority />
          </div>
          <div className="collection-pieces" aria-hidden={!reduced && chapter !== 1}>
            {["Preta · malha fina", "Rosa antigo · chiffon", "Terracota · viscose"].map((label, index) => {
              return (
                <figure key={label} data-observed={!reduced && introProgress > .26 && introProgress < .57 && observedPiece === index ? "true" : undefined}>
                  <div className={`collection-product product-${index}`}>
                    <Image src="/sisblink/telas/catalogo-detalhado.webp" alt={label} width={1784} height={937} sizes="(max-width: 850px) 180vw, 1800px" />
                  </div>
                  <figcaption>{label}<span>{!reduced && observedPiece === index && introProgress > .26 && introProgress < .57 ? "PEÇA EM DESTAQUE" : "COLEÇÃO DE DEMONSTRAÇÃO"}</span></figcaption>
                </figure>
              );
            })}
          </div>
          <div className="collection-middle">
            <p className="collection-eyebrow">CADA PEÇA, EM DETALHES</p>
            <h2>Uma coleção.<br /><em>Muitas possibilidades.</em></h2>
          </div>
          <div className="collection-catalog" data-screen={screen.src}>
            <div className="collection-window"><span>● ● ●</span><span>SISBLINK / AMBIENTE REAL</span></div>
            {showFocus && <div className="collection-data-focus" style={{ left: `${detail.x / screen.width * 100}%`, top: `calc(32px + ${detail.y / screen.width * catalogWidth}px)`, width: `${detail.width / screen.width * 100}%`, height: detail.height / screen.width * catalogWidth }} aria-hidden="true" />}
            <TourScreens active={screen.src} onLoaded={onLoaded} onFailed={onFailed} />
            {preparingScreen && <span className="collection-loading" role="status">{failed[requestedScene.src] ? "Não foi possível carregar a próxima tela. A etapa anterior foi mantida." : "Preparando a próxima tela…"}</span>}
          </div>
          {showFocus && <svg className="collection-guide-line" viewBox={`0 0 ${viewport.width} ${viewport.height}`} aria-hidden="true">
            <path ref={guidePath} />
          </svg>}
          <div className="collection-final-copy">
            <p className="collection-eyebrow">{isOrdering ? "DA ESCOLHA À MONTAGEM DO PEDIDO" : "SUA COLEÇÃO, PRONTA PARA VENDER"}</p>
            <h2>{showFocus ? detail.title : <>Do primeiro olhar<br /><em>ao próximo pedido.</em></>}</h2>
            <p>{showFocus ? detail.description : "Imagens, cores, grade e disponibilidade em uma experiência conectada."}</p>
            {showFocus && <span className="collection-focus-label">{detail.label}</span>}
          </div>
          {reduced && <div className="collection-reading-tour">{orderScenes.filter((scene, index) => index === 0 || scene.src !== orderScenes[index - 1].src).map(scene => <section key={scene.start}><p className="collection-eyebrow">DA COLEÇÃO AO PEDIDO</p><h2>{scene.src.includes("grade") ? "Prazo, grade e quantidades." : scene.title}</h2><p>{scene.src.includes("grade") ? "Escolha o prazo, distribua as quantidades por tamanho, confira o total e adicione a peça à sacola." : scene.description}</p><Image src={scene.src} alt={scene.title + " — captura de demonstração do SISBlink"} width={scene.width} height={scene.height} sizes="90vw" /></section>)}</div>}
          <div className="collection-end-backdrop" aria-hidden="true" />
          <section className="collection-end" style={{ pointerEvents: reduced || progress > .94 ? "auto" : "none" }} aria-hidden={!reduced && progress < .89}>
            <Image ref={brandTarget} className="collection-end-logo" src="/sysney-logo.svg" alt="SYSNEY Informática" width={188} height={184} />
            <div className="collection-end-copy"><p className="collection-eyebrow">PLATAFORMA DESENVOLVIDA PELA SYSNEY</p>
            <h2>A coleção é sua.<br /><em>O próximo passo também.</em></h2>
            <p className="collection-demo-note">Telas reais do ambiente de demonstração. A visita apresenta o fluxo sem gravar ou enviar pedidos.</p>
            <Link tabIndex={reduced || progress > .94 ? 0 : -1} href="/contato?interesse=sisblink&origem=tour-sisblink">Quero uma demonstração</Link>
            <Link tabIndex={reduced || progress > .94 ? 0 : -1} href="/sisblink-em-acao">Explorar as telas reais →</Link></div>
          </section>
          <div className="collection-chapters" aria-label="Etapa da experiência">
            {["Identidade", "Coleção", "Catálogo", "Shopping", "Grade", "Pedido"].map((label, index) => <span key={label} aria-current={chapter === index ? "step" : undefined}>{label}</span>)}
          </div>
          <div className="collection-progress" aria-hidden="true"><span /></div>
          <p className="collection-scroll">ROLE PARA EXPLORAR ↓</p>
        </section>
      </div>

    </main>
  );
}
