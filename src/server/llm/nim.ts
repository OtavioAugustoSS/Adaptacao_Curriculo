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
import type {
  GenerateResumeParams,
  GenerateProfileParams,
  LLMProvider,
} from "./provider";
import { LLMError } from "./provider";
import { resolveModel } from "./models";

/** Timeout por requisição ao provedor (ADR-0012: 60s). */
const REQUEST_TIMEOUT_MS = 60_000;
/** Retries em falha transitória (ADR-0012: até 2). Aplicado pelo SDK no transporte. */
const MAX_TRANSPORT_RETRIES = 2;

/**
 * Nome do response_format json_schema. Restrição da API: a-z, A-Z, 0-9, `_`/`-`.
 */
const JSON_SCHEMA_NAME = "ResumeContent";

/** Nome do response_format json_schema do import de perfil (US-11). */
const PROFILE_BUNDLE_JSON_SCHEMA_NAME = "ProfileBundle";

/**
 * JSON Schema derivado do `ResumeContentSchema` (Zod 4 nativo — sem dependência
 * nova; ADR-0012). Calculado uma vez no carregamento do módulo. Usado só como
 * RESTRIÇÃO DE GERAÇÃO; a validação real continua sendo o `.parse` do Zod.
 */
const RESUME_CONTENT_JSON_SCHEMA = z.toJSONSchema(ResumeContentSchema) as Record<
  string,
  unknown
>;

/**
 * JSON Schema derivado da variante TOLERANTE do bundle (`ImportProfileBundleSchema`,
 * ADR-0018 §5) — guia a saída do import. Mesma técnica/papel do schema acima:
 * RESTRIÇÃO de geração; a validação real é o `safeParse` do Zod (tolerante).
 */
const PROFILE_BUNDLE_JSON_SCHEMA = z.toJSONSchema(
  ImportProfileBundleSchema,
) as Record<string, unknown>;

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
      const completion = await this.client.chat.completions.create({
        model: model.id,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        response_format: responseFormat,
      });
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
   * Extrai um RASCUNHO de perfil a partir de um dump de texto livre (US-11, ADR-0018).
   * Espelha `generateResumeContent` (mesmo transporte/política de erro), mas com DOIS
   * pontos distintos: (1) o `response_format` json_schema deriva de
   * `ImportProfileBundleSchema`; (2) a validação da saída usa a variante TOLERANTE
   * (`fullName` pode vir vazio — ADR-0018 §5), para que um dump sem nome não vire 502
   * espúrio. A obrigatoriedade do nome fica no `PUT /api/profile` (estrito).
   */
  async extractProfileFromDump(
    params: GenerateProfileParams,
  ): Promise<ProfileBundle> {
    const model = resolveModel(params.modelId);

    // response_format: json_schema quando o modelo suporta; senão fallback json_object
    // (ADR-0012). `strict: false` pela mesma razão da geração (campos `.optional()`).
    const responseFormat: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"] =
      model.supportsJsonSchema
        ? {
            type: "json_schema",
            json_schema: {
              name: PROFILE_BUNDLE_JSON_SCHEMA_NAME,
              schema: PROFILE_BUNDLE_JSON_SCHEMA,
              strict: false,
            },
          }
        : { type: "json_object" };

    // --- Transporte: chamada ao provedor (retry/timeout nativos do SDK) --------
    let raw: string | null | undefined;
    try {
      const completion = await this.client.chat.completions.create({
        model: model.id,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        response_format: responseFormat,
      });
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
}
