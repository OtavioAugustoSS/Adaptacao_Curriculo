import { describe, it, expect } from "vitest";
import {
  EducationSchema,
  ProfileBundleSchema,
  ProfileImportRequestSchema,
  ImportProfileBundleSchema,
} from "@/lib/schemas";

// Testes de COMPORTAMENTO dos schemas Zod da Fatia 5 (US-11/US-12, ADR-0018).
// Três fronteiras de entrada:
// - EducationSchema.current: o campo novo (US-12), default false, aceita true.
// - ProfileImportRequestSchema: o contrato do POST /api/profile/import ({ rawText }).
// - ImportProfileBundleSchema (tolerante) vs ProfileBundleSchema (estrito): a decisão
//   do ADR-0018 §5 — o rascunho do import aceita fullName "", a persistência NÃO.

describe("EducationSchema — campo current (US-12)", () => {
  // Uma formação mínima válida; cada teste sobrescreve o relevante.
  const base = {
    institution: "USP",
    degree: "BSc",
    startDate: "2018",
  };

  it("deve aplicar default false quando current está ausente", () => {
    const parsed = EducationSchema.parse(base);
    expect(parsed.current).toBe(false);
  });

  it("deve aceitar current: true (formação em andamento)", () => {
    const parsed = EducationSchema.parse({ ...base, current: true });
    expect(parsed.current).toBe(true);
  });

  it("deve preservar current: false explícito sem sobrescrever", () => {
    const parsed = EducationSchema.parse({ ...base, current: false });
    expect(parsed.current).toBe(false);
  });

  it("deve rejeitar current com tipo não-booleano", () => {
    const result = EducationSchema.safeParse({ ...base, current: "sim" });
    expect(result.success).toBe(false);
  });
});

describe("ProfileImportRequestSchema — request do POST /api/profile/import", () => {
  it("deve aceitar um rawText não-vazio", () => {
    const result = ProfileImportRequestSchema.safeParse({ rawText: "x" });
    expect(result.success).toBe(true);
  });

  it("deve rejeitar rawText vazio (min 1)", () => {
    const result = ProfileImportRequestSchema.safeParse({ rawText: "" });
    expect(result.success).toBe(false);
  });

  it("deve rejeitar quando rawText está ausente", () => {
    const result = ProfileImportRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("ImportProfileBundleSchema vs ProfileBundleSchema — tolerância do fullName (ADR-0018 §5)", () => {
  it("a variante tolerante deve ACEITAR profile.fullName vazio (dump sem nome)", () => {
    const result = ImportProfileBundleSchema.safeParse({
      profile: { fullName: "" },
    });
    expect(result.success).toBe(true);
  });

  it("a variante tolerante deve aplicar fullName \"\" por default quando ausente", () => {
    const parsed = ImportProfileBundleSchema.parse({ profile: {} });
    expect(parsed.profile.fullName).toBe("");
  });

  it("o schema ESTRITO deve REJEITAR profile.fullName vazio (barreira na persistência)", () => {
    const result = ProfileBundleSchema.safeParse({ profile: { fullName: "" } });
    expect(result.success).toBe(false);
  });

  it("a variante tolerante deve seguir aplicando os defaults das listas e dos itens", () => {
    // Tolerância é só no fullName; o resto do bundle continua igual ao estrito.
    const parsed = ImportProfileBundleSchema.parse({
      profile: { fullName: "Otávio" },
      educations: [{ institution: "USP", degree: "BSc", startDate: "2022", current: true }],
    });
    expect(parsed.experiences).toEqual([]);
    expect(parsed.educations[0].current).toBe(true);
    expect(parsed.educations[0].order).toBe(0);
  });
});
