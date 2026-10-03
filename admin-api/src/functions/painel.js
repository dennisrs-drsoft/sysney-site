import { app } from "@azure/functions";
import { criarHandlerPainel } from "../services/painel-handler.js";
import * as clientes from "../../generated/clientes.mjs";
import * as cobrancas from "../../generated/cobrancas.mjs";
import * as emails from "../../generated/emails.mjs";
import * as aprovacoes from "../../generated/aprovacoes.mjs";
import * as historico from "../../generated/historico-inter.mjs";
import * as status from "../../generated/status.mjs";
import * as documentos from "../../generated/documentos.mjs";

app.http("admin-painel",{
  methods:["GET","POST"],authLevel:"function",route:"financeiro/painel/{recurso}",
  handler:criarHandlerPainel({clientes,cobrancas,emails,aprovacoes,"historico-inter":historico,status,documentos}),
});
