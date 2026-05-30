import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resolveModel,
  DEFAULT_MODEL_ID,
  MODEL_CATALOG,
} from "@/server/llm/models";

// Testes de COMPORTAMENTO do catálogo de modelos (US-04, ADR-0004/0013).
// Precedência da resolução: argumento explícito > MODEL_ID (env) > default.
// O flag supportsJsonSchema decide json_schema vs. fallback json_object no adapter.

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveModel — precedência", () => {
  it("deve retornar o modelo padrão (llama-3.3-70b) quando não há arg nem env", () => {
    vi.stubEnv("MODEL_ID", "");
    const model = resolveModel();
    expect(model.id).toBe(DEFAULT_MODEL_ID);
    expect(DEFAULT_MODEL_ID).toBe("meta/llama-3.3-70b-instruct");
    // O padrão suporta structured output (ADR-0013/0012).
    expect(model.supportsJsonSchema).toBe(true);
  });

  it("deve usar MODEL_ID do ambiente quando não há argumento", () => {
    vi.stubEnv("MODEL_ID", "meta/llama-3.1-70b-instruct");
    const model = resolveModel();
    expect(model.id).toBe("meta/llama-3.1-70b-instruct");
    expect(model.supportsJsonSchema).toBe(false);
  });

  it("deve priorizar o argumento explícito sobre a env", () => {
    vi.stubEnv("MODEL_ID", "meta/llama-3.1-70b-instruct");
    const model = resolveModel("meta/llama-3.3-70b-instruct");
    expect(model.id).toBe("meta/llama-3.3-70b-instruct");
    expect(model.supportsJsonSchema).toBe(true);
  });
});

describe("resolveModel — modelo conhecido vs. desconhecido", () => {
  it("deve devolver os metadados do catálogo para um id conhecido", () => {
    const model = resolveModel("meta/llama-3.3-70b-instruct");
    expect(model).toEqual(MODEL_CATALOG["meta/llama-3.3-70b-instruct"]);
  });

  it("deve aceitar um id desconhecido mas assumir supportsJsonSchema:false (conservador)", () => {
    const model = resolveModel("algum/modelo-novo");
    expect(model.id).toBe("algum/modelo-novo");
    expect(model.supportsJsonSchema).toBe(false);
  });
});

describe("MODEL_CATALOG — modelos conhecidos", () => {
  it("deve manter o 3.1-70b no catálogo como alternativo (ADR-0013)", () => {
    expect(MODEL_CATALOG["meta/llama-3.1-70b-instruct"]).toBeDefined();
  });
});
