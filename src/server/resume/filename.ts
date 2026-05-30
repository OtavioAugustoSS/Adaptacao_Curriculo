// Nome do arquivo `.tex` baixado (ADR-0014).
//
// Convenção: `curriculo-<slug(fullName)>-<AAAA-MM-DD>.tex`, onde o slug é o nome
// normalizado (minúsculas, sem acento, não-alfanumérico -> `-`, colapsado). Se o
// slug ficar vazio (ex.: nome só com símbolos), cai no fallback `curriculo-<id>.tex`.
// Função pura e determinística — fácil de testar.

/**
 * Normaliza um texto em um slug seguro para nome de arquivo:
 * minúsculas, sem acentos (NFD + remoção de diacríticos), tudo que não é
 * `a-z0-9` vira `-`, hifens repetidos colapsam, hifens das pontas caem.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos (acentos) combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // não-alfanumérico -> hífen
    .replace(/-{2,}/g, "-") // colapsa hífens repetidos
    .replace(/^-+|-+$/g, ""); // tira hífens das pontas
}

/** Formata uma data como `AAAA-MM-DD` (em UTC, estável entre fusos). */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Monta o nome do arquivo `.tex` para download (ADR-0014).
 *
 * @param fullName Nome do usuário (do `Profile`); pode ser vazio/só símbolos.
 * @param date     Data de geração (`GeneratedResume.createdAt`).
 * @param id       Id do currículo — usado no fallback se o slug ficar vazio.
 */
export function buildTexFilename(fullName: string, date: Date, id: string): string {
  const slug = slugify(fullName);
  if (!slug) return `curriculo-${id}.tex`;
  return `curriculo-${slug}-${formatDate(date)}.tex`;
}
