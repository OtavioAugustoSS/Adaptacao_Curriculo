import { describe, it, expect, vi } from "vitest";
import { extractProfileFromDump } from "@/server/profile/extract-profile";
import { PARSE_DUMP_SYSTEM_PROMPT } from "@/server/llm/prompts/parse-dump";
import type { GenerateProfileParams, LLMProvider } from "@/server/llm/provider";
import type { ProfileBundle } from "@/lib/schemas";

// Testes de COMPORTAMENTO da ponte dump -> LLM -> ProfileBundle (US-11, ADR-0018).
// Espelha select-content.test: o LLMProvider é a FRONTEIRA, injetamos um mock e
// verificamos que extract-profile monta o prompt parse-dump certo (system fixo +
// rawText no user + modelId) e devolve o que o provider retornou — sem persistir.

const RAW_TEXT = "Otávio, dev backend. Trabalhou na Acme (2020-atual). Sabe TypeScript.";

// Rascunho que um provider "bem-comportado" devolveria a partir do texto.
const DRAFT: ProfileBundle = {
  profile: { fullName: "Otávio" },
  experiences: [
    {
      company: "Acme",
      role: "Dev Backend",
      startDate: "2020",
      current: true,
      bullets: [],
      order: 0,
    },
  ],
  educations: [],
  skills: [{ category: "Linguagens", name: "TypeScript", order: 0 }],
  projects: [],
  languages: [],
  courses: [],
};

// Cria um LLMProvider mock cujo extractProfileFromDump devolve DRAFT e registra os
// params. Tipamos o vi.fn com a assinatura para que `.mock.calls` carregue o tipo.
function makeProvider() {
  const extract = vi.fn(async (_params: GenerateProfileParams) => DRAFT);
  const provider = { extractProfileFromDump: extract } as unknown as LLMProvider;
  return { provider, extract };
}

describe("extractProfileFromDump", () => {
  it("deve devolver o ProfileBundle retornado pelo provider", async () => {
    const { provider } = makeProvider();
    const result = await extractProfileFromDump(RAW_TEXT, provider);
    expect(result).toEqual(DRAFT);
  });

  it("deve enviar o system prompt do parse-dump e o rawText no user prompt", async () => {
    const { provider, extract } = makeProvider();
    await extractProfileFromDump(RAW_TEXT, provider);

    const params = extract.mock.calls[0][0];
    expect(params.system).toBe(PARSE_DUMP_SYSTEM_PROMPT);
    // O user prompt carrega o texto livre do usuário (a fonte do rascunho).
    expect(params.user).toContain(RAW_TEXT);
  });

  it("deve repassar o modelId quando fornecido", async () => {
    const { provider, extract } = makeProvider();
    await extractProfileFromDump(RAW_TEXT, provider, "meta/llama-3.3-70b-instruct");

    const params = extract.mock.calls[0][0];
    expect(params.modelId).toBe("meta/llama-3.3-70b-instruct");
  });

  it("deve propagar o erro do provider (sem engolir)", async () => {
    const provider = {
      extractProfileFromDump: vi.fn(async () => {
        throw new Error("falha do provider");
      }),
    } as unknown as LLMProvider;

    await expect(extractProfileFromDump(RAW_TEXT, provider)).rejects.toThrow(
      "falha do provider",
    );
  });
});
