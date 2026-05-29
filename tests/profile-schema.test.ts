import { describe, it, expect } from "vitest";
import { ProfileBundleSchema, ProfileSchema } from "@/lib/schemas";

// Testes de COMPORTAMENTO da validação Zod do contrato de perfil (US-02).
// O ProfileBundleSchema é o payload de GET/PUT /api/profile e o input do LLM —
// é a fronteira que decide o que entra no sistema. Cobrimos: campos obrigatórios,
// rejeição de inválidos, defaults das listas e coerção de defaults dos itens.

describe("ProfileSchema", () => {
  it("deve aceitar um perfil com apenas fullName (único obrigatório)", () => {
    const result = ProfileSchema.safeParse({ fullName: "Otávio" });
    expect(result.success).toBe(true);
  });

  it("deve rejeitar um perfil sem fullName", () => {
    const result = ProfileSchema.safeParse({ email: "x@y.com" });
    expect(result.success).toBe(false);
  });

  it("deve rejeitar fullName vazio (min(1))", () => {
    const result = ProfileSchema.safeParse({ fullName: "" });
    expect(result.success).toBe(false);
  });

  it("deve manter campos de contato opcionais como ausentes quando não fornecidos", () => {
    const parsed = ProfileSchema.parse({ fullName: "Otávio" });
    expect(parsed.phone).toBeUndefined();
    expect(parsed.email).toBeUndefined();
  });
});

describe("ProfileBundleSchema — defaults das listas", () => {
  it("deve aplicar [] em todas as listas quando só o profile é fornecido", () => {
    const parsed = ProfileBundleSchema.parse({ profile: { fullName: "Otávio" } });
    expect(parsed.experiences).toEqual([]);
    expect(parsed.educations).toEqual([]);
    expect(parsed.skills).toEqual([]);
    expect(parsed.projects).toEqual([]);
    expect(parsed.languages).toEqual([]);
    expect(parsed.courses).toEqual([]);
  });

  it("deve rejeitar um bundle sem profile", () => {
    const result = ProfileBundleSchema.safeParse({ experiences: [] });
    expect(result.success).toBe(false);
  });

  it("deve rejeitar um bundle cujo profile é inválido (fullName ausente)", () => {
    const result = ProfileBundleSchema.safeParse({ profile: { email: "x@y.com" } });
    expect(result.success).toBe(false);
  });
});

describe("ProfileBundleSchema — defaults e validação de itens", () => {
  it("deve aplicar defaults em uma experiência (current=false, bullets=[], order=0)", () => {
    const parsed = ProfileBundleSchema.parse({
      profile: { fullName: "Otávio" },
      experiences: [{ company: "Acme", role: "Dev", startDate: "2020" }],
    });
    const exp = parsed.experiences[0];
    expect(exp.current).toBe(false);
    expect(exp.bullets).toEqual([]);
    expect(exp.order).toBe(0);
  });

  it("deve rejeitar uma experiência sem campos obrigatórios (company/role/startDate)", () => {
    const result = ProfileBundleSchema.safeParse({
      profile: { fullName: "Otávio" },
      experiences: [{ company: "Acme" }],
    });
    expect(result.success).toBe(false);
  });

  it("deve aplicar defaults [] em bullets e techStack de um projeto", () => {
    const parsed = ProfileBundleSchema.parse({
      profile: { fullName: "Otávio" },
      projects: [{ name: "Proj", description: "Desc" }],
    });
    const proj = parsed.projects[0];
    expect(proj.bullets).toEqual([]);
    expect(proj.techStack).toEqual([]);
  });

  it("deve rejeitar order negativo num item (int >= 0)", () => {
    const result = ProfileBundleSchema.safeParse({
      profile: { fullName: "Otávio" },
      skills: [{ category: "Lang", name: "TS", order: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it("deve preservar os valores fornecidos sem sobrescrever com defaults", () => {
    const parsed = ProfileBundleSchema.parse({
      profile: { fullName: "Otávio" },
      experiences: [
        {
          company: "Acme",
          role: "Dev",
          startDate: "2020",
          current: true,
          bullets: ["entregou v1"],
          order: 3,
        },
      ],
    });
    const exp = parsed.experiences[0];
    expect(exp.current).toBe(true);
    expect(exp.bullets).toEqual(["entregou v1"]);
    expect(exp.order).toBe(3);
  });
});
