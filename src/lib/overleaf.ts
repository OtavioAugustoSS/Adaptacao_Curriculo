// Link do projeto Overleaf onde o usuário compila o .tex gerado (Fatia 7 / WS2).
//
// O sistema NÃO compila LaTeX (ADR/produto): a saída é o .tex e o usuário cola no
// Overleaf. Centralizamos a URL do projeto aqui para reuso na UI (/gerar e /curriculos)
// e para facilitar uma futura troca (env/config) sem caçar a string pela base.

/** URL do projeto Overleaf (template faangpath) onde o usuário cola o .tex. */
export const OVERLEAF_PROJECT_URL =
  "https://www.overleaf.com/project/6a1b7884ee1222c3e7a18a19";

/** Texto curto do botão/atalho de abrir o Overleaf. */
export const OVERLEAF_BUTTON_LABEL = "Abrir no Overleaf";
