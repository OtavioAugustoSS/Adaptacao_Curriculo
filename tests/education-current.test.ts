import { describe, it, expect } from "vitest";
import { renderResume } from "@/server/resume/render-latex";
import { STANDARD_CV_SYSTEM_PROMPT } from "@/server/llm/prompts/standard-cv";
import { JOB_ADAPTIVE_CV_SYSTEM_PROMPT } from "@/server/llm/prompts/job-adaptive-cv";
import type { ResumeContent, Profile } from "@/lib/schemas";

// Testes de COMPORTAMENTO do "Atual" na Formação (US-12, ADR-0018 §6).
// O ResumeContentSchema segue CONGELADO: o "Atual" da formação NÃO é um campo novo,
// é o mesmo mecanismo de Experience — o LLM emite o intervalo já formatado na string
// `period` e o renderer o imprime verbatim. Cobrimos os dois lados do contrato:
// 1. Renderer: um period "… – Atual" aparece literalmente no .tex (passthrough).
// 2. Prompts: ambos os modos instruem a formatar o period como "– Atual" quando current.

const HEADER: Profile = { fullName: "Maria Silva" };

function makeContent(overrides: Partial<ResumeContent> = {}): ResumeContent {
  return {
    objective: "",
    education: [],
    skills: [],
    experience: [],
    projects: [],
    ...overrides,
  };
}

describe("renderResume — period 'Atual' na formação (passthrough)", () => {
  it("deve imprimir 'Atual' no .tex quando o period da formação termina em '– Atual'", () => {
    const tex = renderResume(
      makeContent({
        education: [
          { institution: "USP", degree: "Mestrado", period: "2022 – Atual" },
        ],
      }),
      HEADER,
    );
    // O renderer não interpreta o period; ele sai verbatim (escapado) no cabeçalho da formação.
    expect(tex).toContain("Atual");
    expect(tex).toContain("2022 – Atual");
  });

  it("deve renderizar a formação com o intervalo fechado normalmente (controle)", () => {
    const tex = renderResume(
      makeContent({
        education: [
          { institution: "USP", degree: "BSc", period: "2018 – 2022" },
        ],
      }),
      HEADER,
    );
    expect(tex).toContain("2018 – 2022");
    // Sem current, não há "Atual" inventado pelo renderer.
    expect(tex).not.toContain("Atual");
  });
});

describe("prompts de CV — instrução de formatar '– Atual' quando current (US-12)", () => {
  it("o prompt do Modo 1 deve instruir a terminar o period em '– Atual' quando a formação for current", () => {
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain("– Atual");
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain('"current": true');
  });

  it("o prompt do Modo 2 deve instruir a terminar o period em '– Atual' quando a formação for current", () => {
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("– Atual");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain('"current": true');
  });
});
