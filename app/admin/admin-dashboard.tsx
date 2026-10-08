"use client";

import { AdminShell } from "./admin-shell";
import { VisaoFinanceira } from "./visao-financeira";
import { Cobrancas } from "./cobrancas";
import { FilaCobrancas } from "./fila-cobrancas";
import { LaboratorioEmails } from "./laboratorio-emails";
import { lerRespostaAdmin } from "@/lib/admin-resposta";
import { HistoricoInter } from "./historico-inter";
import { HistoricoFiscal } from "./historico-fiscal";
import { NfseNacional } from "./nfse-nacional";
import { Aprovacoes } from "./aprovacoes";
import {MensagemAdmin} from "./dialogos-admin";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type EmpresaId = "drsoft" | "sysney";
type SecaoId = "visao-geral" | "nova-emissao" | "clientes" | "documentos" | "cobrancas" | "acompanhamento" | "emails" | "historico-inter" | "historico-fiscal" | "nfse-nacional" | "aprovacoes";

type Cliente = {
  id: string;
  empresaId: EmpresaId;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  criadoEm: string;
  origem?: string;
};

type RespostaClientes = {
  clientes?: Cliente[];
  erro?: string;
};

type Rascunho = {
  id: string;
  empresaId: EmpresaId;
  clienteId: string | null;
  clienteNome: string;
  clienteDocumento: string;
  clienteEmail: string;
  descricao: string;
  codigoServico: string;
  competencia: string;
  valor: number;
  vencimento: string;
  aliquota: string;
  retencao: "sem-retencao" | "com-retencao";
  gerarCobranca: boolean;
  criadoEm: string;
};

type FormularioEmissao = Omit<
  Rascunho,
  "id" | "empresaId" | "clienteId" | "valor" | "criadoEm"
> & {
  clienteId: string;
  valor: string;
};

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
  { id: "cobrancas", label: "Fila de cobranças" },
  { id: "acompanhamento", label: "Acompanhamento e recorrências" },
  { id: "aprovacoes", label: "Aprovar emissão" },
  { id: "emails", label: "Laboratório de e-mails" },
  { id: "historico-inter", label: "Histórico do Inter" },
  { id: "historico-fiscal", label: "Notas antigas e XML" },
  { id: "nfse-nacional", label: "NFS-e Nacional" },
  { id: "nova-emissao", label: "Nova emissão" },
  { id: "clientes", label: "Clientes" },
  { id: "documentos", label: "Documentos" },
];

const CHAVE_CLIENTES = "sisblink-admin-clientes-v1";
const CHAVE_RASCUNHOS = "sisblink-admin-rascunhos-v1";
const campo =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function idLocal() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function lerLocal<T>(chave: string): T[] {
  try {
    const valor = window.localStorage.getItem(chave);
    const lista = valor ? (JSON.parse(valor) as unknown) : [];
    return Array.isArray(lista) ? (lista as T[]) : [];
  } catch {
    return [];
  }
}

function numeroMonetario(valor: string) {
  const normalizado = valor
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function dataBr(valor: string) {
  if (!valor) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${valor}T00:00:00Z`)
  );
}

function formularioVazio(): FormularioEmissao {
  return {
    clienteId: "",
    clienteNome: "",
    clienteDocumento: "",
    clienteEmail: "",
    descricao: "",
    codigoServico: "",
    competencia: "",
    valor: "",
    vencimento: "",
    aliquota: "",
    retencao: "sem-retencao",
    gerarCobranca: true,
  };
}


function CadastroClientes({
  empresaId,
  clientes,
  salvar,
  atualizando,
  erroAtualizacao,
  atualizar,
}: {
  empresaId: EmpresaId;
  clientes: Cliente[];
  salvar: (cliente: Cliente) => void;
  atualizando: boolean;
  erroAtualizacao: string;
  atualizar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    salvar({
      id: idLocal(),
      empresaId,
      nome: nome.trim(),
      documento: documento.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
      criadoEm: new Date().toISOString(),
    });
    setNome("");
    setDocumento("");
    setEmail("");
    setTelefone("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form
        onSubmit={enviar}
        className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
          Cadastro local
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Novo cliente</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Os dados ficarão somente neste navegador durante os testes.
        </p>
        <div className="mt-6 space-y-5">
          <label className="block text-sm font-bold text-slate-700">
            Nome ou razão social
            <input
              className={campo}
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            CPF ou CNPJ
            <input
              className={campo}
              value={documento}
              onChange={(event) => setDocumento(event.target.value)}
              inputMode="numeric"
              required
            />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            E-mail financeiro
            <input
              className={campo}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
            />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Telefone
            <input
              className={campo}
              value={telefone}
              onChange={(event) => setTelefone(event.target.value)}
              type="tel"
              placeholder="(11) 00000-0000"
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-6 w-full rounded-full bg-blue-600 px-6 py-3 text-sm font-black text-white hover:bg-blue-700"
        >
          Salvar cliente
        </button>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              Carteira da empresa
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Clientes cadastrados
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
              {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
            </span>
            <button
              type="button"
              onClick={atualizar}
              disabled={atualizando}
              className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-black text-blue-700 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
            >
              {atualizando ? "Atualizando..." : "Atualizar lista"}
            </button>
          </div>
        </div>

        <MensagemAdmin mensagem={erroAtualizacao} aoFechar={()=>{}} titulo="Lista de clientes indisponível" subtitulo="A consulta aos clientes não foi concluída" tom="erro" acao={atualizar} rotuloAcao="Atualizar lista"/>

        {clientes.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="font-black text-slate-800">Nenhum cliente cadastrado</p>
            <p className="mt-2 text-sm text-slate-500">
              Use o formulário ao lado para iniciar o teste.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {clientes.map((cliente) => (
              <article
                key={cliente.id}
                className="rounded-2xl border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-950">{cliente.nome}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {cliente.documento}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {cliente.origem === "inter-cobrancas" ? "Banco Inter" : "Local"}
                  </span>
                </div>
                <div className="mt-4 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                  <p>{cliente.email}</p>
                  <p>{cliente.telefone || "Telefone não informado"}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NovaEmissao({
  empresaId,
  clientes,
  salvar,
  cadastrarCliente,
}: {
  empresaId: EmpresaId;
  clientes: Cliente[];
  salvar: (rascunho: Rascunho) => void;
  cadastrarCliente: () => void;
}) {
  const empresa = empresas[empresaId];
  const [dados, setDados] = useState<FormularioEmissao>(formularioVazio);

  function atualizar(
    nome: keyof FormularioEmissao,
    valor: string | boolean
  ) {
    setDados((atual) => ({ ...atual, [nome]: valor }));
  }

  function escolherCliente(clienteId: string) {
    const cliente = clientes.find((item) => item.id === clienteId);
    setDados((atual) => ({
      ...atual,
      clienteId,
      clienteNome: cliente?.nome ?? "",
      clienteDocumento: cliente?.documento ?? "",
      clienteEmail: cliente?.email ?? "",
    }));
  }

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valor = numeroMonetario(dados.valor);
    if (valor <= 0) return;
    salvar({
      ...dados,
      id: idLocal(),
      empresaId,
      clienteId: dados.clienteId || null,
      valor,
      criadoEm: new Date().toISOString(),
    });
    setDados(formularioVazio());
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <form
        onSubmit={enviar}
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
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            Rascunho local
          </span>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            Cliente cadastrado
            <select
              className={campo}
              value={dados.clienteId}
              onChange={(event) => escolherCliente(event.target.value)}
            >
              <option value="">Preencher manualmente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome} · {cliente.documento}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            Nome ou razão social
            <input
              className={campo}
              value={dados.clienteNome}
              onChange={(event) => atualizar("clienteNome", event.target.value)}
              required
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            CPF ou CNPJ
            <input
              className={campo}
              value={dados.clienteDocumento}
              onChange={(event) =>
                atualizar("clienteDocumento", event.target.value)
              }
              inputMode="numeric"
              required
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            E-mail para envio
            <input
              className={campo}
              value={dados.clienteEmail}
              onChange={(event) => atualizar("clienteEmail", event.target.value)}
              type="email"
              required
            />
          </label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            Discriminação do serviço
            <textarea
              className={`${campo} min-h-28 resize-y`}
              value={dados.descricao}
              onChange={(event) => atualizar("descricao", event.target.value)}
              placeholder="Descreva o serviço e o período de referência."
              required
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Código do serviço
            <input
              className={campo}
              value={dados.codigoServico}
              onChange={(event) =>
                atualizar("codigoServico", event.target.value)
              }
              placeholder="Definido com a contabilidade"
              required
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Competência
            <input
              className={campo}
              value={dados.competencia}
              onChange={(event) => atualizar("competencia", event.target.value)}
              type="date"
              required
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Valor do serviço
            <input
              className={campo}
              value={dados.valor}
              onChange={(event) => atualizar("valor", event.target.value)}
              placeholder="R$ 0,00"
              inputMode="decimal"
              required
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Vencimento da cobrança
            <input
              className={campo}
              value={dados.vencimento}
              onChange={(event) => atualizar("vencimento", event.target.value)}
              type="date"
              required={dados.gerarCobranca}
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Alíquota de ISS
            <input
              className={campo}
              value={dados.aliquota}
              onChange={(event) => atualizar("aliquota", event.target.value)}
              placeholder="0,00%"
              inputMode="decimal"
              required
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Retenção
            <select
              className={campo}
              value={dados.retencao}
              onChange={(event) =>
                atualizar(
                  "retencao",
                  event.target.value as FormularioEmissao["retencao"]
                )
              }
            >
              <option value="sem-retencao">Sem retenção</option>
              <option value="com-retencao">Com retenção</option>
            </select>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={dados.gerarCobranca}
              onChange={(event) =>
                atualizar("gerarCobranca", event.target.checked)
              }
              className="mt-0.5 h-4 w-4 accent-blue-600"
            />
            <span>
              Preparar cobrança junto com a nota
              <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                A opção será registrada no rascunho; nenhum boleto ou Pix será criado.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          {clientes.length === 0 && (
            <button
              type="button"
              onClick={cadastrarCliente}
              className="rounded-full border border-slate-200 px-6 py-3 text-sm font-black text-slate-700 hover:border-blue-300 hover:text-blue-700"
            >
              Cadastrar cliente
            </button>
          )}
          <button
            type="submit"
            className="rounded-full bg-blue-600 px-6 py-3 text-sm font-black text-white hover:bg-blue-700"
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-full bg-slate-200 px-6 py-3 text-sm font-black text-slate-400"
          >
            Emitir NFS-e e cobrança
          </button>
        </div>
        <p className="mt-3 text-right text-xs text-slate-400">
          A emissão real será liberada somente após homologação fiscal e bancária.
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
            por empresa antes da primeira emissão real.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ListaRascunhos({
  rascunhos,
  criar,
}: {
  rascunhos: Rascunho[];
  criar: () => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
            Documentos
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Rascunhos preparados
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Nenhum item possui validade fiscal ou bancária nesta etapa.
          </p>
        </div>
        <button
          type="button"
          onClick={criar}
          className="rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700"
        >
          Nova emissão
        </button>
      </div>

      {rascunhos.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
          <p className="font-black text-slate-800">Nenhum rascunho preparado</p>
          <p className="mt-2 text-sm text-slate-500">
            Crie uma emissão de teste para validar o fluxo e os campos.
          </p>
        </div>
      ) : (
        <div className="mt-7 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Competência</th>
                <th className="px-3 py-3">Valor</th>
                <th className="px-3 py-3">Cobrança</th>
                <th className="px-3 py-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {rascunhos.map((rascunho) => (
                <tr key={rascunho.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-4">
                    <p className="font-black text-slate-900">
                      {rascunho.clienteNome}
                    </p>
                    <p className="mt-1 max-w-sm truncate text-xs text-slate-500">
                      {rascunho.descricao}
                    </p>
                  </td>
                  <td className="px-3 py-4 text-slate-600">
                    {dataBr(rascunho.competencia)}
                  </td>
                  <td className="px-3 py-4 font-black text-slate-900">
                    {moeda.format(rascunho.valor)}
                  </td>
                  <td className="px-3 py-4 text-slate-600">
                    {rascunho.gerarCobranca
                      ? `Preparar · ${dataBr(rascunho.vencimento)}`
                      : "Não solicitada"}
                  </td>
                  <td className="px-3 py-4">
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                      Rascunho local
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function AdminDashboard() {
  const [empresaId, setEmpresaId] = useState<EmpresaId>("drsoft");
  const [secao, setSecao] = useState<SecaoId>("visao-geral");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesAzure, setClientesAzure] = useState<Cliente[]>([]);
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [atualizandoClientes, setAtualizandoClientes] = useState(false);
  const [erroClientes, setErroClientes] = useState("");
  const [aviso, setAviso] = useState("");
  const empresa = empresas[empresaId];

  useEffect(() => {
    const quadro = window.requestAnimationFrame(() => {
      setClientes(lerLocal<Cliente>(CHAVE_CLIENTES));
      setRascunhos(lerLocal<Rascunho>(CHAVE_RASCUNHOS));
      setCarregado(true);
    });

    return () => window.cancelAnimationFrame(quadro);
  }, []);

  const carregarClientesAzure = useCallback(async () => {
    setAtualizandoClientes(true);
    setErroClientes("");
    try {
      const resposta = await fetch(`/api/admin/clientes?empresa=${empresaId}`, { cache: "no-store" });
      const dados = await lerRespostaAdmin<RespostaClientes>(resposta);
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao carregar clientes.");
      setClientesAzure(atuais => [...atuais.filter(c => c.empresaId !== empresaId), ...(dados.clientes || [])]);
    } catch (erro) {
      setErroClientes(
        erro instanceof Error
          ? erro.message
          : "Não foi possível carregar os clientes sincronizados."
      );
    } finally {
      setAtualizandoClientes(false);
    }
  }, [empresaId]);

  useEffect(() => {
    const quadro = window.requestAnimationFrame(() => {
      void carregarClientesAzure();
    });
    return () => window.cancelAnimationFrame(quadro);
  }, [carregarClientesAzure]);

  useEffect(() => {
    if (carregado) {
      window.localStorage.setItem(CHAVE_CLIENTES, JSON.stringify(clientes));
    }
  }, [carregado, clientes]);

  useEffect(() => {
    if (carregado) {
      window.localStorage.setItem(CHAVE_RASCUNHOS, JSON.stringify(rascunhos));
    }
  }, [carregado, rascunhos]);

  const clientesEmpresa = useMemo(() => {
    const unicos = new Map<string, Cliente>();
    for (const cliente of clientesAzure) {
      if (cliente.empresaId === empresaId) {
        unicos.set(cliente.documento.replace(/\D/g, "") || cliente.id, cliente);
      }
    }
    for (const cliente of clientes) {
      if (cliente.empresaId === empresaId) {
        const chave = cliente.documento.replace(/\D/g, "") || cliente.id;
        const remoto = unicos.get(chave);
        unicos.set(chave, remoto ? { ...remoto, ...cliente } : cliente);
      }
    }
    return [...unicos.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );
  }, [clientes, clientesAzure, empresaId]);
  const rascunhosEmpresa = useMemo(
    () => rascunhos.filter((item) => item.empresaId === empresaId),
    [rascunhos, empresaId]
  );

  function salvarCliente(cliente: Cliente) {
    setClientes((atuais) => [cliente, ...atuais]);
    setAviso(`Cliente ${cliente.nome} salvo localmente.`);
  }

  function salvarRascunho(rascunho: Rascunho) {
    setRascunhos((atuais) => [rascunho, ...atuais]);
    setAviso("Rascunho salvo. Nenhuma nota ou cobrança foi emitida.");
    setSecao("documentos");
  }

  let conteudo;
  if (secao === "aprovacoes") {
    conteudo = <Aprovacoes key={empresaId} empresa={empresaId} rascunhos={rascunhos.filter(r=>r.empresaId === empresaId)} />;
  } else if (secao === "nfse-nacional") {
    conteudo = <NfseNacional empresa={empresaId} />;
  } else if (secao === "historico-inter") {
    conteudo = <HistoricoInter key={empresaId} empresa={empresaId} />;
  } else if (secao === "historico-fiscal") {
    conteudo = <HistoricoFiscal key={empresaId} empresa={empresaId} />;
  } else if (secao === "emails") {
    conteudo = <LaboratorioEmails key={empresaId} empresa={empresaId} clientes={clientesEmpresa} carregandoClientes={atualizandoClientes} erroClientes={erroClientes} atualizarClientes={carregarClientesAzure} />;
  } else if (secao === "cobrancas") {
    conteudo = <FilaCobrancas key={empresaId} empresa={empresaId} clientes={clientesEmpresa} carregandoClientes={atualizandoClientes} erroClientes={erroClientes} atualizarClientes={carregarClientesAzure} />;
  } else if (secao === "acompanhamento") {
    conteudo = <Cobrancas key={empresaId} empresa={empresaId} clientes={clientesEmpresa} />;
  } else if (secao === "nova-emissao") {
    conteudo = (
      <NovaEmissao
        key={empresaId}
        empresaId={empresaId}
        clientes={clientesEmpresa}
        salvar={salvarRascunho}
        cadastrarCliente={() => setSecao("clientes")}
      />
    );
  } else if (secao === "clientes") {
    conteudo = (
      <CadastroClientes
        key={empresaId}
        empresaId={empresaId}
        clientes={clientesEmpresa}
        salvar={salvarCliente}
        atualizando={atualizandoClientes}
        erroAtualizacao={erroClientes}
        atualizar={() => void carregarClientesAzure()}
      />
    );
  } else if (secao === "documentos") {
    conteudo = (
      <ListaRascunhos
        rascunhos={rascunhosEmpresa}
        criar={() => setSecao("nova-emissao")}
      />
    );
  } else {
    conteudo = (
      <VisaoFinanceira
        key={empresaId}
        empresa={empresaId}
        navegar={setSecao}
      />
    );
  }

  return (
    <AdminShell empresa={empresaId} regime={empresa.regime} secao={secao} secoes={secoes} onEmpresa={setEmpresaId} onSecao={setSecao} aviso={aviso} onFecharAviso={()=>setAviso("")}>
      {conteudo}
    </AdminShell>
  );
}
