import { app } from "@azure/functions";

app.http("admin-health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "financeiro/health",
  handler: async () => ({
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
    jsonBody: {
      status: "ok",
      service: "SYSNEY Administração Financeira",
      environment:
        process.env.ADMIN_MODE === "homologacao"
          ? "homologação"
          : "não configurado",
      transactionalOperations: "disabled",
      credentialsConfigured: false,
      timestamp: new Date().toISOString(),
    },
  }),
});
