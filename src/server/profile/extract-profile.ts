// Extração de perfil por dump: texto livre -> LLM -> ProfileBundle rascunho (US-11).
//
// Paralelo do select-content.ts (geração), mas para o fluxo NOVO de import (ADR-0018):
// serializa o `rawText` nos prompts, chama o `LLMProvider` (US-04) e devolve o
// `ProfileBundle` JÁ validado (a validação Zod, em variante TOLERANTE para o rascunho,
// acontece dentro do provider — ADR-0018 §5). Aqui NÃO se persiste nada: é só a ponte
// texto -> rascunho estruturado, que volta ao formulário do /perfil para revisão humana.
//
// EXTRAÇÃO ≠ GERAÇÃO: não há base de referência, então o guardrail de rastreabilidade
// (validate-traceability.ts) NÃO se aplica (ADR-0018 §4). A proteção é o prompt
// restritivo + a revisão humana antes de salvar.
//
// O provider entra por parâmetro (injeção), nunca instanciado aqui: mantém o seam da
// US-04 e permite testar este passo com um provider mock, sem rede.

import type { ProfileBundle } from "@/lib/schemas";
import type { LLMProvider } from "@/server/llm/provider";
import { buildParseDumpPrompts } from "@/server/llm/prompts/parse-dump";

/**
 * Estrutura um rascunho de `ProfileBundle` a partir de um dump de texto livre, via o
 * `LLMProvider`. Espelha `generateStandardContent`: só troca o prompt (parse-dump) e o
 * método do provider (`extractProfileFromDump`). NÃO persiste; é a ponte texto → rascunho.
 *
 * @param rawText  O texto livre colado pelo usuário (o próprio material dele).
 * @param provider Implementação de `LLMProvider` (NIM em produção, mock nos testes).
 * @param modelId  Id de modelo opcional; repassado ao provider (default por env/catálogo).
 * @returns `ProfileBundle` rascunho, validado no provider em variante tolerante (o
 *          `fullName` pode vir vazio — ADR-0018 §5). Ids ausentes (gerados no save).
 * @throws  `LLMError` (transporte ou validação) propagado do provider → mapeável a 502.
 */
export async function extractProfileFromDump(
  rawText: string,
  provider: LLMProvider,
  modelId?: string,
): Promise<ProfileBundle> {
  const { system, user } = buildParseDumpPrompts(rawText);
  return provider.extractProfileFromDump({ system, user, modelId });
}
