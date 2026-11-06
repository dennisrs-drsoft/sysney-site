import Image from "next/image";
import Link from "next/link";

export function WebsiteProjects() {
  return (
  <div className="mt-7 grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
    <figure className="min-w-0">
      <div className="screen-showcase links-screen" data-reveal="">
        <Image src="/cases/sysney/depois-final-largura-total.png" alt="Seção institucional da SYSNEY com o cisne e opções de contato" width={1905} height={1072} sizes="(min-width: 640px) 45vw, 90vw" />
      </div>
      <figcaption className="mt-4 text-sm text-slate-300"><strong className="text-white">SYSNEY</strong> · Site institucional de tecnologia</figcaption>
    </figure>
    <figure className="min-w-0">
      <Link href="https://meihcarvalho.com.br/" className={`block screen-showcase links-screen focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300`} data-reveal="">
        <Image src="/cases/sysney/meih-carvalho.png" alt="Conheça o portfólio de fotografia da Meih Carvalho" width={1400} height={780} sizes="(min-width: 640px) 45vw, 90vw" />
      </Link>
      <figcaption className="mt-4 text-sm text-slate-300"><strong className="text-white">Meih Carvalho</strong> · Portfólio de fotografia</figcaption>
    </figure>
    <figure className="min-w-0">
      <Link href="https://agoratemplay.com.br/" className="block screen-showcase links-screen focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" data-reveal="">
        <Image src="/cases/sysney/agora-tem-play.png" alt="Agora Tem Play com busca de arenas de beach tennis por local e horário" width={1905} height={938} sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 90vw" />
      </Link>
      <figcaption className="mt-4 text-sm text-slate-300">
        <strong className="text-white">Agora Tem Play</strong> · Plataforma de beach tennis
        <span className="mt-1 block">Encontre arenas, jogos, aulas e campeonatos perto de você.</span>
      </figcaption>
    </figure>
  </div>
  );
}
