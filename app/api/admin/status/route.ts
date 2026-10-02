import { NextRequest, NextResponse } from "next/server";

type Principal = {
  userRoles?: string[];
};

function usuarioAdministrador(request: NextRequest) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ADMIN_DEV_BYPASS === "true"
  ) {
    return true;
  }

  const encodedPrincipal = request.headers.get("x-ms-client-principal");
  if (!encodedPrincipal) return false;

  try {
    const principal = JSON.parse(
      Buffer.from(encodedPrincipal, "base64").toString("utf8")
    ) as Principal;

    return principal.userRoles?.some(
      (role) => role.toLowerCase() === "administrador"
    );
  } catch {
    return false;
  }
}

function todasDefinidas(nomes: string[]) {
  return nomes.every((nome) => Boolean(process.env[nome]?.trim()));
}

export async function GET(request: NextRequest) {
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
