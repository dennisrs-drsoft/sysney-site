/** Do not render proxy/login HTML or retry a potentially completed mutation. */
export async function lerRespostaAdmin<T>(res: Response, alteracao = false): Promise<T> {
  const conferir = alteracao ? " Confira o histórico antes de repetir a operação." : "";
  if (res.redirected || res.status === 401) {
    throw new Error("Sua sessão precisa ser renovada. Entre novamente no painel com o GitHub." + conferir);
  }
  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`O servidor não retornou os dados do painel (HTTP ${res.status}). Atualize a página; se persistir, informe esta mensagem.` + conferir);
  }
  try {
    return await res.json() as T;
  } catch {
    throw new Error("A resposta do servidor está incompleta. Atualize o histórico." + conferir);
  }
}
