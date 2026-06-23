import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Manual de Confirmação pelo WhatsApp | SISBlink",
  description:
    "Manual visual para confirmação e reabertura de pedidos pelo WhatsApp no SISBlink.",
};

const confirmacao = [
  {
    numero: "1",
    titulo: "Confirmar envio",
    texto: "No SISBlink, confirme o envio do pedido para aprovação via WhatsApp.",
    imagem: "/imagens/manual/01-confirmar-envio.png",
  },
  {
    numero: "2",
    titulo: "Pedido aguardando aprovação",
    texto: "O pedido fica pendente até o cliente aprovar pelo WhatsApp.",
    imagem: "/imagens/manual/02-pedido-enviado.png",
  },
  {
    numero: "3",
    titulo: "Mensagem recebida",
    texto: "O cliente recebe o resumo do pedido e o PDF completo em anexo.",
    imagem: "/imagens/manual/03-whatsapp-pedido.png",
  },
  {
    numero: "4",
    titulo: "Responder aprovação",
    texto: "Se estiver correto, responda exatamente no formato abaixo.",
    comando: "APROVADO 328875",
    imagem: "/imagens/manual/04-resposta-aprovado.png",
  },
  {
    numero: "5",
    titulo: "Confirmação processada",
    texto: "O pedido é confirmado automaticamente e registrado no sistema.",
    imagem: "/imagens/manual/05-pedido-confirmado-whatsapp.png",
  },
  {
    numero: "6",
    titulo: "Status atualizado",
    texto: "No painel do SISBlink, o pedido aparece como confirmado.",
    imagem: "/imagens/manual/06-pedido-confirmado-sistema.png",
  },
];

const reabertura = [
  {
    numero: "1",
    titulo: "Solicitar reabertura",
    texto: "Envie a solicitação pelo WhatsApp informando pedido e marca.",
    comando: "REABRIR PEDIDO 328875 DA MARCA LEVIS",
    imagem: "/imagens/manual/07-reabrir-pedido.png",
  },
  {
    numero: "2",
    titulo: "Pedido localizado",
    texto: "O sistema mostra os dados do pedido e solicita o CNPJ completo do cliente.",
    imagem: "/imagens/manual/08-pedido-localizado.png",
  },
  {
    numero: "3",
    titulo: "Validar CNPJ",
    texto: "Responda informando o CNPJ completo do cliente vinculado ao pedido.",
    comando: "CNPJ 00.001.000/0001-00",
    imagem: "/imagens/manual/09-validar-cnpj.png",
  },
  {
    numero: "4",
    titulo: "Confirmar com token",
    texto: "Após validar o CNPJ, responda exatamente com o código de segurança recebido.",
    comando: "REABRIR 328875 1007",
    imagem: "/imagens/manual/10-token-reabertura.png",
  },
  {
    numero: "5",
    titulo: "Pedido reaberto",
    texto: "O sistema confirma a reabertura e altera o status do pedido para aberto.",
    imagem: "/imagens/manual/11-pedido-reaberto.png",
  },
  {
    numero: "6",
    titulo: "Comprovante",
    texto: "O comprovante registra as validações, datas, mensagens e status atualizado.",
    imagem: "/imagens/manual/12-comprovante-reabertura.png",
  },
];

export default function ManualConfirmacaoWhatsAppPage() {
  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#13213a_0,#070b14_42%)]" />

        <div className="relative mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <header className="flex items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-4">
              <Image
                src="/logo.png"
                alt="SYSNEY Informática"
                width={160}
                height={160}
                priority
                className="h-auto w-28 md:w-32"
              />
              <div className="hidden sm:block">
                <p className="text-2xl font-black text-blue-400">SISBLINK</p>
                <p className="text-xs uppercase tracking-[0.3em] text-sky-300">
                  Manual Visual
                </p>
              </div>
            </Link>

            <Link
              href="/contato"
              className="rounded-full bg-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
            >
              Falar com suporte
            </Link>
          </header>

          <section className="mt-12 rounded-[28px] border border-[#24314d] bg-gradient-to-br from-[#0d1424] to-[#09101f] p-8 shadow-2xl shadow-black/30 md:p-10">
            <span className="inline-flex rounded-full border border-[#38d5c6]/40 bg-[#38d5c6]/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#38d5c6]">
              SISBlink • Manual Visual
            </span>

            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
              Confirmação e Reabertura de Pedidos pelo WhatsApp
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              Aprenda como confirmar pedidos enviados pelo SISBlink e como
              solicitar a reabertura com segurança, rastreabilidade e comprovante
              eletrônico.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ["WhatsApp", "Confirmação rápida pelo cliente."],
                ["PDF", "Pedido completo anexado à mensagem."],
                ["Comprovante", "Registro eletrônico da operação."],
              ].map(([titulo, texto]) => (
                <div
                  key={titulo}
                  className="rounded-2xl border border-[#24314d] bg-white/5 p-5"
                >
                  <strong className="block text-2xl text-white">{titulo}</strong>
                  <p className="mt-2 text-slate-400">{texto}</p>
                </div>
              ))}
            </div>
          </section>

          <ManualSection
            titulo="1. Confirmação de pedido"
            subtitulo="Fluxo para o cliente aprovar o pedido recebido pelo WhatsApp."
            passos={confirmacao}
          />

          <ManualSection
            titulo="2. Reabertura de pedido pelo WhatsApp"
            subtitulo="Fluxo seguro para solicitar reabertura, validar CNPJ e confirmar com token."
            passos={reabertura}
          />

          <div className="mt-8 rounded-3xl border border-[#38d5c6]/30 bg-[#38d5c6]/10 p-6 text-[#c9fff8]">
            As imagens possuem dados fictícios no manual, para a confirmação e reabertura de pedidos, utilizem os dados reais recebidos através do WhatsApp.
          </div>

          <footer className="py-10 text-center text-sm text-slate-400">
            SYSNEY Informática • SISBlink - Plataforma B2B para moda.
          </footer>
        </div>
      </section>
    </main>
  );
}

function ManualSection({
  titulo,
  subtitulo,
  passos,
}: {
  titulo: string;
  subtitulo: string;
  passos: {
    numero: string;
    titulo: string;
    texto: string;
    imagem: string;
    comando?: string;
  }[];
}) {
  return (
    <section className="mt-8 rounded-[24px] border border-[#24314d] bg-[#0d1424]/90 p-6 md:p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight">{titulo}</h2>
        <p className="mt-2 text-slate-400">{subtitulo}</p>
      </div>

      <div className="space-y-6">
        {passos.map((passo, index) => (
          <article
            key={`${passo.numero}-${passo.titulo}`}
            className={`grid items-center gap-6 rounded-[22px] border border-[#24314d] bg-white/[0.035] p-5 md:grid-cols-[0.9fr_1.1fr] md:p-6 ${
              index % 2 === 1 ? "md:[&>div:first-child]:order-2" : ""
            }`}
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#38d5c6] to-[#5b8cff] font-black text-[#06101f]">
                {passo.numero}
              </div>

              <h3 className="mt-5 text-2xl font-black">{passo.titulo}</h3>

              <p className="mt-3 leading-8 text-slate-300">{passo.texto}</p>

              {passo.comando && <Command>{passo.comando}</Command>}
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#2d3b5b] bg-white">
              <Image
                src={passo.imagem}
                alt={passo.titulo}
                width={1200}
                height={800}
                className="h-auto w-full"
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Command({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-5 inline-block rounded-xl border border-[#38d5c6]/50 bg-[#06101f] px-5 py-3 font-black tracking-wide text-[#38d5c6]">
      {children}
    </span>
  );
}