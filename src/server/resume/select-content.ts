// Seleção de conteúdo do currículo: base de dados -> LLM -> ResumeContent (US-05).
//
// É o passo 2–3 do fluxo (spec §3): serializa a base nos prompts, chama o `LLMProvider`
// (US-04) e devolve o `ResumeContent` JÁ validado (a validação Zod acontece dentro do
// provider — ADR-0012). Aqui NÃO se renderiza `.tex` nem se persiste nada: é só a ponte
// base -> conteúdo estruturado.
//
// Modo 2 (ADR-0027): pipeline de 2 passos — (1) analisa a vaga (`analyzeJobPosting`), (2)
// adapta usando a análise como guia. A análise é RESILIENTE: se falhar, adapta sem ela
// (não vira novo modo de 502). O provider entra por parâmetro (injeção), nunca instanciado
// aqui: mantém o seam da US-04 e permite testar com um provider mock, sem rede.

import type { ProfileBundle, ResumeContent } from "@/lib/schemas";
import type { LLMProvider } from "@/server/llm/provider";
import type { JobAnalysis } from "@/server/llm/job-analysis";
import { buildStandardCvPrompts } from "@/server/llm/prompts/standard-cv";
import { buildJobAdaptiveCvPrompts } from "@/server/llm/prompts/job-adaptive-cv";
import { buildAnalyzeJobPrompts } from "@/server/llm/prompts/analyze-job";

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
 * Passo 1 do Modo 2 (ADR-0027): analisa a vaga e devolve os requisitos estruturados que
 * guiam a adaptação. RESILIENTE: qualquer falha (transporte/validação) vira `undefined` — a
 * adaptação ainda roda a partir da base, sem a análise. Por isso o `+1 chamada` não introduz
 * um novo modo de 502.
 *
 * @param jobText  Texto integral da vaga colada (não é fonte de fatos do currículo).
 * @param provider Implementação de `LLMProvider`.
 * @param modelId  Id de modelo opcional.
 * @returns `JobAnalysis` ou `undefined` (se a análise falhar).
 */
export async function analyzeJobPosting(
  jobText: string,
  provider: LLMProvider,
  modelId?: string,
): Promise<JobAnalysis | undefined> {
  try {
    const { system, user } = buildAnalyzeJobPrompts(jobText);
    return await provider.analyzeJob({ system, user, modelId });
  } catch {
    return undefined;
  }
}

/**
 * Gera o `ResumeContent` do Modo 2 (adaptativo à vaga) — pipeline de 2 passos (ADR-0027):
 * (1) `analyzeJobPosting` (resiliente), (2) adaptação usando a análise como guia. NÃO
 * renderiza `.tex` nem persiste; o guardrail (US-07) roda depois, igual ao Modo 1, validando
 * contra a `bundle` (a análise é só guia, não fonte de fatos).
 *
 * @param bundle   A base completa do usuário (fonte da verdade; input do LLM).
 * @param jobText  Texto integral da vaga colada (filtro/prioridade — não é fonte de fatos).
 * @param provider Implementação de `LLMProvider` (NIM em produção, mock nos testes).
 * @param modelId  Id de modelo opcional; repassado ao provider (default por env/catálogo).
 * @returns `ResumeContent` validado pelo `ResumeContentSchema` (garantido pelo provider).
 * @throws  `LLMError` (transporte ou validação da ADAPTAÇÃO) propagado do provider → 502. A
 *          falha da ANÁLISE não propaga (resiliente; ver `analyzeJobPosting`).
 */
export async function generateJobAdaptiveContent(
  bundle: ProfileBundle,
  jobText: string,
  provider: LLMProvider,
  modelId?: string,
): Promise<ResumeContent> {
  const analysis = await analyzeJobPosting(jobText, provider, modelId);
  const { system, user } = buildJobAdaptiveCvPrompts(bundle, jobText, analysis);
  return provider.generateResumeContent({ system, user, modelId });
}
