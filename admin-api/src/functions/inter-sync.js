import { app } from "@azure/functions";
import { executarSync } from "../services/inter-sync.js";

app.timer("inter-sync-sysney", {
  schedule: "0 * * * * *", useMonitor: true, runOnStartup: false,
  handler: async (_timer, context) => {
    const resultado = await executarSync();
    if (resultado.falha) context.error("Sincronização bancária SYSNEY não concluída; consulte o painel.");
  },
});
