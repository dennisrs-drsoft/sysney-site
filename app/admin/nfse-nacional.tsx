import { pendenciasNacionais } from "@/lib/nfse-nacional";

export function NfseNacional({ empresa }: { empresa: "sysney" | "drsoft" }) {
  return <section className="space-y-5">
    <div className="rounded-3xl bg-[#07111f] p-7 text-white">
      <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Integração fiscal</p>
      <h2 className="mt-3 text-2xl font-black">NFS-e Nacional</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">Preparação em andamento. Nenhuma nota é emitida por esta tela. A chegada de novembro não libera operações automaticamente.</p>
      <span className="mt-4 inline-block rounded-full bg-amber-400/15 px-4 py-2 text-sm font-bold text-amber-200">Emissão real bloqueada</span>
    </div>
    {empresa === "sysney" && <div className="rounded-3xl border border-slate-200 bg-white p-7">
      <h3 className="font-black text-slate-950">Preparação da próxima emissão</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">Confira cliente, valor, referência e vencimento na área protegida de Cobranças mensais. As informações financeiras são consultadas na base da empresa, não incorporadas ao código público do site.</p>
      <p className="mt-5 text-sm leading-6 text-slate-600">Em 02/10/2026, o portal informou cadastro não encontrado ou não habilitado para a competência consultada. Isso não identifica a causa do bloqueio. Não mudar a data fiscal apenas para contorná-lo.</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">Preserve as notas e os boletos já emitidos. A referência comercial não substitui a validação da data fiscal da prestação.</p>
    </div>}
    <div className="rounded-3xl border border-slate-200 bg-white p-7">
      <h3 className="font-black text-slate-950">O que falta para ativar</h3>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">{pendenciasNacionais(empresa).map(item => <li key={item}>• {item}</li>)}</ul>
      <p className="mt-5 text-sm text-slate-600">A emissão municipal por RPS e a nacional por DPS são integrações distintas. Os campos de IBS/CBS não serão exigidos antecipadamente apenas por constarem no layout.</p>
      <a href="https://www.nfse.gov.br/EmissorNacional/Login" target="_blank" rel="noopener noreferrer" className="mt-5 inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">Abrir Emissor Nacional</a>
    </div>
  </section>;
}
