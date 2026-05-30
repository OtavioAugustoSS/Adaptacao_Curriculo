import { describe, it, expect, vi, beforeEach } from "vitest";
import OpenAI from "openai";
import { NimProvider } from "@/server/llm/nim";
import { LLMError } from "@/server/llm/provider";
import type { ResumeContent } from "@/lib/schemas";

// Testes de COMPORTAMENTO do adapter NIM (US-04, ADR-0012/0013).
// O cliente `openai` é a FRONTEIRA de transporte: injetamos um duble pelo
// construtor (`new NimProvider(fakeClient)`) e NUNCA tocamos na rede. O foco é o
// contrato do adapter: parse + validação Zod como garantia real, escolha de
// response_format pelo flag do modelo, e tradução de falhas em `LLMError` tipado
// (transporte vs. validação) sem retry no caminho de validação.

// Um ResumeContent mínimo válido (caso feliz) — o que um modelo "bem-comportado"
// devolveria como JSON. Mantido enxuto para asserções legíveis.
const VALID_CONTENT: ResumeContent = {
  objective: "Busco posição de backend.",
  education: [],
  skills: [{ category: "Linguagens", items: ["TypeScript"] }],
  experience: [
    {
      sourceId: "exp-1",
      role: "Dev",
      company: "Acme",
      period: "2020 — Atual",
      bullets: ["Entregou v1"],
    },
  ],
  projects: [],
};

// Monta uma resposta no formato do SDK (choices[0].message.content = string).
function chatResponse(content: string | null) {
  return { choices: [{ message: { content } }] };
}

// Cria um duble do cliente `openai` com um `chat.completions.create` mockado.
// `impl` controla o que a chamada faz (resolver/rejeitar). Devolve também o spy
// para inspecionar o payload (ex.: response_format) passado ao provedor.
function makeFakeClient(impl: (...args: unknown[]) => unknown) {
  const create = vi.fn(impl);
  const client = {
    chat: { completions: { create } },
  } as unknown as OpenAI;
  return { client, create };
}

// Params de geração mínimos (os prompts reais são da US-05; aqui só o seam).
const PARAMS = { system: "sys", user: "usr" };

beforeEach(() => {
  vi.clearAllMocks();
  // Default do catálogo (meta/llama-3.3-70b-instruct, supportsJsonSchema:true)
  // a menos que o teste sobrescreva via params.modelId.
  vi.unstubAllEnvs();
});

describe("NimProvider — caso feliz (saída válida)", () => {
  it("deve retornar o ResumeContent validado quando o modelo devolve JSON conforme", async () => {
    const { client } = makeFakeClient(async () =>
      chatResponse(JSON.stringify(VALID_CONTENT)),
    );
    const provider = new NimProvider(client);

    const result = await provider.generateResumeContent(PARAMS);

    expect(result).toEqual(VALID_CONTENT);
  });
});

describe("NimProvider — validação da saída (sem retry)", () => {
  it("deve lançar LLMError('validation') quando a saída não é JSON válido", async () => {
    const { client, create } = makeFakeClient(async () =>
      chatResponse("isto não é json"),
    );
    const provider = new NimProvider(client);

    await expect(provider.generateResumeContent(PARAMS)).rejects.toMatchObject({
      name: "LLMError",
      kind: "validation",
    });
    // Validação NÃO faz retry no adapter (ADR-0012): só uma chamada ao provedor.
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("deve lançar LLMError('validation') quando o JSON não casa com o ResumeContentSchema", async () => {
    // JSON sintaticamente válido, mas faltando campos obrigatórios do schema.
    const { client, create } = makeFakeClient(async () =>
      chatResponse(JSON.stringify({ objective: "só isso" })),
    );
    const provider = new NimProvider(client);

    const err = await provider.generateResumeContent(PARAMS).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.kind).toBe("validation");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("deve lançar LLMError('validation') quando o provedor retorna conteúdo vazio", async () => {
    const { client } = makeFakeClient(async () => chatResponse(null));
    const provider = new NimProvider(client);

    await expect(provider.generateResumeContent(PARAMS)).rejects.toMatchObject({
      kind: "validation",
    });
  });
});

describe("NimProvider — falha de transporte (→ 502)", () => {
  it("deve lançar LLMError('transport') quando o SDK lança um APIError (retries esgotados)", async () => {
    // O SDK já re-tentou internamente; quando o erro escapa, o adapter o classifica
    // como transporte. Simulamos uma instância real de APIError do SDK.
    const apiError = new OpenAI.APIError(
      502,
      { error: { message: "bad gateway" } },
      "bad gateway",
      undefined,
    );
    const { client } = makeFakeClient(async () => {
      throw apiError;
    });
    const provider = new NimProvider(client);

    const err = await provider.generateResumeContent(PARAMS).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.kind).toBe("transport");
    // A causa original é preservada para diagnóstico.
    expect(err.cause).toBe(apiError);
  });

  it("deve lançar LLMError('transport') em erro de conexão/timeout do SDK", async () => {
    const connError = new OpenAI.APIConnectionTimeoutError({ message: "timeout" });
    const { client } = makeFakeClient(async () => {
      throw connError;
    });
    const provider = new NimProvider(client);

    await expect(provider.generateResumeContent(PARAMS)).rejects.toMatchObject({
      kind: "transport",
    });
  });
});

describe("NimProvider — escolha de response_format pelo flag do modelo", () => {
  it("deve usar response_format json_schema para um modelo com supportsJsonSchema:true", async () => {
    const { client, create } = makeFakeClient(async () =>
      chatResponse(JSON.stringify(VALID_CONTENT)),
    );
    const provider = new NimProvider(client);

    // meta/llama-3.3-70b-instruct está no catálogo com supportsJsonSchema:true.
    await provider.generateResumeContent({
      ...PARAMS,
      modelId: "meta/llama-3.3-70b-instruct",
    });

    const payload = create.mock.calls[0][0] as {
      model: string;
      response_format: { type: string; json_schema?: { name: string; schema: unknown } };
    };
    expect(payload.model).toBe("meta/llama-3.3-70b-instruct");
    expect(payload.response_format.type).toBe("json_schema");
    // O schema enviado é o derivado do Zod (tem name e um objeto schema).
    expect(payload.response_format.json_schema?.name).toBe("ResumeContent");
    expect(payload.response_format.json_schema?.schema).toBeTypeOf("object");
  });

  it("deve cair no fallback response_format json_object para um modelo com supportsJsonSchema:false", async () => {
    const { client, create } = makeFakeClient(async () =>
      chatResponse(JSON.stringify(VALID_CONTENT)),
    );
    const provider = new NimProvider(client);

    // meta/llama-3.1-70b-instruct está no catálogo com supportsJsonSchema:false.
    await provider.generateResumeContent({
      ...PARAMS,
      modelId: "meta/llama-3.1-70b-instruct",
    });

    const payload = create.mock.calls[0][0] as {
      response_format: { type: string };
    };
    expect(payload.response_format.type).toBe("json_object");
  });
});
