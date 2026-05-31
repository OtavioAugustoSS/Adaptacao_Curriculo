import { describe, it, expect } from "vitest";
import {
  STANDARD_CV_SYSTEM_PROMPT,
  buildStandardCvUserPrompt,
  buildStandardCvPrompts,
} from "@/server/llm/prompts/standard-cv";
import type { ProfileBundle } from "@/lib/schemas";

// Testes do PROMPT do Modo 1 (US-05 + Fatia 7/ADR-0020). O prompt é a 2ª camada do
// invariante anti-alucinação (a 1ª é arquitetural; a 3ª é o guardrail). A Fatia 7 muda
// o Modo 1 para COMPLETO (não omitir) e adiciona os campos novos (languages, courses,
// project.bullets/techStack) ao formato. Verificamos as instruções LOAD-BEARING.

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

describe("STANDARD_CV_SYSTEM_PROMPT — anti-alucinação", () => {
  it("deve conter a regra inegociável de não inventar", () => {
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain("NÃO INVENTE NADA");
  });

  it("deve manter sourceId obrigatório em experience", () => {
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain("sourceId");
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain("OBRIGATÓRIO");
  });
});

describe("STANDARD_CV_SYSTEM_PROMPT — completude (ADR-0020: Modo 1 não omite)", () => {
  it("deve instruir a NÃO omitir / incluir TUDO da base", () => {
    // O risco específico do Modo 1 pós-ADR-0020: sair enxuto. O prompt precisa exigir
    // completude explicitamente.
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain("não omita");
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain("TUDO");
    expect(STANDARD_CV_SYSTEM_PROMPT).toMatch(/TODAS as experiências/);
    expect(STANDARD_CV_SYSTEM_PROMPT).toMatch(/TODOS os projetos/);
  });

  it("deve mandar incluir TODOS os idiomas e TODOS os cursos/certificações", () => {
    expect(STANDARD_CV_SYSTEM_PROMPT).toMatch(/TODOS os idiomas/);
    expect(STANDARD_CV_SYSTEM_PROMPT).toMatch(/cursos\/certificações/);
  });

  it("deve mandar preservar os bullets e o techStack reais de cada projeto", () => {
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain("bullets");
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain("techStack");
  });
});

describe("STANDARD_CV_SYSTEM_PROMPT — campos novos no formato JSON (ADR-0020)", () => {
  it("deve declarar languages e courses no bloco de formato", () => {
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain('"languages"');
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain('"courses"');
  });

  it("deve declarar bullets e techStack dentro de projects no formato", () => {
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain('"bullets"');
    expect(STANDARD_CV_SYSTEM_PROMPT).toContain('"techStack"');
  });
});

describe("buildStandardCvUserPrompt — base serializada", () => {
  it("deve carregar a base (nome + id real que vira sourceId)", () => {
    const user = buildStandardCvUserPrompt(BUNDLE);
    expect(user).toContain("Otávio");
    expect(user).toContain("exp-1");
  });
});

describe("buildStandardCvPrompts — montagem do par system/user", () => {
  it("deve devolver o system fixo e o user com a base", () => {
    const { system, user } = buildStandardCvPrompts(BUNDLE);
    expect(system).toBe(STANDARD_CV_SYSTEM_PROMPT);
    expect(user).toContain("exp-1");
  });
});
