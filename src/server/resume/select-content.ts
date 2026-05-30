// Seleção de conteúdo do currículo: base de dados -> LLM -> ResumeContent (US-05).
//
// É o passo 2–3 do fluxo do Modo 1 (spec §3): serializa a base nos prompts, chama
// o `LLMProvider` (US-04) e devolve o `ResumeContent` JÁ validado (a validação Zod
// acontece dentro do provider — ADR-0012). Aqui NÃO se renderiza `.tex` nem se
// persiste nada: é só a ponte base -> conteúdo estruturado.
//
// O provider entra por parâmetro (injeção), nunca instanciado aqui: mantém o seam
// da US-04 e permite testar este passo com um provider mock, sem rede.

import type { ProfileBundle, ResumeContent } from "@/lib/schemas";
import type { LLMProvider } from "@/server/llm/provider";
import { buildStandardCvPrompts } from "@/server/llm/prompts/standard-cv";
import { buildJobAdaptiveCvPrompts } from "@/server/llm/prompts/job-adaptive-cv";

/**
 * Gera o `ResumeContent` do Modo 1 a partir da base, via o `LLMProvider`.
 *
 * @param bundle   A base completa do usuário (fonte da verdade; input do LLM).
 * @param provider Implementação de `LLMProvider` (NIM em produção, mock nos testes).
 * @param modelId  Id de modelo opcional; repassado ao provider (default por env/catálogo).
 * @returns `ResumeContent` validado pelo `ResumeContentSchema` (garantido pelo provider).
 * @throws  `LLMError` (transporte ou validação) propagado do provider → mapeável a 502.
 */
export async function generateStandardContent(
  bundle: ProfileBundle,
  provider: LLMProvider,
  modelId?: string,
): Promise<ResumeContent> {
  const { system, user } = buildStandardCvPrompts(bundle);
  return provider.generateResumeContent({ system, user, modelId });
}

/**
 * Gera o `ResumeContent` do Modo 2 (adaptativo à vaga) a partir da base + do texto
 * da vaga, via o `LLMProvider`. Espelha `generateStandardContent`: só troca o prompt
 * (Modo 2 prioriza/reordena/reescreve itens reais que casam com a vaga e OMITE o que
 * falta — nunca inventa). NÃO renderiza `.tex` nem persiste; é a ponte base+vaga →
 * conteúdo estruturado. O guardrail (US-07) roda depois, igual ao Modo 1.
 *
 * @param bundle   A base completa do usuário (fonte da verdade; input do LLM).
 * @param jobText  Texto integral da vaga colada (filtro/prioridade — não é fonte de fatos).
 * @param provider Implementação de `LLMProvider` (NIM em produção, mock nos testes).
 * @param modelId  Id de modelo opcional; repassado ao provider (default por env/catálogo).
 * @returns `ResumeContent` validado pelo `ResumeContentSchema` (garantido pelo provider).
 * @throws  `LLMError` (transporte ou validação) propagado do provider → mapeável a 502.
 */
export async function generateJobAdaptiveContent(
  bundle: ProfileBundle,
  jobText: string,
  provider: LLMProvider,
  modelId?: string,
): Promise<ResumeContent> {
  const { system, user } = buildJobAdaptiveCvPrompts(bundle, jobText);
  return provider.generateResumeContent({ system, user, modelId });
}
