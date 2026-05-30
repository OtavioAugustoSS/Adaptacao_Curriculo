// Helpers PUROS para as contagens da base (Fatia 4 / US-10): nav-sub do Perfil e
// chips de status da Home. Derivados do ProfileBundle real (contrato congelado,
// ADR-0017 §5) — sem novo endpoint, sem placeholder fictício.
//
// Atenção ao nome PLURAL `educations` do ProfileBundle (≠ `education` do ResumeContent).

import type { ProfileBundle } from "@/lib/schemas";

/** Soma o nº de itens das SEIS listas da base. */
export function countBaseItems(bundle: ProfileBundle): number {
  return (
    bundle.experiences.length +
    bundle.educations.length +
    bundle.skills.length +
    bundle.projects.length +
    bundle.languages.length +
    bundle.courses.length
  );
}

/** Rótulo do nav-sub do Perfil: "1 item" / "N itens" (0 e N>1 → plural). */
export function formatItemCount(n: number): string {
  return n === 1 ? "1 item" : `${n} itens`;
}

/**
 * Chips de status da Home, na ordem [experiências, projetos, habilidades].
 * Omite categorias com contagem 0 (nada de placeholder — US-10 §Início). Cada chip
 * é pluralizado pela própria contagem. Base totalmente vazia → [].
 */
export function baseStatChips(bundle: ProfileBundle): string[] {
  const chips: { n: number; one: string; many: string }[] = [
    { n: bundle.experiences.length, one: "experiência", many: "experiências" },
    { n: bundle.projects.length, one: "projeto", many: "projetos" },
    { n: bundle.skills.length, one: "habilidade", many: "habilidades" },
  ];
  return chips.filter((c) => c.n > 0).map((c) => `${c.n} ${c.n === 1 ? c.one : c.many}`);
}
