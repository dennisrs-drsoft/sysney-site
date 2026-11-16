"use client";

import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { lerRespostaAdmin } from "@/lib/admin-resposta";

type Certificado = { validade: string; impressao: string; valido: boolean };
type Resultado = { certificado?: Certificado | null; erro?: string };
type Aviso = { tom: "erro" | "sucesso"; texto: string };

const limite = 128 * 1024;

export function CertificadoFiscal({ empresa }: { empresa: "sysney" | "drsoft" }) {
  const url = "/api/admin/certificado-fiscal?empresa=" + empresa;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [certificado, setCertificado] = useState<Certificado | null>();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [aviso, setAviso] = useState<Aviso>();
  const [arrastando, setArrastando] = useState(false);
  const [disponivel, setDisponivel] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const bloqueado = !disponivel || ocupado;

  useEffect(() => {
    const controller = new AbortController();
    async function consultar() {
      try {
        const r = await fetch(url, { cache: "no-store", signal: controller.signal });
        const dados = await lerRespostaAdmin<Resultado>(r, true);
        if (!r.ok) throw new Error(dados.erro || "Cofre fiscal indisponível.");
        setCertificado(dados.certificado ?? null);
        setDisponivel(true);
      } catch (erro) {
        if (!controller.signal.aborted) setAviso({tom:"erro", texto:erro instanceof Error ? erro.message : "Cofre fiscal indisponível."});
      }
    }
    void consultar();
    return () => controller.abort();
  }, [url]);

  function selecionar(arquivos: FileList) {
    if (bloqueado || !arquivos.length) return;
    const escolhido = arquivos[0];
    if (arquivos.length !== 1 || !/\.(pfx|p12)$/i.test(escolhido.name) || !escolhido.size || escolhido.size > limite) {
      setArquivo(null);
      setAviso({tom:"erro", texto:"Selecione um único arquivo PFX ou P12 de até 128 KB."});
      return;
    }
    setArquivo(escolhido);
    setAviso(undefined);
  }

  function soltar(e: DragEvent) {
    e.preventDefault();
    setArrastando(false);
    selecionar(e.dataTransfer.files);
  }

  async function importar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (bloqueado || !arquivo) return;
    const form = e.currentTarget;
    const campos = new FormData(form);
    setOcupado(true);
    setAviso(undefined);
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const pfx = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
      bytes.fill(0);
      const r = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({pfx, senha:campos.get("senha")})});
      const dados = await lerRespostaAdmin<Resultado>(r, true);
      if (!r.ok) throw new Error(dados.erro || "Falha ao importar o certificado.");
      setCertificado(dados.certificado ?? null);
      setArquivo(null);
      setAviso({tom:"sucesso", texto:"Certificado salvo no cofre. A validação pelo emissor é a próxima etapa."});
    } catch (erro) {
      setAviso({tom:"erro", texto:erro instanceof Error ? erro.message : "Falha ao importar o certificado."});
    } finally {
      form.reset();
      setOcupado(false);
    }
  }

  const situacao = certificado ? (certificado.valido ? "Válido no cofre" : "Certificado inválido") :
    disponivel ? "Sem certificado" : aviso ? "Cofre indisponível" : "Consultando cofre…";
  const acao = "rounded-lg border border-blue-900/20 bg-white px-3 py-2 text-sm font-semibold text-blue-950 hover:bg-blue-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

  return (
    <details className="group mb-5 overflow-hidden rounded-2xl border border-blue-900/15 bg-white shadow-sm">
      <summary className="grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] bg-blue-50/70 px-4 py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-950 text-white" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s7-3.5 7-10V5l-7-3-7 3v7c0 6.5 7 10 7 10Z"/><path d="m9 12 2 2 4-4"/></svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-blue-950">Certificado fiscal · {empresa.toUpperCase()}</span>
          <span className="block text-sm text-slate-600">{empresa === "sysney" ? "Emissor Nacional" : "Emissor Municipal de São Paulo"}</span>
        </span>
        <span className={`col-start-2 row-start-2 justify-self-start rounded-full px-2.5 py-1 text-xs font-semibold lg:col-start-3 lg:row-start-1 ${certificado?.valido ? "bg-emerald-100 text-emerald-900" : certificado || aviso?.tom === "erro" ? "bg-amber-100 text-amber-950" : "bg-slate-100 text-slate-700"}`}>{situacao}</span>
        <svg aria-hidden="true" className="col-start-3 row-start-1 size-4 shrink-0 transition-transform group-open:rotate-180 lg:col-start-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
      </summary>
      <div className="space-y-4 border-t border-blue-900/10 p-4 sm:p-6">
        {certificado && (
          <div className="rounded-xl border border-blue-900/10 bg-slate-50 px-4 py-3 text-sm">
            <p className="font-semibold">Vencimento em {new Date(certificado.validade).toLocaleDateString("pt-BR", {timeZone:"America/Sao_Paulo"})}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-slate-700">Impressão digital SHA-256</summary>
              <p className="mt-2 break-all font-mono text-xs">{certificado.impressao}</p>
            </details>
          </div>
        )}
        <form method="post" onSubmit={importar} aria-busy={ocupado} className="grid items-start gap-4 lg:grid-cols-2">
          <div onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = bloqueado ? "none" : "copy"; if (!bloqueado) setArrastando(true); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false); }}
            onDrop={soltar}
            className={`min-w-0 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${arrastando ? "border-blue-600 bg-blue-100" : "border-blue-900/25 bg-blue-50/40"}`}>
            <svg aria-hidden="true" className="mx-auto mb-2 size-6 text-blue-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4"/></svg>
            <p className="break-all text-sm font-semibold text-blue-950">{arquivo ? arquivo.name : "Arraste seu certificado aqui"}</p>
            <p id={id + "-formato"} className="mt-1 text-xs text-slate-600">{arquivo ? `${Math.max(1, Math.ceil(arquivo.size / 1024))} KB` : "PFX ou P12 · até 128 KB"}</p>
            <input ref={input} type="file" accept=".pfx,.p12" hidden disabled={bloqueado} onChange={e => {
              if (e.currentTarget.files) selecionar(e.currentTarget.files);
              e.currentTarget.value = "";
            }} />
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" disabled={bloqueado} className={acao} onClick={() => input.current?.click()} aria-describedby={id + "-formato"}>{arquivo ? "Trocar arquivo" : "Escolher arquivo"}</button>
              {arquivo && <button type="button" disabled={bloqueado} className={acao} onClick={() => { setArquivo(null); setAviso(undefined); }}>Remover</button>}
            </div>
          </div>
          <div className="min-w-0 space-y-3">
            <label htmlFor={id + "-senha"} className="block text-sm font-semibold text-blue-950">Senha do certificado</label>
            <input id={id + "-senha"} name="senha" type="password" autoComplete="off" maxLength={256} disabled={bloqueado} className="w-full rounded-lg border border-blue-900/20 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-700" />
            <button type="submit" disabled={bloqueado || !arquivo} className="w-full rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50 sm:w-auto">
              {ocupado ? "Importando certificado…" : "Importar para o cofre"}
            </button>
          </div>
        </form>
        <div aria-live="polite" aria-atomic="true">
          {aviso && <div className={`rounded-xl border px-4 py-3 text-sm ${aviso.tom === "sucesso" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-rose-200 bg-rose-50 text-rose-950"}`}>
            <p className="font-semibold">{aviso.tom === "sucesso" ? "Importação concluída" : "Confira o aviso"}</p>
            <p className="mt-1">{aviso.texto}</p>
          </div>}
        </div>
      </div>
    </details>
  );
}