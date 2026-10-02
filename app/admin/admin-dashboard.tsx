"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type EmpresaId = "drsoft" | "sysney";
type SecaoId = "visao-geral" | "nova-emissao" | "clientes" | "documentos";

const empresas = {
  drsoft: {
    nome: "DRSOFT",
    razaoSocial: "DRSOFT",
    regime: "Lucro Presumido",
    destaque: "text-sky-300",
  },
  sysney: {
    nome: "SYSNEY",
    razaoSocial: "SYSNEY Informática",
    regime: "Simples Nacional",
    destaque: "text-emerald-300",
  },
} satisfies Record<
  EmpresaId,
  { nome: string; razaoSocial: string; regime: string; destaque: string }
>;

const secoes: { id: SecaoId; label: string }[] = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "nova-emissao", label: "Nova emissão" },
  { id: "clientes", label: "Clientes" },
  { id: "documentos", label: "Documentos" },
];

const camposBase =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

function StatusIntegracao({
  titulo,
  texto,
}: {
  titulo: string;
  texto: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_0_4px_#fef3c7]" />
      <div>
        <p className="text-sm font-black text-slate-900">{titulo}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{texto}</p>
      </div>
    </div>
  );
}

function VisaoGeral({ empresaId }: { empresaId: EmpresaId }) {
  const empresa = empresas[empresaId];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["NFS-e emitidas", "0", "Neste mês"],
          ["A receber", "R$ 0,00", "Cobranças abertas"],
          ["Recebido", "R$ 0,00", "Neste mês"],
          ["Vencidas", "0", "Exigem acompanhamento"],
        ].map(([label, value, detail]) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
            <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              {value}
            </p>
            <p className="mt-1 text-sm text-slate-500">{detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              Operação selecionada
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  {empresa.razaoSocial}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{empresa.regime}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                Ambiente em preparação
              </span>
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-lg font-black text-slate-950">
              Próximos passos da configuração
            </h3>
            <div className="mt-5 space-y-3">
              {[
                "Autorizar somente o usuário administrador",
                "Conectar o certificado fiscal pelo cofre seguro",
                "Validar a integração de cobrança no ambiente de testes",
                "Homologar serviço, alíquota e retenções com a contabilidade",
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex items-center gap-4 rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xs font-black text-blue-700">
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
            Integrações
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Estado dos serviços
          </h2>
          <div className="mt-5 space-y-3">
            <StatusIntegracao
              titulo="NFS-e paulistana"
              texto="Aguardando certificado e parâmetros fiscais no ambiente seguro."
            />
            <StatusIntegracao
              titulo="Inter Empresas"
              texto="Integração criada; credenciais ainda não vinculadas ao servidor."
            />
            <StatusIntegracao
              titulo="Armazenamento"
              texto="Banco de dados e arquivos fiscais ainda não provisionados."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function NovaEmissao({ empresaId }: { empresaId: EmpresaId }) {
  const empresa = empresas[empresaId];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <form
        onSubmit={(event) => event.preventDefault()}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              Nova emissão
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Nota de serviço e cobrança
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Emitente: {empresa.razaoSocial} · {empresa.regime}
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
            Rascunho
          </span>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            Cliente
            <input
              className={camposBase}
              placeholder="Nome ou razão social"
              autoComplete="organization"
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            CPF ou CNPJ
            <input className={camposBase} placeholder="Somente números" inputMode="numeric" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            E-mail para envio
            <input
              className={camposBase}
              placeholder="financeiro@cliente.com.br"
              type="email"
              autoComplete="email"
            />
          </label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            Discriminação do serviço
            <textarea
              className={`${camposBase} min-h-28 resize-y`}
              placeholder="Descreva claramente o serviço prestado e o período de referência."
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Código do serviço
            <input className={camposBase} placeholder="Definido com a contabilidade" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Competência
            <input className={camposBase} type="date" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Valor do serviço
            <input className={camposBase} placeholder="R$ 0,00" inputMode="decimal" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Vencimento da cobrança
            <input className={camposBase} type="date" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Alíquota de ISS
            <input className={camposBase} placeholder="0,00%" inputMode="decimal" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Retenção
            <select className={camposBase} defaultValue="sem-retencao">
              <option value="sem-retencao">Sem retenção</option>
              <option value="com-retencao">Com retenção</option>
            </select>
          </label>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-full border border-slate-200 px-6 py-3 text-sm font-black text-slate-400"
          >
            Salvar rascunho
          </button>
          <button
            type="submit"
            disabled
            className="cursor-not-allowed rounded-full bg-blue-300 px-6 py-3 text-sm font-black text-white"
          >
            Emitir NFS-e e cobrança
          </button>
        </div>
        <p className="mt-3 text-right text-xs text-slate-400">
          Os botões serão liberados somente após homologação e armazenamento seguro.
        </p>
      </form>

      <aside className="space-y-4">
        <div className="rounded-3xl bg-[#07111f] p-6 text-white shadow-xl shadow-slate-300/40">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">
            Fluxo protegido
          </p>
          <h3 className="mt-3 text-xl font-black">Uma ação, duas integrações.</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Depois da homologação, o sistema validará os dados, emitirá a NFS-e,
            gerará a cobrança no Inter e enviará os documentos ao cliente.
          </p>
        </div>
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
          <p className="font-black text-blue-900">Validação contábil</p>
          <p className="mt-2 text-sm leading-6 text-blue-900/70">
            Código do serviço, ISS, retenções e texto fiscal serão configurados
            individualmente para cada empresa antes da primeira emissão real.
          </p>
        </div>
      </aside>
    </div>
  );
}

function EstadoVazio({
  titulo,
  texto,
  acao,
}: {
  titulo: string;
  texto: string;
  acao: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-black text-blue-700">
        +
      </span>
      <h2 className="mt-5 text-2xl font-black text-slate-950">{titulo}</h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-500">{texto}</p>
      <button
        type="button"
        disabled
        className="mt-6 cursor-not-allowed rounded-full bg-slate-200 px-6 py-3 text-sm font-black text-slate-500"
      >
        {acao}
      </button>
    </section>
  );
}

export function AdminDashboard() {
  const [empresaId, setEmpresaId] = useState<EmpresaId>("drsoft");
  const [secao, setSecao] = useState<SecaoId>("visao-geral");
  const empresa = empresas[empresaId];

  const conteudo = useMemo(() => {
    if (secao === "nova-emissao") return <NovaEmissao empresaId={empresaId} />;
    if (secao === "clientes") {
      return (
        <EstadoVazio
          titulo="Nenhum cliente cadastrado"
          texto="Os dados de clientes serão armazenados de forma segura e poderão ser reutilizados em novas notas e cobranças."
          acao="Cadastrar primeiro cliente"
        />
      );
    }
    if (secao === "documentos") {
      return (
        <EstadoVazio
          titulo="Nenhum documento emitido"
          texto="NFS-e, XML, boletos, comprovantes e eventos de pagamento aparecerão aqui, separados por empresa."
          acao="Criar primeira emissão"
        />
      );
    }
    return <VisaoGeral empresaId={empresaId} />;
  }, [empresaId, secao]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="bg-[#07111f] text-white">
        <div className="mx-auto max-w-[1600px] px-5 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                <Image
                  src="/logo.png"
                  alt="SYSNEY Informática"
                  width={120}
                  height={120}
                  className="h-auto w-20"
                  priority
                />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-300">
                  Área privada
                </p>
                <h1 className="mt-1 text-xl font-black sm:text-2xl">
                  Administração financeira
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-1">
                {(Object.keys(empresas) as EmpresaId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEmpresaId(id)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                      empresaId === id
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {empresas[id].nome}
                  </button>
                ))}
              </div>
              <a
                href="/.auth/logout?post_logout_redirect_uri=/"
                className="hidden rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white sm:block"
              >
                Sair
              </a>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
            <div>
              <p className={`text-sm font-black ${empresa.destaque}`}>{empresa.nome}</p>
              <p className="text-xs text-slate-400">{empresa.regime}</p>
            </div>
            <div className="flex h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_12px_#fcd34d]" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-6 lg:px-8 lg:py-8">
        <nav className="mb-6 flex gap-2 overflow-x-auto pb-2" aria-label="Administração">
          {secoes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSecao(item.id)}
              className={`shrink-0 rounded-full px-5 py-3 text-sm font-black transition ${
                secao === item.id
                  ? "bg-slate-950 text-white shadow-lg shadow-slate-300"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {conteudo}
      </div>
    </main>
  );
}
