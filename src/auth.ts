// Auth.js (NextAuth v5) — instância COMPLETA (Node runtime). ADR-0024.
//
// Estende a config base (Edge-safe) com o PrismaAdapter, que persiste User/Account/
// Session no Postgres (ADR-0025). Exporta:
//   - handlers  -> a rota /api/auth/[...nextauth]
//   - auth      -> lê a sessão no servidor (usado pelo seam getCurrentUserId)
//   - signIn/Out-> server actions usadas na UI de login/logout
//
// NÃO importar este módulo no middleware (Edge): use `@/auth.config` lá.

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
});
