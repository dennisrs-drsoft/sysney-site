import { app } from "@azure/functions";
import { executarSync } from "../services/inter-sync.js";

app.timer("inter-sync-sysney", {
  schedule: "0 * * * * *", useMonitor: true, runOnStartup: false,
  handler: async (_timer, context) => {
    const resultado = await executarSync();
    if (resultado.falha) context.error("Sincronização bancária SYSNEY não concluída; consulte o painel.");
  },
});

app.timer("inter-sync-drsoft", {
  schedule: "30 * * * * *", useMonitor: true, runOnStartup: false,
  handler: async (_timer, context) => {
    const resultado = await executarSync({empresa:"drsoft"});
    if (resultado.falha) context.error("Sincronização bancária DRSOFT não concluída; consulte o painel.");
  },
});
