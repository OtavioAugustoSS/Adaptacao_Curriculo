"use client";

// Início (Home) — US-10. Recria docs/design/claude-design/app/home.jsx em Tailwind real.
// Saudação com o primeiro nome (de GET /api/profile), chips de status da base
// (experiências/projetos/habilidades, plural correto) e 3 atalhos. Quando a base está
// vazia, troca os chips por um callout de acento com link para o Perfil.
//
// Tudo é derivado dos dados reais (ADR-0017 §5): sem placeholders fictícios.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import type { ProfileBundle } from "@/lib/schemas";
import { baseStatChips, countBaseItems } from "@/lib/presentation/base-stats";

type Status = "loading" | "ready" | "error";

// Ícone de cada chip, na MESMA ordem que baseStatChips devolve os rótulos
// [experiências, projetos, habilidades]. Tanto o helper quanto este array filtram
// pela contagem > 0, então os índices casam após o filtro (fonte única do texto/plural).
const CHIP_ICONS: IconName[] = ["briefcase", "folder", "chip"];

const SHORTCUTS: { href: string; icon: IconName; title: string; desc: string }[] = [
  { href: "/perfil", icon: "user", title: "Perfil", desc: "Mantenha sua base — a fonte da verdade que alimenta tudo." },
  { href: "/gerar", icon: "spark", title: "Gerar", desc: "Monte um .tex padrão ou adaptado a uma vaga específica." },
  { href: "/curriculos", icon: "files", title: "Currículos", desc: "Reveja o histórico e baixe o .tex cacheado." },
];

export default function HomePage() {
  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ProfileBundle;
        if (!active) return;
        setBundle(data);
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const firstName = bundle?.profile.fullName?.trim().split(/\s+/)[0] || "você";

  // Base vazia = sem nome E sem nenhum item nas 6 listas (countBaseItems é a fonte
  // única da soma das listas).
  const isEmptyBase =
    status === "ready" &&
    bundle != null &&
    !bundle.profile.fullName.trim() &&
    countBaseItems(bundle) === 0;

  // Chips de status: rótulos (texto + plural + omissão de zeros) vêm do helper;
  // o ícone é pareado pela ordem [experiências, projetos, habilidades], filtrando
  // ambos pelo mesmo predicado de contagem > 0 para os índices casarem.
  const chips = bundle
    ? baseStatChips(bundle).map((label, i) => {
        const counts = [bundle.experiences.length, bundle.projects.length, bundle.skills.length];
        const visibleIcons = CHIP_ICONS.filter((_, j) => counts[j] > 0);
        return { label, icon: visibleIcons[i] };
      })
    : [];

  return (
    <>
      <div className="greet">
        <p className="hello">Bom te ver de volta</p>
        <h1>Olá, {firstName}.</h1>
      </div>

      {status === "loading" && (
        <div className="stat-chips" aria-busy="true" aria-label="Carregando">
          <div className="skel" style={{ height: 34, width: 150, borderRadius: 999 }} />
          <div className="skel" style={{ height: 34, width: 130, borderRadius: 999 }} />
          <div className="skel" style={{ height: 34, width: 160, borderRadius: 999 }} />
        </div>
      )}

      {isEmptyBase ? (
        <div className="note note-accent" style={{ marginTop: 20, marginBottom: 34 }}>
          <Icon name="info" />
          <div className="note-body">
            <p className="note-title">Sua base ainda está vazia</p>
            <p>
              Comece preenchendo seu <Link href="/perfil">Perfil</Link> — sem base, a IA não tem o que selecionar.
            </p>
          </div>
        </div>
      ) : status === "ready" ? (
        <div className="stat-chips">
          {chips.map((c, i) => {
            // O rótulo do helper é "N substantivo"; separamos o número (em <b>) do resto.
            const space = c.label.indexOf(" ");
            const n = c.label.slice(0, space);
            const noun = c.label.slice(space + 1);
            return (
              <span className="stat-chip" key={i}>
                {c.icon && <Icon name={c.icon} />} <b>{n}</b>&nbsp;<span className="scn">{noun}</span>
              </span>
            );
          })}
        </div>
      ) : null}

      {status === "error" && (
        <div className="note note-danger" style={{ marginTop: 20, marginBottom: 34 }}>
          <Icon name="alert" />
          <div className="note-body">
            <p className="note-title">Não foi possível carregar sua base</p>
            <p>Recarregue a página para tentar de novo. Seus atalhos continuam disponíveis abaixo.</p>
          </div>
        </div>
      )}

      <p className="eyebrow">Atalhos</p>
      <div className="shortcut-grid">
        {SHORTCUTS.map((c) => (
          <Link className="shortcut" key={c.href} href={c.href} style={{ textDecoration: "none" }}>
            <span className="sc-ic">
              <Icon name={c.icon} />
            </span>
            <h3>
              {c.title}
              <span className="arr">
                <Icon name="arrow" />
              </span>
            </h3>
            <p>{c.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
