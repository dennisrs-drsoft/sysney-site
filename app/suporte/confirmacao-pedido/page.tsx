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

        <TutorialSection title="5. Como solicitar a reabertura do pedido pelo WhatsApp">
          <p>
            Para solicitar a reabertura de um pedido pelo WhatsApp,
            envie a mensagem no seguinte formato:
          </p>

          <Command>
            REABRIR PEDIDO 123456 DA MARCA SYSNEY
          </Command>

          <p>
            Substitua <strong>123456</strong> pelo número do pedido e
            <strong> SYSNEY </strong>
            pela marca em que o pedido foi realizado no SISBlink.
          </p>

          <InfoBox>
            <strong>Exemplo:</strong>
            <br />
            Se o pedido for <strong>123456</strong> e a marca for
            <strong>MARCA_EXEMPLO</strong>, envie:
            <br />
            <br />
            <Command>
              REABRIR PEDIDO 123456 DA MARCA MARCA_EXEMPLO
            </Command>
          </InfoBox>

          <p>
            Se o pedido for localizado, você receberá uma mensagem semelhante a esta:
          </p>

          <InfoBox>

            Localizamos o pedido informado.

            <br /><br />

            Pedido: 123456
            <br />
            Marca: SYSNEY
            <br />
            Cliente: LOJA 01 CLIENTE
            <br />
            CNPJ cadastrado: 01.001.***/**-00
            <br />
            Qtde: 398
            <br />
            Valor: R$ 69.495,18
            <br />
            Status atual: CONFIRMADO

            <br /><br />

            Para continuar com segurança,
            responda com o CNPJ completo do cliente.

            <br />

            Exemplo:

            CNPJ 00.000.000/0000-00

          </InfoBox>

          <p>
            Depois disso, responda informando o CNPJ completo do cliente:
          </p>

          <Command>
            CNPJ 00.001.000/0001-00
          </Command>

          <p>
            O CNPJ acima é apenas um exemplo.
            Informe o CNPJ correto do cliente vinculado ao pedido.
          </p>

          <p>
            Se o CNPJ for validado, você receberá uma nova mensagem de segurança:
          </p>

          <InfoBox variant="success">

            CNPJ validado com sucesso.

            <br /><br />

            Para confirmar a reabertura do pedido,
            responda exatamente:

            <br /><br />

            <strong>
              REABRIR 12345 1007
            </strong>

            <br /><br />

            Código válido por 30 minutos.

          </InfoBox>

          <p>
            O número <strong>1007</strong> é um token de segurança
            gerado automaticamente.

            Você deve responder exatamente como foi enviado.
          </p>

          <Command>
            REABRIR 12345 1007
          </Command>

          <p>
            Se todas as informações estiverem corretas,
            você receberá a confirmação:
          </p>

          <InfoBox variant="success">

            Solicitação validada.

            O pedido 123456 será reaberto em instantes.

          </InfoBox>

          <p>
            Em seguida, após a reabertura,
            será enviada a mensagem final:
          </p>

          <InfoBox variant="success">

            Pedido 123456 reaberto com sucesso.

            <br />

            Status atual: ABERTO.

            <br /><br />

            Comprovante da reabertura:

            <br />

            https://levis.sisfast.com/dl/comprovante.pdf.ashx?t=.....

          </InfoBox>

          <InfoBox variant="warning">

            Por segurança, o código de confirmação
            é válido por tempo limitado.

            Caso expire, será necessário iniciar uma
            nova solicitação de reabertura.

          </InfoBox>

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