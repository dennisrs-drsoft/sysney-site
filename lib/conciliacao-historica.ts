export type ConciliacaoHistorica = {
  notas: string[];
  notaCancelada?: string;
  data: string;
  nominalCentavos: number;
  recebidoCentavos: number;
  ajusteCentavos: number;
};

export function lerConciliacaoHistorica(
  json: string | undefined,
  nominalCentavos: number,
  documento: string,
  notas: {numero: string; centavos: number; situacao: string; documento: string}[],
): ConciliacaoHistorica | undefined {
  if (!json || !documento) return;
  try {
    const r = JSON.parse(json);
    if (r.forma !== "pix" || !Array.isArray(r.notas) || !r.notas.length ||
        r.notas.some((n: unknown) => typeof n !== "string" || !/^\d{1,15}$/.test(n)) ||
        new Set(r.notas).size !== r.notas.length ||
        !/^\d{4}-\d{2}-\d{2}$/.test(r.data) || !Number.isFinite(Date.parse(r.data)) ||
        r.nominalCentavos !== nominalCentavos || !Number.isSafeInteger(r.recebidoCentavos) ||
        r.recebidoCentavos <= 0 || r.recebidoCentavos > nominalCentavos ||
        r.ajusteCentavos !== nominalCentavos - r.recebidoCentavos) return;
    const doCliente = notas.filter(n => n.documento?.replace(/\D/g, "") === documento);
    const vinculadas = r.notas.map((id: string) => doCliente.filter(n => n.numero === id && n.situacao === "N"));
    if (vinculadas.some((ns: unknown[]) => ns.length !== 1) ||
        vinculadas.reduce((s: number, ns: typeof notas) => s + ns[0].centavos, 0) !== r.recebidoCentavos) return;
    const notaCancelada = doCliente.find(n => n.numero === r.notaCancelada && n.situacao === "C")?.numero;
    return {notas:r.notas, notaCancelada, data:r.data, nominalCentavos, recebidoCentavos:r.recebidoCentavos, ajusteCentavos:r.ajusteCentavos};
  } catch {
    return;
  }
}
