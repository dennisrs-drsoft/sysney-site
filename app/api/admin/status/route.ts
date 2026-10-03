import { NextRequest, NextResponse } from "next/server";
import { usuarioAdministrador } from "../_auth";
import { encaminharAdmin } from "../_remote";

function todasDefinidas(nomes: string[]) {
  return nomes.every((nome) => Boolean(process.env[nome]?.trim()));
}

export async function GET(request: NextRequest) {
  const remote = await encaminharAdmin(request); if (remote) return remote;
  if (!usuarioAdministrador(request)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  return NextResponse.json(
    {
      empresas: {
        drsoft: {
          inter: todasDefinidas([
            "INTER_DRSOFT_CLIENT_ID",
            "INTER_DRSOFT_CLIENT_SECRET",
            "INTER_DRSOFT_CERTIFICATE_BASE64",
            "INTER_DRSOFT_CERTIFICATE_PASSWORD",
          ]),
          nfse: todasDefinidas([
            "NFSE_DRSOFT_CNPJ",
            "NFSE_DRSOFT_CCM",
            "NFSE_DRSOFT_CERTIFICATE_BASE64",
            "NFSE_DRSOFT_CERTIFICATE_PASSWORD",
          ]),
        },
        sysney: {
          inter: todasDefinidas([
            "INTER_SYSNEY_CLIENT_ID",
            "INTER_SYSNEY_CLIENT_SECRET",
            "INTER_SYSNEY_CERTIFICATE_BASE64",
            "INTER_SYSNEY_CERTIFICATE_PASSWORD",
          ]),
          nfse: todasDefinidas([
            "NFSE_SYSNEY_CNPJ",
            "NFSE_SYSNEY_CCM",
            "NFSE_SYSNEY_CERTIFICATE_BASE64",
            "NFSE_SYSNEY_CERTIFICATE_PASSWORD",
          ]),
        },
      },
      armazenamento: todasDefinidas(["ADMIN_DATABASE_URL"]),
      email: todasDefinidas(["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"]),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
