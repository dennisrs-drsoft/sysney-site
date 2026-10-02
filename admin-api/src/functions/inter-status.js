import { app } from "@azure/functions";
import { verificarConfiguracaoInter } from "../services/inter.js";

const empresasValidas = new Set(["drsoft", "sysney"]);

app.http("inter-status", {
  methods: ["GET"],
  authLevel: "function",
  route: "financeiro/inter/{empresa}/status",
  handler: async (request) => {
    const empresa = request.params.empresa?.toLowerCase();
    if (!empresasValidas.has(empresa)) {
      return { status: 400, jsonBody: { erro: "Empresa inválida." } };
    }

    const estado = await verificarConfiguracaoInter(empresa);
    return {
      status: 200,
      headers: { "Cache-Control": "no-store" },
      jsonBody: {
        empresa,
        ...estado,
        leituraHabilitada:
          process.env.INTER_READ_OPERATIONS_ENABLED === "true",
        operacoesTransacionais: false,
      },
    };
  },
});
