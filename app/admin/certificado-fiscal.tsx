"use client";

import { useEffect, useState, type FormEvent } from "react";
import { lerRespostaAdmin } from "@/lib/admin-resposta";

type Certificado = { validade: string; impressao: string; valido: boolean };
type Resultado = { certificado?: Certificado | null; erro?: string };

export function CertificadoFiscal({ empresa }: { empresa: "sysney" | "drsoft" }) {
  const url = "/api/admin/certificado-fiscal?empresa=" + empresa;
  const [certificado, setCertificado] = useState<Certificado | null>();
  const [mensagem, setMensagem] = useState("");
  const [disponivel, setDisponivel] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function consultar() {
      try {
        const r = await fetch(url, {cache:"no-store", signal:controller.signal});
        const dados = await lerRespostaAdmin<Resultado>(r, true);
        if (!r.ok) throw new Error(dados.erro || "Cofre fiscal indisponível.");
        setCertificado(dados.certificado ?? null);
        setDisponivel(true);
      } catch (erro) {
        if (!controller.signal.aborted) setMensagem(erro instanceof Error ? erro.message : "Cofre fiscal indisponível.");
      }
    }
    void consultar();
    return () => controller.abort();
  }, [url]);

  async function importar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    const form = e.currentTarget;
    const campos = new FormData(form);
    const arquivo = campos.get("pfx");
    if (!(arquivo instanceof File) || !/\.(pfx|p12)$/i.test(arquivo.name) || !arquivo.size || arquivo.size > 128 * 1024) {
      setMensagem("Selecione um arquivo PFX ou P12 de até 128 KB.");
      return;
    }
    setOcupado(true);
    setMensagem("");
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const pfx = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
      bytes.fill(0);
      const r = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({pfx, senha:campos.get("senha")})});
      const dados = await lerRespostaAdmin<Resultado>(r, true);
      if (!r.ok) throw new Error(dados.erro || "Falha ao importar o certificado.");
      setCertificado(dados.certificado ?? null);
      setMensagem("Certificado recebido pelo cofre. Aguarda validação do emissor.");
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : "Falha ao importar o certificado.");
    } finally {
      form.reset();
      setOcupado(false);
    }
  }

  return <details className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
    <summary className="cursor-pointer font-semibold">Certificado fiscal · {empresa.toUpperCase()}</summary>
    <p className="mt-3 text-sm">Emissor {empresa === "sysney" ? "Nacional" : "Municipal de São Paulo"}. A importação prepara o certificado para validação.</p>
    {certificado === null && <p className="mt-2 text-sm">Nenhum certificado importado.</p>}
    {certificado && <p className="mt-2 break-words text-sm">
      {certificado.valido ? "Certificado válido no cofre" : "Certificado inválido no cofre"} • Vencimento {new Date(certificado.validade).toLocaleDateString("pt-BR", {timeZone:"America/Sao_Paulo"})}
      <span className="block">SHA-256 {certificado.impressao}</span>
    </p>}
    <form method="post" onSubmit={importar} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="min-w-0 text-sm">Arquivo do certificado
        <input name="pfx" type="file" accept=".pfx,.p12" required disabled={!disponivel || ocupado} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <label className="min-w-0 text-sm">Senha do certificado
        <input name="senha" type="password" autoComplete="off" maxLength={256} disabled={!disponivel || ocupado} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <button type="submit" disabled={!disponivel || ocupado} className="justify-self-start rounded-lg bg-sky-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {ocupado ? "Importando…" : "Importar para o cofre"}
      </button>
    </form>
    <p aria-live="polite" className="mt-2 text-sm">{mensagem}</p>
  </details>;
}