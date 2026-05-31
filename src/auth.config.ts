// Configuração BASE do Auth.js (ADR-0024) — segura para o Edge runtime do middleware.
//
// Por que separada do `src/auth.ts`: o `middleware.ts` roda no Edge, onde o Prisma NÃO
// roda. Esta config NÃO importa o PrismaAdapter nem `@/server/db` — só providers e
// callbacks puros. O `src/auth.ts` (Node) estende esta config adicionando o adapter.
// Padrão oficial NextAuth v5 "split config" para proteção de rotas no Edge.

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

export const authConfig = {
  // Provedores OAuth. As credenciais vêm por env auto-detectada pelo Auth.js:
  // AUTH_GOOGLE_ID/SECRET e AUTH_GITHUB_ID/SECRET (ADR-0024).
  providers: [Google, GitHub],

  // Página de login própria (sem a sidebar do app).
  pages: { signIn: "/login" },

  // Sessão por JWT (não database): o middleware do Edge consegue ler o token sem
  // tocar o Prisma. O adapter (auth.ts) ainda persiste User/Account no primeiro login.
  session: { strategy: "jwt" },

  callbacks: {
    // Propaga o id do usuário (do adapter, no 1º login) para o token e a sessão, para
    // o seam getCurrentUserId() lê-lo via auth(). Ver ADR-0024 §2.
    // (A decisão de acesso/redirect vive no middleware.ts — ADR-0026.)
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
