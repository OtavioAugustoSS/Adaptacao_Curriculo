// Link do TEMPLATE Overleaf onde o usuário compila o .tex gerado (ADR-0029).
//
// O sistema NÃO compila LaTeX (ADR-0002): a saída é o .tex e o usuário cola no
// Overleaf. O .tex começa com \documentclass{resume} e DEPENDE do `resume.cls` do
// template faangpath — por isso o destino é a PÁGINA PÚBLICA DO TEMPLATE (de onde
// qualquer usuário clona a própria cópia já com o resume.cls), e NÃO um projeto
// privado (que dava erro de permissão para os demais usuários — ADR-0029).
//
// Centralizado aqui para reuso na UI (/gerar e /curriculos) e configurável por env
// (NEXT_PUBLIC_OVERLEAF_TEMPLATE_URL) sem caçar a string nem novo deploy de código.

/** URL pública do template Overleaf (faangpath) onde o usuário cola o .tex. */
export const OVERLEAF_TEMPLATE_URL =
  process.env.NEXT_PUBLIC_OVERLEAF_TEMPLATE_URL ??
  "https://www.overleaf.com/latex/templates/faangpath-simple-template/npsfpdqnxmbc";

/** Texto curto do botão/atalho de abrir o Overleaf. */
export const OVERLEAF_BUTTON_LABEL = "Abrir no Overleaf";

/** Dica do fluxo (o sistema não compila LaTeX): abrir template → clonar → colar o .tex. */
export const OVERLEAF_FLOW_HINT =
  'Abra o template, clique em "Abrir como modelo" e cole seu .tex no main.tex.';
