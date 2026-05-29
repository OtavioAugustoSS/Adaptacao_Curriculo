// Fronteira única de escape LaTeX (ADR-0009). TODO texto vindo do usuário passa
// por aqui antes de entrar no .tex, para não quebrar o documento nem injetar macros.
//
// Usa uma única passada de regex: o texto de substituição NÃO é re-processado, então
// as chaves que inserimos (ex.: em \textbackslash{}) não são re-escapadas.

const REPLACEMENTS: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

export function escapeLatex(input: string): string {
  return input.replace(/[\\&%$#_{}~^]/g, (ch) => REPLACEMENTS[ch]);
}
