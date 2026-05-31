// Seam de identidade (ADR-0006 → ADR-0024). Ponto ÚNICO de identidade do app: todo
// acesso a dados passa por aqui. Agora lê a sessão real do Auth.js (assíncrono).
//
// Em produção: sem sessão → lança UnauthenticatedError (mapeável a 401). O middleware
// (ADR-0024 §4) já barra antes, na borda; este lançamento é defesa em profundidade.
//
// Fora de produção: se não houver sessão e LOCAL_USER_ID estiver definido, usa-o como
// FALLBACK (dev/teste), preservando o fluxo local sem mockar auth em todo lugar
// (ADR-0024 §3). Em produção o fallback é inerte.

import { auth } from "@/auth";

/** Não há usuário autenticado e nenhum fallback aplicável. Rotas mapeiam a 401. */
export class UnauthenticatedError extends Error {
  constructor(message = "Não autenticado.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (id) return id;

  if (process.env.NODE_ENV !== "production" && process.env.LOCAL_USER_ID) {
    return process.env.LOCAL_USER_ID;
  }

  throw new UnauthenticatedError();
}
