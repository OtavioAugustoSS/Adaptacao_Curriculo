// Catálogo de modelos de LLM conhecidos + modelo padrão (ADR-0004, ADR-0013).
//
// A ENV seleciona (`MODEL_ID`); este catálogo DESCREVE. Cada entrada carrega o
// flag `supportsJsonSchema`: se o modelo suporta `response_format: json_schema`
// na NVIDIA NIM, o adapter usa structured output guiado; se não, faz fallback
// para `json_object` (ADR-0012). A validação real é sempre o Zod, depois.

/** Metadados de um modelo conhecido pelo sistema. */
export interface ModelInfo {
  /** Id do modelo na NIM (valor de `MODEL_ID`), ex.: "meta/llama-3.3-70b-instruct". */
  id: string;
  /** Rótulo legível para UI/logs. */
  label: string;
  /**
   * O modelo suporta `response_format: { type: "json_schema" }` na NIM?
   * `true`  → adapter usa json_schema (saída guiada pelo schema do Zod).
   * `false` → adapter cai no fallback `json_object` (ADR-0012).
   */
  supportsJsonSchema: boolean;
}

/**
 * Modelo padrão do MVP (ADR-0013): suporte explícito a structured output na NIM.
 * Bate com o `MODEL_ID` do `.env.example`.
 */
export const DEFAULT_MODEL_ID = "meta/llama-3.3-70b-instruct";

/**
 * Catálogo de modelos conhecidos. Adicionar um modelo novo é um commit aqui
 * (aceitável no MVP — ADR-0004). A chave é o `id` (== `MODEL_ID`).
 */
export const MODEL_CATALOG: Record<string, ModelInfo> = {
  "meta/llama-3.3-70b-instruct": {
    id: "meta/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B Instruct",
    supportsJsonSchema: true,
  },
  // Mantido no catálogo como alternativo/experimentação (ADR-0013). Suporte a
  // json_schema menos garantido que no 3.3 — marcado false para usar o fallback.
  "meta/llama-3.1-70b-instruct": {
    id: "meta/llama-3.1-70b-instruct",
    label: "Llama 3.1 70B Instruct",
    supportsJsonSchema: false,
  },
  // NVIDIA Nemotron afinado para instruction-following/raciocínio (Fatia 10/ADR-0027):
  // obedece melhor as regras "não encolher / não inventar" da adaptação à vaga. Validado
  // contra a NIM (devolve JSON limpo com `json_object`). Marcado false → usa o fallback
  // json_object (não dependemos de json_schema neste modelo). Velocidade ~ do 70B.
  "nvidia/llama-3.3-nemotron-super-49b-v1": {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1",
    label: "Llama 3.3 Nemotron Super 49B",
    supportsJsonSchema: false,
  },
};

/**
 * Resolve o modelo a usar a partir de um id opcional.
 *
 * Precedência (ADR-0004): argumento explícito > `MODEL_ID` (env) > default do catálogo.
 * Um id desconhecido ainda é aceito (a env é a fonte da seleção), mas assume
 * `supportsJsonSchema: false` por segurança — melhor cair no fallback do que
 * pedir json_schema a um modelo que talvez não suporte.
 *
 * @param modelId Id explícito (ex.: vindo de um parâmetro de geração). Opcional.
 * @returns Os metadados do modelo resolvido (sempre um `ModelInfo`).
 */
export function resolveModel(modelId?: string): ModelInfo {
  // Trata "" e espaços como ausência (uma env vazia no .env é "não configurada").
  const explicit = modelId?.trim();
  const fromEnv = process.env.MODEL_ID?.trim();
  const id = explicit || fromEnv || DEFAULT_MODEL_ID;

  const known = MODEL_CATALOG[id];
  if (known) return known;

  // Id fora do catálogo: respeita a seleção, mas usa o caminho conservador.
  return {
    id,
    label: id,
    supportsJsonSchema: false,
  };
}
