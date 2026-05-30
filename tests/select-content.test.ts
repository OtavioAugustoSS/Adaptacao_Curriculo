import { describe, it, expect, vi } from "vitest";
import { generateStandardContent } from "@/server/resume/select-content";
import { STANDARD_CV_SYSTEM_PROMPT } from "@/server/llm/prompts/standard-cv";
import type { GenerateResumeParams, LLMProvider } from "@/server/llm/provider";
import type { ProfileBundle, ResumeContent } from "@/lib/schemas";

// Testes de COMPORTAMENTO da ponte base -> LLM -> ResumeContent (US-05).
// O LLMProvider é a FRONTEIRA (US-04): injetamos um mock e verificamos que
// select-content monta os prompts certos e devolve o que o provider retornou,
// sem renderizar .tex nem persistir.

const BUNDLE: ProfileBundle = {
  profile: { id: "p1", fullName: "Otávio" },
  experiences: [
    {
      id: "exp-1",
      company: "Acme",
      role: "Dev",
      startDate: "2020",
      current: true,
      bullets: ["fez A"],
      order: 0,
    },
  ],
  educations: [],
  skills: [],
  projects: [],
  languages: [],
  courses: [],
};

const CONTENT: ResumeContent = {
  objective: "Resumo",
  education: [],
  skills: [],
  experience: [
    {
      sourceId: "exp-1",
      role: "Dev",
      company: "Acme",
      period: "2020 — Atual",
      bullets: ["fez A"],
    },
  ],
  projects: [],
};

// Cria um LLMProvider mock cujo método devolve CONTENT e registra os params.
// Tipamos o vi.fn com a assinatura do método para que `.mock.calls` carregue o
// tipo de `GenerateResumeParams` (senão o TS infere uma tupla vazia).
function makeProvider() {
  const generateResumeContent = vi.fn(
    async (_params: GenerateResumeParams) => CONTENT,
  );
  const provider = { generateResumeContent } as unknown as LLMProvider;
  return { provider, generateResumeContent };
}

describe("generateStandardContent", () => {
  it("deve devolver o ResumeContent retornado pelo provider", async () => {
    const { provider } = makeProvider();
    const result = await generateStandardContent(BUNDLE, provider);
    expect(result).toEqual(CONTENT);
  });

  it("deve enviar o system prompt do Modo 1 e o user prompt com a base serializada", async () => {
    const { provider, generateResumeContent } = makeProvider();
    await generateStandardContent(BUNDLE, provider);

    const params = generateResumeContent.mock.calls[0][0];
    expect(params.system).toBe(STANDARD_CV_SYSTEM_PROMPT);
    // O user prompt carrega a base (a fonte da verdade) — checamos um id real e o nome.
    expect(params.user).toContain("Otávio");
    expect(params.user).toContain("exp-1");
  });

  it("deve repassar o modelId quando fornecido", async () => {
    const { provider, generateResumeContent } = makeProvider();
    await generateStandardContent(BUNDLE, provider, "meta/llama-3.1-70b-instruct");

    const params = generateResumeContent.mock.calls[0][0];
    expect(params.modelId).toBe("meta/llama-3.1-70b-instruct");
  });

  it("deve propagar o erro do provider (sem engolir)", async () => {
    const provider = {
      generateResumeContent: vi.fn(async () => {
        throw new Error("falha do provider");
      }),
    } as unknown as LLMProvider;

    await expect(generateStandardContent(BUNDLE, provider)).rejects.toThrow(
      "falha do provider",
    );
  });
});
