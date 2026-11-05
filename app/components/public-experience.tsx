"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import "./public-experience.css";

export function PublicExperience({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const lastSound = useRef(0);
  const [sound, setSound] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdmin || !root.current) return;
    const host = root.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      host.style.setProperty("--scroll", `${paused || reduced.matches ? 0 : Math.min(window.scrollY * 0.06, 260)}px`);
      if (paused || reduced.matches) {
        host.style.setProperty("--pointer-x", "0px");
        host.style.setProperty("--pointer-y", "0px");
      }
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const pointer = (event: PointerEvent) => {
      if (paused || reduced.matches) return;
      host.style.setProperty("--pointer-x", `${(event.clientX / innerWidth - 0.5) * 35}px`);
      host.style.setProperty("--pointer-y", `${(event.clientY / innerHeight - 0.5) * 25}px`);
    };
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: 0.08 });
    host.querySelectorAll("[data-reveal], main > section, article, .journey-line li").forEach(element => {
      element.setAttribute("data-reveal", "");
      observer.observe(element);
    });
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pointermove", pointer, { passive: true });
    reduced.addEventListener("change", update);
    update();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("scroll", scroll); window.removeEventListener("pointermove", pointer); reduced.removeEventListener("change", update); };
  }, [pathname, paused, isAdmin]);

  useEffect(() => () => { void audio.current?.close(); }, []);

  async function toggleSound() {
    if (sound) { setSound(false); return; }
    try {
      if (!audio.current) audio.current = new AudioContext();
      if (audio.current.state === "suspended") await audio.current.resume();
      setSound(audio.current.state === "running");
      setAudioError(audio.current.state !== "running");
    } catch { setAudioError(true); setSound(false); }
  }

  function tone(high = false) {
    if (!sound || Date.now() - lastSound.current < 120) return;
    const context = audio.current;
    if (!context || context.state !== "running") return;
    lastSound.current = Date.now();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(high ? 640 : 420, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(high ? 900 : 520, context.currentTime + 0.06);
    gain.gain.setValueAtTime(0.018, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.085);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.09);
  }

  if (isAdmin) return children;
  return <div ref={root} className={`sysney-experience${paused ? " motion-paused" : ""}`} onFocus={event => { if (event.target.closest("a,button,summary,input,select,textarea")) tone(); }} onClick={event => { if ((event.target as HTMLElement).closest("a,button,summary")) tone(true); }} onPointerOver={event => { const target = (event.target as HTMLElement).closest("a,button,summary"); const previous = event.relatedTarget; if (target && (!(previous instanceof Node) || !target.contains(previous))) tone(); }}>
    <div className="ambient-stage" aria-hidden="true"><div className="ambient-orbit orbit-one" /><div className="ambient-orbit orbit-two" /><div className="ambient-core" /></div>
    <div className="route-surface" key={pathname}>{children}</div>
    <div className="experience-controls" aria-label="Preferências da experiência">
      <button type="button" aria-pressed={sound} onClick={toggleSound}>Som {sound ? "ligado" : "desligado"}</button>
      <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "Retomar movimento" : "Pausar movimento"}</button>
      {audioError && <span role="status">Áudio indisponível neste navegador.</span>}
    </div>
  </div>;
}
