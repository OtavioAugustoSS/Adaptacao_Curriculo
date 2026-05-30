import { describe, it, expect } from "vitest";
import { meetsGenerationPrerequisite } from "@/server/resume/prerequisite";
import type { ProfileBundle } from "@/lib/schemas";

// Testes de COMPORTAMENTO do pré-requisito do Modo 1 (US-05, ADR-0014).
// Regra: fullName não-vazio E (≥1 experiência OU ≥1 formação). Função pura.

// Bundle base vazio (só o necessário para o tipo); cada teste sobrescreve o relevante.
function makeBundle(overrides: Partial<ProfileBundle> = {}): ProfileBundle {
  return {
    profile: { fullName: "Otávio" },
    experiences: [],
    educations: [],
    skills: [],
    projects: [],
    languages: [],
    courses: [],
    ...overrides,
  };
}

const SAMPLE_EXPERIENCE = {
  company: "Acme",
  role: "Dev",
  startDate: "2020",
  current: false,
  bullets: [],
  order: 0,
};

const SAMPLE_EDUCATION = {
  institution: "USP",
  degree: "BSc",
  startDate: "2018",
  order: 0,
};

describe("meetsGenerationPrerequisite", () => {
  it("deve aceitar quando há nome e ao menos uma experiência", () => {
    expect(
      meetsGenerationPrerequisite(makeBundle({ experiences: [SAMPLE_EXPERIENCE] })),
    ).toBe(true);
  });

  it("deve aceitar quando há nome e ao menos uma formação (sem experiência)", () => {
    expect(
      meetsGenerationPrerequisite(makeBundle({ educations: [SAMPLE_EDUCATION] })),
    ).toBe(true);
  });

  it("deve rejeitar quando não há experiência nem formação", () => {
    expect(meetsGenerationPrerequisite(makeBundle())).toBe(false);
  });

  it("deve rejeitar quando o nome está vazio mesmo havendo experiência", () => {
    expect(
      meetsGenerationPrerequisite(
        makeBundle({ profile: { fullName: "" }, experiences: [SAMPLE_EXPERIENCE] }),
      ),
    ).toBe(false);
  });

  it("deve tratar nome só com espaços como ausente", () => {
    expect(
      meetsGenerationPrerequisite(
        makeBundle({ profile: { fullName: "   " }, educations: [SAMPLE_EDUCATION] }),
      ),
    ).toBe(false);
  });
});
