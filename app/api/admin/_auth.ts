import { NextRequest } from "next/server";

type Principal = {
  userRoles?: string[];
};

export function usuarioAdministrador(request: NextRequest) {
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
