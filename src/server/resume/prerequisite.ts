// Pré-requisito mínimo da base para gerar um currículo (ADR-0014).
//
// Regra: a base precisa ter `Profile.fullName` não-vazio E pelo menos UMA
// experiência OU UMA formação. Sem isso, a rota responde 422 PREREQUISITE_NOT_MET
// e NÃO chama o LLM (não geramos um currículo vazio nem damos espaço para o modelo
// "preencher" — risco anti-invariante). Função pura, fácil de testar e reusar (US-08).

import type { ProfileBundle } from "@/lib/schemas";

/** Mensagem orientando o usuário a preencher a base (exibida no 422). */
export const PREREQUISITE_MESSAGE =
  "Preencha a base antes de gerar: é necessário o nome e ao menos uma experiência ou formação.";

/**
 * Verifica se a base atende ao pré-requisito do Modo 1 (ADR-0014).
 * @returns `true` se há `fullName` não-vazio e (≥1 experiência OU ≥1 formação).
 */
export function meetsGenerationPrerequisite(bundle: ProfileBundle): boolean {
  const hasName = bundle.profile.fullName.trim().length > 0;
  const hasExperienceOrEducation =
    bundle.experiences.length > 0 || bundle.educations.length > 0;
  return hasName && hasExperienceOrEducation;
}
