// Adapter NIM — implementação de `LLMProvider` usando o SDK `openai` apontado
// para o endpoint OpenAI-compatible da NVIDIA NIM (ADR-0003, ADR-0004, ADR-0012).
//
// Responsabilidades (e SÓ elas — é a fronteira de transporte):
// - Configurar o cliente `openai` por env (`LLM_BASE_URL`, `LLM_API_KEY`), com
//   timeout 60s e até 2 retries em falha transitória (rede/5xx/timeout) — ADR-0012.
//   O retry de transporte é nativo do SDK (`maxRetries`); não reimplementamos.
// - Montar `response_format` conforme o flag `supportsJsonSchema` do modelo:
//   `json_schema` (schema derivado do Zod via `z.toJSONSchema`) ou fallback
//   `json_object` (ADR-0012). A NIM honra o padrão OpenAI; NÃO usamos `nvext`.
// - Parsear a resposta e SEMPRE revalidar com `ResumeContentSchema.parse` — a
//   validação Zod é a garantia real (cinto e suspensório).
// - Traduzir falhas em `LLMError` tipado (transporte vs. validação) → mapeável a 502.
//
// O que NÃO é deste adapter: os prompts (US-05/US-08), a orquestração base→render→
// persiste (US-05) e a regeneração por guardrail (US-07). Falha de validação aqui
// NÃO dá retry — propaga `LLMError("validation")`.

import OpenAI from "openai";
import { z } from "zod";
import {
  ResumeContentSchema,
  ImportProfileBundleSchema,
  type ResumeContent,
  type ProfileBundle,
} from "@/lib/schemas";
import { JobAnalysisSchema, type JobAnalysis } from "./job-analysis";
import type {
  GenerateResumeParams,
  GenerateProfileParams,
  GenerateJobAnalysisParams,
  LLMProvider,
} from "./provider";
import { LLMError } from "./provider";
import { resolveModel } from "./models";

/** Timeout-base do cliente (ADR-0012: 60s). Geração e import fazem override por requisição. */
const REQUEST_TIMEOUT_MS = 60_000;
/** Retries em falha transitória (ADR-0012: até 2). Aplicado pelo SDK no transporte. */
const MAX_TRANSPORT_RETRIES = 2;

/**
 * Timeout da GERAÇÃO (ADR-0023): 180s + 1 retry. O e2e real mostrou que, com o output mais
 * rico (Fatia 8/ADR-0022), UMA geração passa de ~60s → o corte de 60s aborta e o SDK
 * re-tenta (até 2×), virando ~180s de "retry storm" (e 502 quando as 3 tentativas estouram).
 * Dar 180s a UMA tentativa elimina o retry storm (cai para ~60–80s) e o risco de 502. Espelha
 * o import; `json_schema` é mantido (a lentidão era o corte, não o constrained decoding).
 */
const GENERATION_REQUEST_TIMEOUT_MS = 180_000;
/** Retries da geração: 1 (uma chamada de até 180s não deve ser re-tentada 2×). */
const GENERATION_MAX_RETRIES = 1;
/**
 * Temperatura da geração (ADR-0023): baixa. Gerar currículo é tarefa FIEL (selecionar,
 * reordenar e reescrever itens reais), não criativa. O e2e mostrou variância alta com a
 * temperatura padrão (uma geração mantinha tudo, outra cortava metade). 0.3 reduz a
 * variância e melhora a aderência às instruções (manter o conjunto + a profundidade).
 */
const GENERATION_TEMPERATURE = 0.3;

/**
 * Timeout do IMPORT por dump/arquivo (US-11/US-13): bem maior que a geração. O import
 * estrutura o currículo INTEIRO num único JSON (muitos bullets) — medido ~50s no
 * `llama-3.3-70b` na NIM, encostando no limite de 60s da geração e estourando (timeout →
 * 502). É uma ação única, iniciada pelo usuário, que pode esperar. Override por requisição
 * (não muda o timeout da geração, que segue 60s).
 */
const IMPORT_REQUEST_TIMEOUT_MS = 180_000;
/** Retries do import: 1 (cobre blip transitório sem multiplicar uma espera já longa). */
const IMPORT_MAX_RETRIES = 1;

/**
 * Timeout da ANÁLISE da vaga (ADR-0027, passo 1): chamada pequena/rápida (só lê a vaga e
 * resume requisitos). Curto — não precisa dos 180s da montagem. 1 retry para blip transitório.
 */
const ANALYZE_REQUEST_TIMEOUT_MS = 45_000;
const ANALYZE_MAX_RETRIES = 1;

/**
 * Nome do response_format json_schema. Restrição da API: a-z, A-Z, 0-9, `_`/`-`.
 */
const JSON_SCHEMA_NAME = "ResumeContent";

/**
 * JSON Schema derivado do `ResumeContentSchema` (Zod 4 nativo — sem dependência
 * nova; ADR-0012). Calculado uma vez no carregamento do módulo. Usado só como
 * RESTRIÇÃO DE GERAÇÃO; a validação real continua sendo o `.parse` do Zod.
 * (Só a GERAÇÃO usa json_schema; o import usa json_object — ver `extractProfileFromDump`.)
 */
const RESUME_CONTENT_JSON_SCHEMA = z.toJSONSchema(ResumeContentSchema) as Record<
  string,
  unknown
>;

/**
 * Lê e valida as envs do provedor. Falha cedo com mensagem clara se faltarem —
 * mesmo padrão do seam de identidade (`getCurrentUserId`). A base-URL tem default
 * coerente com o `.env.example`; a chave é obrigatória (segredo, sem default).
 */
function readProviderConfig(): { apiKey: string; baseURL: string } {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY não configurada. Copie .env.example para .env e defina a chave da NVIDIA NIM.",
    );
  }
  const baseURL = process.env.LLM_BASE_URL;
  if (!baseURL) {
    throw new Error(
      "LLM_BASE_URL não configurada. Copie .env.example para .env e defina o endpoint OpenAI-compatible da NIM.",
    );
  }
  return { apiKey, baseURL };
}

/**
 * `true` se o erro veio do transporte do SDK `openai` (rede, timeout, status HTTP
 * do provedor). Esses já passaram pela política de retry nativa do cliente; quando
 * chegam aqui, os retries se esgotaram → `LLMError("transport")` (mapeável a 502).
 */
function isTransportError(err: unknown): boolean {
  return err instanceof OpenAI.APIError || err instanceof OpenAI.APIConnectionError;
}

/** Adapter NIM (OpenAI-compatible) atrás da interface `LLMProvider`. */
export class NimProvider implements LLMProvider {
  private readonly client: OpenAI;

  /**
   * @param client Cliente `openai` opcional — injetado nos testes (mock). Em
   *               produção é criado a partir das envs, com timeout/retries do ADR-0012.
   */
  constructor(client?: OpenAI) {
    if (client) {
      this.client = client;
      return;
    }
    const { apiKey, baseURL } = readProviderConfig();
    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: MAX_TRANSPORT_RETRIES,
    });
  }

  async generateResumeContent(
    params: GenerateResumeParams,
  ): Promise<ResumeContent> {
    const model = resolveModel(params.modelId);

    // response_format: json_schema quando o modelo suporta; senão fallback
    // json_object (ADR-0012). O `strict` fica false: a forma exata é garantida
    // pelo Zod depois, e strict exigiria todos os campos em `required` (conflita
    // com os campos `.optional()` do schema) além de reduzir a portabilidade.
    const responseFormat: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"] =
      model.supportsJsonSchema
        ? {
            type: "json_schema",
            json_schema: {
              name: JSON_SCHEMA_NAME,
              schema: RESUME_CONTENT_JSON_SCHEMA,
              strict: false,
            },
          }
        : { type: "json_object" };

    // --- Transporte: chamada ao provedor (retry/timeout nativos do SDK) --------
    let raw: string | null | undefined;
    try {
      const completion = await this.client.chat.completions.create(
        {
          model: model.id,
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
          response_format: responseFormat,
          temperature: GENERATION_TEMPERATURE,
        },
        // ADR-0023: timeout longo + 1 retry (override por requisição) — evita o retry storm
        // de 60s na geração rica. Não muda o timeout-base do cliente (outras chamadas).
        { timeout: GENERATION_REQUEST_TIMEOUT_MS, maxRetries: GENERATION_MAX_RETRIES },
      );
      raw = completion.choices[0]?.message?.content;
    } catch (err) {
      if (isTransportError(err)) {
        throw new LLMError(
          "transport",
          "Falha ao comunicar com o provedor de IA (NIM).",
          err,
        );
      }
      // Erro inesperado (não de transporte conhecido): trata como transporte para
      // que o consumidor mapeie a 502, preservando a causa para diagnóstico.
      throw new LLMError(
        "transport",
        "Erro inesperado ao chamar o provedor de IA.",
        err,
      );
    }

    // --- Validação: parse + Zod (SEM retry — propaga erro de validação) --------
    if (!raw) {
      throw new LLMError(
        "validation",
        "O provedor de IA retornou uma resposta vazia.",
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new LLMError(
        "validation",
        "A saída do modelo não é JSON válido.",
        err,
      );
    }

    const result = ResumeContentSchema.safeParse(parsed);
    if (!result.success) {
      throw new LLMError(
        "validation",
        "A saída do modelo não está conforme o ResumeContentSchema.",
        result.error,
      );
    }

    return result.data;
  }

  /**
   * Extrai um RASCUNHO de perfil a partir de um dump de texto livre/arquivo (US-11/US-13,
   * ADR-0018/0019). Espelha `generateResumeContent` (mesma política de erro), com TRÊS
   * diferenças: (1) `response_format: json_object` — NÃO json_schema: o constrained
   * decoding contra o schema grande/aninhado do ProfileBundle é lento na NIM e estourava o
   * timeout de 60s da geração (→ 502); (2) timeout LONGO + 1 retry, pois o import estrutura o
   * currículo INTEIRO num JSON grande (~50s medido); (3) a saída é validada pela variante
   * TOLERANTE `ImportProfileBundleSchema` (campos ausentes viram "" — ADR-0018 §5; a
   * obrigatoriedade real fica no `PUT /api/profile` estrito).
   */
  async extractProfileFromDump(
    params: GenerateProfileParams,
  ): Promise<ProfileBundle> {
    const model = resolveModel(params.modelId);

    // --- Transporte: json_object + timeout LONGO + 1 retry (override por requisição) ----
    // json_object (não json_schema): o constrained decoding contra o schema grande do
    // ProfileBundle é lento na NIM e estourava o timeout (502). A forma da saída é garantida
    // pelo prompt parse-dump + a revalidação Zod (tolerante) logo abaixo — não precisamos do
    // schema como restrição de geração aqui. O timeout/retry da geração (60s) NÃO muda.
    let raw: string | null | undefined;
    try {
      const completion = await this.client.chat.completions.create(
        {
          model: model.id,
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
          response_format: { type: "json_object" },
        },
        { timeout: IMPORT_REQUEST_TIMEOUT_MS, maxRetries: IMPORT_MAX_RETRIES },
      );
      raw = completion.choices[0]?.message?.content;
    } catch (err) {
      if (isTransportError(err)) {
        throw new LLMError(
          "transport",
          "Falha ao comunicar com o provedor de IA (NIM).",
          err,
        );
      }
      throw new LLMError(
        "transport",
        "Erro inesperado ao chamar o provedor de IA.",
        err,
      );
    }

    // --- Validação: parse + Zod TOLERANTE (SEM retry — propaga validação) ------
    if (!raw) {
      throw new LLMError(
        "validation",
        "O provedor de IA retornou uma resposta vazia.",
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new LLMError(
        "validation",
        "A saída do modelo não é JSON válido.",
        err,
      );
    }

    const result = ImportProfileBundleSchema.safeParse(parsed);
    if (!result.success) {
      throw new LLMError(
        "validation",
        "A saída do modelo não está conforme o formato de perfil (ProfileBundle).",
        result.error,
      );
    }

    // A variante tolerante difere do `ProfileBundle` só por `fullName` poder ser ""
    // (que é um `string` válido); o rascunho é estruturalmente um ProfileBundle.
    return result.data as ProfileBundle;
  }

  /**
   * Analisa uma VAGA → `JobAnalysis` (ADR-0027, passo 1). Mesma política de erro dos demais
   * métodos, com: `json_object` (schema pequeno; não precisa de json_schema), timeout CURTO +
   * 1 retry (é uma chamada leve) e temperatura baixa, e validação tolerante pelo `JobAnalysisSchema`.
   */
  async analyzeJob(params: GenerateJobAnalysisParams): Promise<JobAnalysis> {
    const model = resolveModel(params.modelId);

    let raw: string | null | undefined;
    try {
      const completion = await this.client.chat.completions.create(
        {
          model: model.id,
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        },
        { timeout: ANALYZE_REQUEST_TIMEOUT_MS, maxRetries: ANALYZE_MAX_RETRIES },
      );
      raw = completion.choices[0]?.message?.content;
    } catch (err) {
      if (isTransportError(err)) {
        throw new LLMError("transport", "Falha ao comunicar com o provedor de IA (NIM).", err);
      }
      throw new LLMError("transport", "Erro inesperado ao chamar o provedor de IA.", err);
    }

    if (!raw) {
      throw new LLMError("validation", "O provedor de IA retornou uma resposta vazia.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new LLMError("validation", "A saída do modelo não é JSON válido.", err);
    }

    const result = JobAnalysisSchema.safeParse(parsed);
    if (!result.success) {
      throw new LLMError(
        "validation",
        "A saída do modelo não está conforme o JobAnalysisSchema.",
        result.error,
      );
    }
    return result.data;
  }
}
