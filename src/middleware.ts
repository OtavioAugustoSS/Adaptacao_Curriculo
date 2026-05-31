// Middleware de proteção de rotas (ADR-0024 §4). Roda no Edge, então usa SÓ a config
// base (sem PrismaAdapter) — o callback `authorized` decide quem passa. Não-logado em
// rota protegida é redirecionado para /login (pages.signIn).
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

// Roda em tudo, exceto: o próprio fluxo de auth, assets do Next e o favicon.
// `/login` passa pelo middleware mas é liberado pelo callback `authorized`.
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
