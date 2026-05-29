// Seam de identidade (ADR-0006). No MVP retorna LOCAL_USER_ID; quando entrar
// autenticação real (Auth.js), só esta função muda — o acesso a dados em todo o
// app passa por aqui e não precisa ser tocado.
export function getCurrentUserId(): string {
  const id = process.env.LOCAL_USER_ID;
  if (!id) {
    throw new Error(
      "LOCAL_USER_ID não configurado. Copie .env.example para .env e defina LOCAL_USER_ID.",
    );
  }
  return id;
}
