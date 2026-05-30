import { describe, it, expect } from "vitest";
import {
  validateTraceability,
  normalize,
} from "@/server/resume/validate-traceability";
import type { ProfileBundle, ResumeContent } from "@/lib/schemas";

// Cobertura OBRIGATÓRIA do guardrail (ARCHITECTURE §8, ADR-0008/0015).
// Testes de COMPORTAMENTO das regras congeladas no ADR-0015:
// - ERRO forte = entidade (experiência/formação/projeto) que não casa com a base.
// - AVISO = número novo (objective/bullets) ou skill nova não rastreável.
// Função pura: montamos base + saída e asseguramos a classificação errors/warnings.

// Base de exemplo com ids reais (os ids viram os sourceId rastreáveis da saída).
function makeBundle(overrides: Partial<ProfileBundle> = {}): ProfileBundle {
  return {
    profile: { id: "p1", fullName: "Otávio", summary: "Engenheiro de software." },
    experiences: [
      {
        id: "exp-1",
        company: "Acme",
        role: "Dev",
        startDate: "2020",
        current: true,
        bullets: ["Reduziu latência em 30% no checkout"],
        order: 0,
      },
    ],
    educations: [
      {
        id: "edu-1",
        institution: "USP",
        degree: "BSc",
        startDate: "2014",
        order: 0,
      },
    ],
    skills: [
      { id: "sk-1", category: "Linguagens", name: "TypeScript", order: 0 },
      { id: "sk-2", category: "Linguagens", name: "Python", order: 1 },
    ],
    projects: [
      {
        id: "prj-1",
        name: "Compilador",
        description: "Um compilador de brinquedo",
        bullets: [],
        techStack: ["Rust"],
        order: 0,
      },
    ],
    languages: [],
    courses: [],
    ...overrides,
  };
}

// Saída "bem-comportada" (100% rastreável à base acima).
function makeContent(overrides: Partial<ResumeContent> = {}): ResumeContent {
  return {
    objective: "Engenheiro de software focado em backend.",
    education: [{ sourceId: "edu-1", institution: "USP", degree: "BSc" }],
    skills: [{ category: "Linguagens", items: ["TypeScript"] }],
    experience: [
      {
        sourceId: "exp-1",
        role: "Dev",
        company: "Acme",
        period: "2020 — Atual",
        bullets: ["Reduziu latência em 30% no checkout"],
      },
    ],
    projects: [{ sourceId: "prj-1", title: "Compilador", description: "Compilador" }],
    ...overrides,
  };
}

describe("normalize", () => {
  it("deve baixar caixa, remover acentos e colapsar espaços", () => {
    expect(normalize("  Olá   MUNDO Ção ")).toBe("ola mundo cao");
  });
});

describe("validateTraceability — conteúdo 100% rastreável", () => {
  it("deve devolver relatório vazio quando tudo casa com a base", () => {
    const report = validateTraceability(makeContent(), makeBundle());
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });
});

describe("validateTraceability — erros fortes de experiência", () => {
  it("deve acusar erro quando a experiência não tem sourceId rastreável", () => {
    const content = makeContent({
      experience: [
        {
          sourceId: "exp-inexistente",
          role: "Dev",
          company: "Acme",
          period: "2020",
          bullets: [],
        },
      ],
    });
    const report = validateTraceability(content, makeBundle());
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].field).toBe("experience[0].sourceId");
  });

  it("deve acusar erro quando a empresa diverge do item da base referenciado", () => {
    const content = makeContent({
      experience: [
        {
          sourceId: "exp-1",
          role: "Dev",
          company: "Empresa Fantasma",
          period: "2020",
          bullets: [],
        },
      ],
    });
    const report = validateTraceability(content, makeBundle());
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].field).toBe("experience[0].company");
    expect(report.errors[0].value).toBe("Empresa Fantasma");
  });

  it("deve aceitar empresa com diferença só de caixa/acentos (normalização)", () => {
    const bundle = makeBundle({
      experiences: [
        {
          id: "exp-1",
          company: "Açúcar S.A.",
          role: "Dev",
          startDate: "2020",
          current: true,
          bullets: [],
          order: 0,
        },
      ],
    });
    const content = makeContent({
      experience: [
        {
          sourceId: "exp-1",
          role: "Dev",
          company: "ACUCAR S.A.",
          period: "2020",
          bullets: [],
        },
      ],
    });
    const report = validateTraceability(content, bundle);
    expect(report.errors).toEqual([]);
  });
});

describe("validateTraceability — erros fortes de formação e projeto", () => {
  it("deve acusar erro quando a formação não casa com a base (sem sourceId)", () => {
    const content = makeContent({
      education: [{ institution: "Universidade Inventada", degree: "PhD" }],
    });
    const report = validateTraceability(content, makeBundle());
    expect(report.errors.some((e) => e.field === "education[0].institution")).toBe(true);
  });

  it("deve aceitar formação que casa por institution normalizada sem sourceId", () => {
    const content = makeContent({
      education: [{ institution: "usp", degree: "BSc" }],
    });
    const report = validateTraceability(content, makeBundle());
    expect(report.errors).toEqual([]);
  });

  it("deve acusar erro quando o sourceId da formação aponta para outra instituição (rename)", () => {
    // sourceId real (edu-1 = USP) mas institution trocada -> a checagem via sourceId
    // exige que a institution case com a do item referenciado. Caso anti-alucinação:
    // o modelo manteve um id real mas renomeou a entidade.
    const content = makeContent({
      education: [{ sourceId: "edu-1", institution: "Stanford", degree: "BSc" }],
    });
    const report = validateTraceability(content, makeBundle());
    expect(report.errors.some((e) => e.field === "education[0].institution")).toBe(true);
  });

  it("deve acusar erro quando o projeto não casa com nenhum projeto da base", () => {
    const content = makeContent({
      projects: [{ title: "Projeto Fantasma", description: "x" }],
    });
    const report = validateTraceability(content, makeBundle());
    expect(report.errors.some((e) => e.field === "projects[0].title")).toBe(true);
  });

  it("deve acusar erro quando o sourceId do projeto aponta para outro título (rename)", () => {
    // sourceId real (prj-1 = Compilador) mas title trocado -> erro. Simétrico ao
    // rename de formação: id verdadeiro, entidade renomeada.
    const content = makeContent({
      projects: [{ sourceId: "prj-1", title: "Sistema Bancário", description: "x" }],
    });
    const report = validateTraceability(content, makeBundle());
    expect(report.errors.some((e) => e.field === "projects[0].title")).toBe(true);
  });
});

describe("validateTraceability — avisos (número / skill nova)", () => {
  it("deve avisar quando um número do bullet não existe no corpus da base", () => {
    const content = makeContent({
      experience: [
        {
          sourceId: "exp-1",
          role: "Dev",
          company: "Acme",
          period: "2020 — Atual",
          bullets: ["Aumentou as vendas em 87%"],
        },
      ],
    });
    const report = validateTraceability(content, makeBundle());
    // 87 não está na base (lá só existe "30%"); vira aviso, não erro.
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.value === "87%")).toBe(true);
  });

  it("NÃO deve avisar de número que já existe na base (ex.: 30% real)", () => {
    // O content padrão tem "30%" nos bullets, e a base também tem "30%".
    const report = validateTraceability(makeContent(), makeBundle());
    expect(report.warnings.filter((w) => w.value === "30%")).toEqual([]);
  });

  it("deve avisar quando uma skill da saída não está na base", () => {
    const content = makeContent({
      skills: [{ category: "Linguagens", items: ["TypeScript", "Go"] }],
    });
    const report = validateTraceability(content, makeBundle());
    // TypeScript existe na base; Go não -> só Go vira aviso.
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.value === "Go")).toBe(true);
    expect(report.warnings.some((w) => w.value === "TypeScript")).toBe(false);
  });

  it("deve avisar de número novo no objective", () => {
    const content = makeContent({ objective: "10 anos de experiência em backend." });
    const report = validateTraceability(content, makeBundle());
    expect(report.warnings.some((w) => w.field === "objective" && w.value === "10")).toBe(
      true,
    );
  });
});

describe("validateTraceability — agregação de múltiplos erros", () => {
  it("deve reportar TODOS os erros de entidade numa só passada (experiência + formação + projeto)", () => {
    // Uma saída com três entidades fora da base ao mesmo tempo: o relatório deve
    // listar os três (não parar no primeiro), para diagnóstico/regeneração completa.
    const content = makeContent({
      experience: [
        {
          sourceId: "exp-inexistente",
          role: "Dev",
          company: "Acme",
          period: "2020",
          bullets: [],
        },
      ],
      education: [{ institution: "Universidade Fantasma", degree: "PhD" }],
      projects: [{ title: "Projeto Fantasma", description: "x" }],
    });
    const report = validateTraceability(content, makeBundle());

    expect(report.errors.some((e) => e.field === "experience[0].sourceId")).toBe(true);
    expect(report.errors.some((e) => e.field === "education[0].institution")).toBe(true);
    expect(report.errors.some((e) => e.field === "projects[0].title")).toBe(true);
    expect(report.errors).toHaveLength(3);
  });
});

describe("validateTraceability — avisos em base sem skills/sem corpus", () => {
  it("deve avisar de toda skill da saída quando a base não tem nenhuma skill", () => {
    const bundle = makeBundle({ skills: [] });
    const content = makeContent({
      skills: [{ category: "Linguagens", items: ["TypeScript"] }],
    });
    const report = validateTraceability(content, bundle);
    // Sem skills na base, qualquer item da saída é "possivelmente novo" (aviso, não erro).
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.value === "TypeScript")).toBe(true);
  });
});

describe("validateTraceability — erro e aviso convivem", () => {
  it("deve reportar erro de entidade E aviso de número ao mesmo tempo", () => {
    const content = makeContent({
      experience: [
        {
          sourceId: "exp-1",
          role: "Dev",
          company: "Outra Empresa", // erro de entidade
          period: "2020",
          bullets: ["Cresceu 99% a receita"], // aviso de número
        },
      ],
    });
    const report = validateTraceability(content, makeBundle());
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.warnings.some((w) => w.value === "99%")).toBe(true);
  });
});
