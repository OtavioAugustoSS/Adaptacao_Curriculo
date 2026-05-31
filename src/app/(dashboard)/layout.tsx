"use client";

// Casca (shell) do app — US-10 / ADR-0017. Recria docs/design/claude-design/app/shell.jsx
// em Next + Tailwind real. Sidebar fixa (240px) com brand + nav (Início/Perfil/Gerar/
// Currículos, estado ativo com barra de acento + aria-current + nav-sub de contagem),
// toggle de tema no rodapé (persiste cv-theme), drawer mobile (<820px) com scrim.
//
// As contagens da nav-sub são DERIVADAS no cliente (ADR-0017 §5, contrato congelado):
// Perfil = soma das 6 listas de GET /api/profile; Currículos = length de GET /api/resumes.

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { UserMenu } from "@/components/UserMenu";
import type { ProfileBundle, GeneratedResume } from "@/lib/schemas";
import { countBaseItems, formatItemCount } from "@/lib/presentation/base-stats";
import { resolveTheme, THEME_STORAGE_KEY, DEFAULT_THEME, type Theme } from "@/lib/presentation/theme";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/perfil", label: "Perfil", icon: "user" },
  { href: "/gerar", label: "Gerar", icon: "spark" },
  { href: "/curriculos", label: "Currículos", icon: "files" },
];

const LABEL_FOR: Record<string, string> = {
  "/": "Início",
  "/perfil": "Perfil",
  "/gerar": "Gerar",
  "/curriculos": "Currículos",
};

function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <div className="theme-seg" role="group" aria-label="Tema">
      <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
        <Icon name="sun" /> Light
      </button>
      <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
        <Icon name="moon" /> Dark
      </button>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [menuOpen, setMenuOpen] = useState(false);
  // null = ainda carregando (não exibe número fictício na nav-sub).
  const [profileCount, setProfileCount] = useState<number | null>(null);
  const [resumeCount, setResumeCount] = useState<number | null>(null);

  // Lê o tema já aplicado pelo script de boot (layout raiz) e mantém em sincronia.
  // A DECISÃO de qual tema é válido vem do helper puro resolveTheme.
  useEffect(() => {
    setThemeState(resolveTheme(document.documentElement.getAttribute("data-theme")));
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* localStorage indisponível — tema só nesta sessão */
    }
  }

  // Deriva as contagens da nav-sub dos endpoints existentes (sem novo contrato).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const b = (await res.json()) as ProfileBundle;
        if (!active) return;
        setProfileCount(countBaseItems(b));
      } catch {
        if (active) setProfileCount(null);
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/resumes");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list = (await res.json()) as GeneratedResume[];
        if (!active) return;
        setResumeCount(Array.isArray(list) ? list.length : 0);
      } catch {
        if (active) setResumeCount(null);
      }
    })();
    return () => {
      active = false;
    };
    // Re-busca as contagens ao navegar (ex.: salvar no /perfil e ir ao /curriculos),
    // pra refletir mudanças sem exigir reload (bônus do fix das contagens, ADR-0026).
  }, [pathname]);

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function subFor(href: string): string | null {
    if (href === "/perfil") return profileCount == null ? null : formatItemCount(profileCount);
    if (href === "/curriculos") return resumeCount == null ? null : String(resumeCount);
    return null;
  }

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={"app" + (menuOpen ? " menu-open" : "")}>
      <div className="scrim" onClick={closeMenu} aria-hidden="true" />

      <aside className="sidebar">
        <Link href="/" className="sb-brand" onClick={closeMenu} style={{ textDecoration: "none" }}>
          <span className="logo">fc</span>
          <span>Forja de Currículo</span>
        </Link>
        <nav className="sb-nav" aria-label="Navegação principal">
          <div className="navhead">Navegação</div>
          {NAV.map((item) => {
            const active = isActive(item.href);
            const sub = subFor(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={"navitem" + (active ? " active" : "")}
                aria-current={active ? "page" : undefined}
                onClick={closeMenu}
                style={{ textDecoration: "none" }}
              >
                <Icon name={item.icon} /> {item.label}
                {sub != null && <span className="nav-sub">{sub}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sb-foot">
          <UserMenu />
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </aside>

      <div className="main">
        <div className="topbar-m">
          <button type="button" className="icon-btn" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </button>
          <span className="logo">fc</span>
          <span style={{ fontWeight: 600, letterSpacing: "-.01em" }}>Forja de Currículo</span>
          <span style={{ flex: 1 }} />
          <span className="mono" style={{ color: "var(--fg-muted)", fontSize: 12 }}>
            {LABEL_FOR[pathname] ?? ""}
          </span>
        </div>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
