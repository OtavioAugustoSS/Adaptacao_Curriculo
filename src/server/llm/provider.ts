// Interface `LLMProvider` — seam ÚNICO de acesso ao modelo (ADR-0003).
//
// Todo call site da geração depende DESTA interface, nunca do SDK concreto. Trocar
// NIM por outro provedor (incl. Claude) é trocar o adapter + envs, não o call site.
//
// Contrato de saída (ADR-0007/0012): o provider devolve um `ResumeContent` JÁ
// VALIDADO pelo `ResumeContentSchema`, NUNCA `.tex` cru e NUNCA texto livre. A
// validação Zod dentro do adapter é a fronteira de confiança real.

import type { ResumeContent } from "@/lib/schemas";

/**
 * Parâmetros de uma geração de conteúdo de currículo.
 *
 * Os PROMPTS em si (system/user) são montados FORA desta camada (US-05 Modo 1,
 * US-08 Modo 2) e entram aqui só como strings — o provider não conhece o conteúdo
 * do prompt, apenas o transporta para o modelo.
 */
export interface GenerateResumeParams {
  /** Prompt de sistema (instruções + invariantes anti-alucinação). Montado pela US-05/US-08. */
  system: string;
  /** Prompt de usuário (a base de dados serializada + a tarefa). Montado pela US-05/US-08. */
  user: string;
  /**
   * Id do modelo a usar nesta chamada. Opcional: se ausente, o adapter resolve
   * por `MODEL_ID` (env) e, em último caso, pelo default do catálogo (ADR-0004).
   */
  modelId?: string;
}

/**
 * Seam de acesso ao LLM. Implementações: `NimProvider` (`nim.ts`).
 * Os testes mockam ESTA interface para isolar o orquestrador do transporte.
 */
export interface LLMProvider {
  /**
   * Gera o conteúdo estruturado do currículo a partir dos prompts.
   *
   * @returns `ResumeContent` já validado pelo `ResumeContentSchema`.
   * @throws {LLMError} `transport` (rede/credencial/timeout/5xx esgotado → 502)
   *                    ou `validation` (saída não-conforme ao schema → 502, sem retry).
   */
  generateResumeContent(params: GenerateResumeParams): Promise<ResumeContent>;
}

/**
 * Causa de uma falha da camada de IA. Discrimina o que quem consome precisa saber:
 * - `transport`  → falha de comunicação com o provedor (rede/credencial/timeout/5xx).
 *                  Já esgotou os retries do adapter (ADR-0012). Mapeável a HTTP 502.
 * - `validation` → o modelo respondeu, mas a saída não casa com o schema (JSON
 *                  inválido ou `ResumeContentSchema` falhou). NÃO tem retry no
 *                  adapter (a regeneração semântica é da US-07). Também → 502.
 */
export type LLMErrorKind = "transport" | "validation";

/**
 * Erro tipado da camada de IA. Quem consome o `LLMProvider` mapeia qualquer
 * `LLMError` para **HTTP 502** (falha de dependência externa) — ver ADR-0012.
 * O `kind` permite logar/diferenciar transporte vs. validação; o status HTTP é
 * o mesmo para os dois no MVP.
 */
export class LLMError extends Error {
  /** Natureza da falha (transporte vs. validação da saída). */
  readonly kind: LLMErrorKind;
  /** Erro original (ex.: `APIError` do SDK ou `ZodError`), para log/diagnóstico. */
  readonly cause?: unknown;

  constructor(kind: LLMErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "LLMError";
    this.kind = kind;
    this.cause = cause;
  }
}
