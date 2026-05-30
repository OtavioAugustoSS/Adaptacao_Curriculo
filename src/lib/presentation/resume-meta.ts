// Helpers PUROS de apresentação para currículos gerados (Fatia 4 / US-10).
// Extraídos dos componentes para serem testáveis sem DOM lib (vitest env node).
// Fonte ÚNICA da verdade — os componentes (curriculos/page.tsx, gerar/page.tsx)
// importam daqui em vez de duplicar a lógica inline.

import type { GeneratedResume, Issue, TraceabilityReport } from "@/lib/schemas";

type Mode = GeneratedResume["mode"];

/**
 * Rótulo do card / título do preview por modo (ADR-0016): SEMPRE derivado do modo,
 * NUNCA do texto/empresa da vaga (a função sequer recebe a vaga). Conjunto fechado.
 */
export function resumeModeLabel(mode: Mode): string {
  return mode === "JOB_ADAPTIVE" ? "Currículo adaptado à vaga" : "Currículo padrão";
}

/** Badge curto por modo, ao lado do título do card. */
export function resumeModeBadge(mode: Mode): string {
  return mode === "JOB_ADAPTIVE" ? "Adaptado" : "Padrão";
}

/**
 * Avisos exibíveis na UI: SÓ `warnings` (nunca `errors` — estes disparam regeneração
 * no backend e jamais chegam à tela). Relatório ausente → lista vazia.
 */
export function visibleWarnings(report: TraceabilityReport | null | undefined): Issue[] {
  return report?.warnings ?? [];
}

/** Quantidade de avisos exibíveis (0 quando não há relatório). */
export function warningCount(report: TraceabilityReport | null | undefined): number {
  return visibleWarnings(report).length;
}

/**
 * Data do card em PT-BR no formato `dd/mm/aaaa HH:mm`. Aceita string ISO ou Date.
 * Data inválida (string não parseável OU Date inválido) → "".
 */
export function formatResumeDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
