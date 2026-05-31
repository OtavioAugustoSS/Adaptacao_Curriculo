"use client";

// Identidade do usuário logado no rodapé da sidebar (ADR-0024): mostra nome/e-mail e
// o botão "Sair". Usa os hooks client do Auth.js (SessionProvider em Providers.tsx).
import { useSession, signOut } from "next-auth/react";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="user-menu user-menu--loading mono">…</div>;
  }
  if (!session?.user) return null;

  const label = session.user.name || session.user.email || "Usuário";

  return (
    <div className="user-menu">
      <span className="user-menu__name" title={session.user.email ?? undefined}>
        {label}
      </span>
      <button
        type="button"
        className="user-menu__signout"
        onClick={() => signOut({ redirectTo: "/login" })}
      >
        Sair
      </button>
    </div>
  );
}
