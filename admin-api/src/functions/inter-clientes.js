import { app } from "@azure/functions";
import { situacaoInter } from "../services/inter.js";
import {
  dataValida,
  periodoPadrao,
  sincronizarClientesInter,
} from "../services/clientes-inter.js";

app.http("inter-clientes-sincronizar", {
  methods: ["POST"],
  authLevel: "function",
  route: "financeiro/inter/{empresa}/clientes/sincronizar",
  handler: async (request, context) => {
    const empresa = request.params.empresa?.toLowerCase();
    if (!empresa || !["drsoft", "sysney"].includes(empresa)) {
      return { status: 400, jsonBody: { erro: "Empresa inválida." } };
    }
    if (situacaoInter(empresa) !== "ativa") {
      return {
        status: 409,
        jsonBody: { erro: "Integração ainda em validação no Banco Inter." },
      };
    }
    if (process.env.INTER_READ_OPERATIONS_ENABLED !== "true") {
      return {
        status: 423,
        jsonBody: { erro: "Consultas ao Inter ainda estão bloqueadas." },
      };
    }

    const padrao = periodoPadrao();
    const dataInicial = request.query.get("dataInicial") || padrao.dataInicial;
    const dataFinal = request.query.get("dataFinal") || padrao.dataFinal;
    if (!dataValida(dataInicial) || !dataValida(dataFinal)) {
      return { status: 400, jsonBody: { erro: "Período inválido." } };
    }

    try {
      const resultado = await sincronizarClientesInter({
        empresa,
        dataInicial,
        dataFinal,
      });

      return {
        status: 200,
        headers: { "Cache-Control": "no-store" },
        jsonBody: resultado,
      };
    } catch (erro) {
      context.error("Falha na sincronização de clientes do Inter", erro);
      return {
        status: 502,
        jsonBody: {
          erro: "Não foi possível consultar o Inter neste momento.",
        },
      };
    }
  },
});
