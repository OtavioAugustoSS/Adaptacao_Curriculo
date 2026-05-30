// Helpers PUROS de tema (Fatia 4 / US-10 / ADR-0017 §4). A DECISÃO de tema vive
// aqui (testável); o efeito colateral (ler/gravar localStorage, setar data-theme no
// <html>) fica no componente da casca. Default dark, persistido em `cv-theme`.

export type Theme = "light" | "dark";

/** Tema padrão quando não há nada persistido (decisão do dono — US-10). */
export const DEFAULT_THEME: Theme = "dark";

/** Chave de persistência no localStorage. */
export const THEME_STORAGE_KEY = "cv-theme";

/**
 * Resolve o tema a partir de um valor cru salvo. Aceita "light"/"dark" apenas se
 * EXATAMENTE iguais (case-sensitive); qualquer outro valor / null / undefined / ""
 * cai no DEFAULT_THEME.
 */
export function resolveTheme(stored: string | null | undefined): Theme {
  return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
}

/** Alterna o tema (involutivo: aplicar 2x volta ao original). */
export function nextTheme(t: Theme): Theme {
  return t === "dark" ? "light" : "dark";
}
