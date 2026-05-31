import { describe, it, expect } from "vitest";
import {
  ResumeContentSchema,
  ResumeProjectItemSchema,
  GenerateRequestSchema,
  GeneratedResumeSchema,
} from "@/lib/schemas";

// Testes de COMPORTAMENTO do contrato ADITIVO da Fatia 7 (ADR-0020/0021).
// O ResumeContentSchema é o núcleo do guardrail e estava CONGELADO; as mudanças são
// só aditivas (languages/courses + project.bullets/techStack), com defaults [] para
// não quebrar quem já lê o schema sem esses campos. GenerateRequestSchema ganhou
// name? (opcional); GeneratedResumeSchema exige name (rótulo do usuário). Verificamos
// os defaults, a aceitação dos campos novos e a obrigatoriedade do name.

// Um ResumeContent mínimo SEM os campos novos (forma antiga). O schema deve aceitá-lo
// e aplicar os defaults — é o que garante a compatibilidade aditiva.
const LEGACY_CONTENT = {
  objective: "Resumo",
  education: [],
  skills: [],
  experience: [],
  projects: [],
};

describe("ResumeContentSchema — campos aditivos com default (ADR-0020)", () => {
  it("deve aceitar um ResumeContent sem languages/courses e aplicar default []", () => {
    const parsed = ResumeContentSchema.parse(LEGACY_CONTENT);
    expect(parsed.languages).toEqual([]);
    expect(parsed.courses).toEqual([]);
  });

  it("deve aceitar languages e courses preenchidos", () => {
    const parsed = ResumeContentSchema.parse({
      ...LEGACY_CONTENT,
      languages: [{ name: "Inglês", proficiency: "Avançado" }],
      courses: [{ title: "AWS", issuer: "Amazon", date: "2023" }],
    });
    expect(parsed.languages[0].name).toBe("Inglês");
    expect(parsed.courses[0].title).toBe("AWS");
  });

  it("deve aplicar default [] em project.bullets/techStack quando ausentes", () => {
    const proj = ResumeProjectItemSchema.parse({
      title: "Compilador",
      description: "Um compilador",
    });
    expect(proj.bullets).toEqual([]);
    expect(proj.techStack).toEqual([]);
  });

  it("deve aceitar project.bullets/techStack preenchidos", () => {
    const proj = ResumeProjectItemSchema.parse({
      title: "Compilador",
      description: "Um compilador",
      bullets: ["Fez o parser"],
      techStack: ["Rust"],
    });
    expect(proj.bullets).toEqual(["Fez o parser"]);
    expect(proj.techStack).toEqual(["Rust"]);
  });
});

describe("GenerateRequestSchema — name opcional (ADR-0021)", () => {
  it("deve aceitar o request sem name (default aplicado no servidor)", () => {
    const parsed = GenerateRequestSchema.parse({ mode: "STANDARD" });
    expect(parsed.name).toBeUndefined();
  });

  it("deve aceitar o request com name", () => {
    const parsed = GenerateRequestSchema.parse({ mode: "STANDARD", name: "Meu CV" });
    expect(parsed.name).toBe("Meu CV");
  });

  it("deve preservar o refine de jobText no Modo 2 (name não o afrouxa)", () => {
    const ok = GenerateRequestSchema.safeParse({ mode: "JOB_ADAPTIVE", name: "x" });
    expect(ok.success).toBe(false); // jobText ainda é obrigatório no Modo 2
  });
});

describe("GeneratedResumeSchema — name obrigatório (ADR-0021)", () => {
  const BASE = {
    id: "gr1",
    name: "Currículo padrão — 30/05/2026",
    mode: "STANDARD" as const,
    modelId: "meta/llama-3.3-70b-instruct",
    contentJson: LEGACY_CONTENT,
    texOutput: "\\documentclass{resume}",
    createdAt: "2026-05-30T00:00:00.000Z",
  };

  it("deve exigir name (parse falha quando ausente)", () => {
    const { name: _omit, ...semNome } = BASE;
    expect(GeneratedResumeSchema.safeParse(semNome).success).toBe(false);
  });

  it("deve aceitar um GeneratedResume com name", () => {
    const parsed = GeneratedResumeSchema.parse(BASE);
    expect(parsed.name).toBe("Currículo padrão — 30/05/2026");
    // O contentJson aninhado também ganha os defaults aditivos.
    expect(parsed.contentJson.languages).toEqual([]);
    expect(parsed.contentJson.courses).toEqual([]);
  });
});
