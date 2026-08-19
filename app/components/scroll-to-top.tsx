"use client";

import { useEffect, useState } from "react";

export function ScrollToTop() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    let frame = 0;

    const atualizarVisibilidade = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setVisivel(window.scrollY > 500));
    };

    atualizarVisibilidade();
    window.addEventListener("scroll", atualizarVisibilidade, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", atualizarVisibilidade);
    };
  }, []);

  const voltarAoTopo = () => {
    const reduzirMovimento = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    window.scrollTo({
      top: 0,
      behavior: reduzirMovimento ? "auto" : "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={voltarAoTopo}
      aria-label="Voltar ao topo"
      aria-hidden={!visivel}
      tabIndex={visivel ? 0 : -1}
      className={`fixed bottom-24 right-5 z-50 grid h-11 w-11 place-items-center rounded-full border border-sky-300/40 bg-blue-600 text-white shadow-xl shadow-blue-950/30 transition duration-300 hover:-translate-y-1 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/60 sm:right-8 md:bottom-8 md:h-12 md:w-12 ${
        visivel
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="m6 15 6-6 6 6" />
      </svg>
    </button>
  );
}
