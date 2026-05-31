import { describe, it, expect } from "vitest";
import {
  ANALYZE_JOB_SYSTEM_PROMPT,
  buildAnalyzeJobPrompts,
} from "@/server/llm/prompts/analyze-job";
import { JobAnalysisSchema } from "@/server/llm/job-analysis";

// Passo 1 do pipeline de adaptação (ADR-0027): analisar a vaga. Prompt + schema, sem rede.

describe("analyze-job — prompt", () => {
  it("system instrui extrair role/mustHave/keywords sem inventar e sem escrever currículo", () => {
    expect(ANALYZE_JOB_SYSTEM_PROMPT).toContain('"role"');
    expect(ANALYZE_JOB_SYSTEM_PROMPT).toContain('"mustHave"');
    expect(ANALYZE_JOB_SYSTEM_PROMPT).toContain('"keywords"');
    const lower = ANALYZE_JOB_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain("não invente");
    expect(lower).toContain("não escreve currículo");
  });

  it("user carrega o texto cru da vaga", () => {
    const job = "Vaga: Back-end Python, microsserviços, CI/CD.";
    const { system, user } = buildAnalyzeJobPrompts(job);
    expect(system).toBe(ANALYZE_JOB_SYSTEM_PROMPT);
    expect(user).toContain(job);
  });
});

describe("JobAnalysisSchema — tolerância (vaga atípica não dá 502)", () => {
  it("aceita objeto vazio aplicando defaults", () => {
    const parsed = JobAnalysisSchema.parse({});
    expect(parsed.role).toBe("");
    expect(parsed.mustHave).toEqual([]);
    expect(parsed.keywords).toEqual([]);
  });

  it("preserva os campos fornecidos", () => {
    const parsed = JobAnalysisSchema.parse({
      role: "Dev",
      domain: "back-end",
      mustHave: ["Python"],
      keywords: ["CI/CD"],
    });
    expect(parsed.role).toBe("Dev");
    expect(parsed.mustHave).toEqual(["Python"]);
  });
});
