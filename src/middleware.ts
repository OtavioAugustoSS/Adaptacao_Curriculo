// Middleware de proteção de rotas (ADR-0024 §4, refinado pelo ADR-0026). Roda no Edge,
// então usa SÓ a config base (sem PrismaAdapter). Implementado como FUNÇÃO explícita para
// diferenciar API de página:
//   - logado            -> segue
//   - /login            -> segue (público)
//   - /api/* sem sessão -> 401 JSON (NÃO redireciona — senão o fetch client recebe HTML e
//                          quebra; ex.: as contagens da sidebar). Envelope de erro padrão.
//   - página sem sessão -> redireciona para /login (navegação amigável).
import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  if (isLoggedIn) return;
  if (pathname.startsWith("/login")) return;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Não autenticado." } },
      { status: 401 },
    );
  }

  const url = new URL("/login", req.nextUrl);
  url.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return NextResponse.redirect(url);
});

// Roda em tudo, exceto: o próprio fluxo de auth, assets do Next e o favicon.
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
