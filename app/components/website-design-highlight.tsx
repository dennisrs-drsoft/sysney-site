import Link from "next/link";

const benefits = [
  ["Menor custo de produção", "A IA agiliza tarefas repetitivas de design e desenvolvimento, permitindo oferecer um preço mais acessível."],
  ["Qualidade com revisão humana", "A SYSNEY revisa o conteúdo, adapta o visual à sua marca e confere a navegação no celular antes da publicação."],
  ["Feito para gerar contatos", "Mostre o que você vende e facilite o próximo passo do visitante, com botão de WhatsApp ou formulário conforme o projeto."],
];

export function WebsiteDesignHighlight() {
  return (
    <section id="criacao-de-sites" aria-labelledby="website-design-title" className="scroll-mt-8 border-y border-cyan-300/15 bg-[#0c1c30] px-6 py-16 text-white sm:py-20 lg:px-10">
      <div className="mx-auto grid max-w-[1600px] items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Criação de sites com IA · SYSNEY</p>
          <h2 id="website-design-title" className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Seu site no ar em até <span className="text-cyan-300">3 dias úteis.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            A SYSNEY cria sites institucionais e páginas de divulgação com IA e revisão humana. Você ganha um site profissional, com entrega rápida e investimento mais acessível para começar a receber contatos.
          </p>
          <Link href="/contato?origem=criacao-de-sites&interesse=criacao-de-sites" className="mt-7 inline-flex rounded-full bg-emerald-400 px-6 py-4 text-center font-black text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300">
            Solicitar orçamento para meu site →
          </Link>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
            Prazo para projetos de escopo simples, após aprovação da proposta e recebimento dos materiais e acessos necessários à publicação.
          </p>
        </div>
        <ul className="grid gap-4">
          {benefits.map(([title, description]) => (
            <li key={title} className="rounded-2xl border border-cyan-300/20 bg-white/5 p-5 sm:p-6">
              <h3 className="font-black text-cyan-200">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
