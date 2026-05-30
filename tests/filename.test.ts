import { describe, it, expect } from "vitest";
import { slugify, buildTexFilename } from "@/server/resume/filename";

// Testes de COMPORTAMENTO do nome do arquivo .tex baixado (US-06, ADR-0014).
// Convenção: curriculo-<slug(fullName)>-<AAAA-MM-DD>.tex; fallback curriculo-<id>.tex.

describe("slugify", () => {
  it("deve normalizar nome com acentos e espaços em slug minúsculo com hífens", () => {
    expect(slugify("Otávio Augusto Souza Silva")).toBe("otavio-augusto-souza-silva");
  });

  it("deve remover acentos (José da Conceição -> jose-da-conceicao)", () => {
    expect(slugify("José da Conceição")).toBe("jose-da-conceicao");
  });

  it("deve colapsar múltiplos não-alfanuméricos num único hífen e aparar as pontas", () => {
    expect(slugify("  Maria   &   Cia  ")).toBe("maria-cia");
  });

  it("deve devolver string vazia quando não há caractere alfanumérico", () => {
    expect(slugify("!!! @@@")).toBe("");
  });
});

describe("buildTexFilename", () => {
  const date = new Date("2026-05-30T12:34:56.000Z");

  it("deve montar curriculo-<slug>-<AAAA-MM-DD>.tex a partir do nome e da data", () => {
    expect(buildTexFilename("Otávio Silva", date, "gr1")).toBe(
      "curriculo-otavio-silva-2026-05-30.tex",
    );
  });

  it("deve cair no fallback curriculo-<id>.tex quando o slug fica vazio", () => {
    expect(buildTexFilename("###", date, "gr1")).toBe("curriculo-gr1.tex");
  });
});
