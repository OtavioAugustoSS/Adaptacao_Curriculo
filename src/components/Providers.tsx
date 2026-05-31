"use client";

// Provider de sessão do Auth.js no cliente (ADR-0024). Envolve a árvore para que
// componentes client (ex.: UserMenu) usem useSession()/signOut() sem prop drilling.
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
