import Link from "next/link";

export const metadata = {
  title: "Tutorial de Confirmação de Pedido | SISBlink",
  description:
    "Tutorial para confirmação e abertura de pedidos pelo WhatsApp no SISBlink.",
};

export default function TutorialConfirmacaoPedidoPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800">
      <section className="mx-auto max-w-4xl rounded-[18px] bg-white p-7 shadow-2xl shadow-slate-300/60 md:p-11">
        <header className="mb-8 border-b border-slate-200 pb-6">
          <span className="mb-4 inline-block rounded-full bg-sky-100 px-4 py-1.5 text-sm font-bold text-sky-700">
            SISBlink • Tutorial rápido
          </span>

          <h1 className="text-3xl font-black leading-tight text-slate-950 md:text-4xl">
            Confirmação e Abertura de Pedidos pelo WhatsApp
          </h1>

          <p className="mt-4 text-slate-500">
            Guia rápido para representantes e clientes confirmarem pedidos de
            forma segura pelo WhatsApp.
          </p>
        </header>

        <TutorialSection title="1. Recebimento do pedido">
          <p>Você receberá uma mensagem oficial do SISBlink em seu WhatsApp contendo:</p>

          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>Resumo do pedido;</li>
            <li>Número do pedido;</li>
            <li>Data de emissão;</li>
            <li>Quantidade total;</li>
            <li>Valor total;</li>
            <li>PDF completo do pedido em anexo.</li>
          </ul>

          <InfoBox>
            Antes de confirmar, leia o PDF completo e confira produtos,
            quantidades, valores, prazos de entrega e demais informações comerciais.
          </InfoBox>
        </TutorialSection>

        <TutorialSection title="2. Como confirmar o pedido">
          <p>Se todas as informações estiverem corretas, responda a mensagem recebida com:</p>

          <Command>APROVADO 123456</Command>

          <p>
            Substitua <strong>123456</strong> pelo número do seu pedido.
          </p>

          <InfoBox variant="success">
            <strong>Exemplo:</strong>
            <br />
            Se o pedido for <strong>165909</strong>, responda:
            <br />
            <Command>APROVADO 165909</Command>
          </InfoBox>

          <p>Após a confirmação:</p>

          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>O pedido será confirmado automaticamente;</li>
            <li>O sistema registrará a data e hora da aprovação;</li>
            <li>Será gerado um comprovante eletrônico da confirmação.</li>
          </ul>
        </TutorialSection>

        <TutorialSection title="3. Caso exista alguma divergência">
          <InfoBox variant="warning">
            Se houver divergência em produtos, quantidades, valores, condições
            comerciais ou prazos, <strong>não responda APROVADO</strong>.
          </InfoBox>

          <p>
            Entre em contato com seu gerente comercial para realizar os ajustes
            necessários antes da confirmação.
          </p>
        </TutorialSection>

        <TutorialSection title="4. Como abrir novamente o pedido">
          <p>
            Caso seja necessário alterar um pedido já confirmado, entre em
            contato com seu gerente comercial e solicite a reabertura.
          </p>

          <p className="mt-4">Após a reabertura:</p>

          <ol className="mt-4 list-decimal space-y-2 pl-6">
            <li>O pedido ficará disponível novamente para edição;</li>
            <li>As alterações poderão ser realizadas;</li>
            <li>Um novo PDF será gerado;</li>
            <li>Uma nova solicitação de confirmação poderá ser enviada ao WhatsApp.</li>
          </ol>
        </TutorialSection>

        <TutorialSection title="5. Segurança">
          <InfoBox variant="security">
            As mensagens são enviadas por um canal oficial do SISBlink. A
            confirmação realizada através da resposta{" "}
            <strong>APROVADO + Número do Pedido</strong> é registrada pelo sistema.
          </InfoBox>

          <p>O sistema registra:</p>

          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>Número do telefone utilizado;</li>
            <li>Data e hora da confirmação;</li>
            <li>Conteúdo da resposta;</li>
            <li>Comprovante eletrônico da operação.</li>
          </ul>

          <p className="mt-4">
            Esses registros garantem maior segurança e rastreabilidade para
            todas as partes envolvidas.
          </p>
        </TutorialSection>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
          <p>SISBlink • Confirmação digital de pedidos</p>
          <Link href="/" className="mt-3 inline-block font-bold text-blue-600 hover:text-blue-500">
            Voltar para o site
          </Link>
        </footer>
      </section>
    </main>
  );
}

function TutorialSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="mb-4 border-l-4 border-blue-600 pl-3 text-2xl font-black text-slate-950">
        {title}
      </h2>
      <div className="leading-8 text-slate-700">{children}</div>
    </section>
  );
}

function InfoBox({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "security";
}) {
  const styles = {
    default: "border-slate-200 bg-slate-50",
    success: "border-emerald-200 bg-emerald-50",
    warning: "border-amber-200 bg-amber-50",
    security: "border-indigo-200 bg-indigo-50",
  };

  return (
    <div className={`my-6 rounded-2xl border p-5 ${styles[variant]}`}>
      {children}
    </div>
  );
}

function Command({ children }: { children: React.ReactNode }) {
  return (
    <span className="my-3 inline-block rounded-xl bg-slate-950 px-5 py-3 text-lg font-black tracking-wide text-white">
      {children}
    </span>
  );
}