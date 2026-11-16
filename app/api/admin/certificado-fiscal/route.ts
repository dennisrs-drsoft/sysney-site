import { NextRequest, NextResponse } from "next/server";
import { encaminharAdmin } from "../_remote";

async function certificado(req: NextRequest) {
  return await encaminharAdmin(req) ?? NextResponse.json(
    {erro:"O cofre fiscal está disponível pelo serviço administrativo do Azure."},
    {status:503,headers:{"Cache-Control":"no-store"}},
  );
}

export { certificado as GET, certificado as POST };