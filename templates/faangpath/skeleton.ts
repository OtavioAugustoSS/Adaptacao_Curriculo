// Blocos de montagem do .tex no template faangpath-simple-template.
// IMPORTANTE: estas funções NÃO escapam texto — quem chama deve passar todo
// conteúdo de usuário já tratado por escapeLatex() (ADR-0009).
// O renderer completo (ResumeContent -> .tex) é implementado na Fatia 1 em
// src/server/resume/render-latex.ts e usa estes helpers.

/** Preâmbulo: classe resume, margens, macros \name e \address. */
export function preamble(name: string, addressLines: string[]): string {
  const addresses = addressLines
    .map((line) => `\\address{${line}}`)
    .join("\n");
  return `\\documentclass{resume}
\\usepackage[left=0.4in,top=0.4in,right=0.4in,bottom=0.4in]{geometry}
\\name{${name}}
${addresses}
`;
}

export const DOCUMENT_BEGIN = "\\begin{document}";
export const DOCUMENT_END = "\\end{document}";

/** Uma seção rSection: \begin{rSection}{TÍTULO} ... \end{rSection}. */
export function rSection(title: string, body: string): string {
  return `\\begin{rSection}{${title}}

${body}

\\end{rSection}`;
}

/** Lista \begin{itemize} com \item por linha (espaçamento do template faangpath). */
export function itemize(items: string[]): string {
  const lines = items.map((it) => `    \\item ${it}`).join("\n");
  return `\\begin{itemize}
    \\itemsep -3pt {}
${lines}
\\end{itemize}`;
}
