import { describe, it, expect } from "vitest";
import {
  resumeModeLabel,
  resumeModeBadge,
  visibleWarnings,
  warningCount,
  formatResumeDate,
} from "@/lib/presentation/resume-meta";
import {
  countBaseItems,
  formatItemCount,
  baseStatChips,
} from "@/lib/presentation/base-stats";
import { resolveTheme, nextTheme, DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/presentation/theme";
import type { ProfileBundle, TraceabilityReport } from "@/lib/schemas";

// Endurecimento da camada de APRESENTAÇÃO da Fatia 4 (QA / task #9). Exercita os
// helpers PUROS que o frontend extraiu dos componentes (src/lib/presentation/
// {resume-meta,base-stats,theme}.ts), cobrindo as BORDAS e as invariantes de produto
// travadas — sem testar render (não há DOM lib; os helpers são a lógica testável).
// Não retesta o renderer/.tex (já coberto em render-latex/escape-latex/validate-traceability).

// --- ADR-0016: o card de Currículos usa o RÓTULO DO MODO, NUNCA o texto da vaga ---

describe("resumeModeLabel — invariante ADR-0016 (rótulo do modo, nunca a vaga)", () => {
  it("deve usar exatamente o rótulo do modo, independente de qualquer texto de vaga", () => {
    // Mesmo que existisse uma vaga "Engenheiro Sênior na Acme", o rótulo do card é
    // derivado SÓ do modo — a função sequer recebe a vaga como entrada. Este teste
    // documenta a garantia: a saída é uma constante por modo.
    expect(resumeModeLabel("STANDARD")).toBe("Currículo padrão");
    expect(resumeModeLabel("JOB_ADAPTIVE")).toBe("Currículo adaptado à vaga");
  });

  it("nunca deve vazar a palavra 'vaga' como se fosse título da vaga (é rótulo fixo)", () => {
    // O rótulo do Modo 2 contém 'vaga' por design ("adaptado à vaga"), mas é texto
    // fixo do produto, não o conteúdo da vaga do usuário. Garantimos que o conjunto
    // de rótulos possíveis é fechado (exatamente os dois travados).
    const labels = (["STANDARD", "JOB_ADAPTIVE"] as const).map(resumeModeLabel);
    expect(new Set(labels)).toEqual(
      new Set(["Currículo padrão", "Currículo adaptado à vaga"]),
    );
  });
});

describe("resumeModeBadge — badge curto por modo", () => {
  it("deve mapear cada modo ao seu badge curto e nada além disso", () => {
    expect(resumeModeBadge("STANDARD")).toBe("Padrão");
    expect(resumeModeBadge("JOB_ADAPTIVE")).toBe("Adaptado");
  });
});

// --- Gating de avisos: só warnings (>0), ERRORS nunca chegam à UI ---

describe("visibleWarnings / warningCount — gating de avisos (US-10 / ADR-0015)", () => {
  it("deve devolver [] e 0 para relatório null ou undefined", () => {
    expect(visibleWarnings(null)).toEqual([]);
    expect(visibleWarnings(undefined)).toEqual([]);
    expect(warningCount(null)).toBe(0);
    expect(warningCount(undefined)).toBe(0);
  });

  it("deve devolver [] e 0 quando warnings está vazio mesmo havendo errors", () => {
    // Caso crítico: o relatório tem ERROS mas zero avisos. A UI não pode mostrar nada
    // (errors disparam regeneração no backend e NUNCA aparecem na tela).
    const report: TraceabilityReport = {
      errors: [
        { field: "experience[0].company", value: "Empresa Fantasma", reason: "fora da base" },
      ],
      warnings: [],
    };
    expect(visibleWarnings(report)).toEqual([]);
    expect(warningCount(report)).toBe(0);
  });

  it("deve devolver SÓ os warnings (descartando errors) quando ambos existem", () => {
    const report: TraceabilityReport = {
      errors: [
        { field: "education[0].institution", value: "Stanford", reason: "rename" },
      ],
      warnings: [
        { field: "objective", value: "10", reason: "número novo" },
        { field: "skills", value: "Go", reason: "skill nova" },
      ],
    };
    const shown = visibleWarnings(report);
    expect(shown).toHaveLength(2);
    expect(warningCount(report)).toBe(2);
    // Nenhum item de errors pode aparecer entre os avisos exibidos.
    expect(shown.some((w) => w.value === "Stanford")).toBe(false);
    expect(shown.map((w) => w.value)).toEqual(["10", "Go"]);
  });
});

// --- formatResumeDate: dd/mm/aaaa HH:mm (PT-BR) + bordas ---

describe("formatResumeDate — formatação PT-BR e bordas", () => {
  it("deve devolver string vazia para data inválida (string e Date inválido)", () => {
    expect(formatResumeDate("not-a-date")).toBe("");
    expect(formatResumeDate(new Date("nope"))).toBe("");
  });

  it("deve formatar dd/mm/aaaa HH:mm a partir de um Date válido", () => {
    // Fixamos o instante em UTC e validamos o FORMATO (não o fuso): dois dígitos de
    // dia/mês, ano de 4 dígitos, hora:minuto. Evita acoplar ao timezone do runner.
    const out = formatResumeDate(new Date("2026-05-30T13:05:00.000Z"));
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4}.*\d{2}:\d{2}$/);
  });

  it("deve aceitar tanto string ISO quanto objeto Date", () => {
    const iso = formatResumeDate("2026-05-30T13:05:00.000Z");
    const obj = formatResumeDate(new Date("2026-05-30T13:05:00.000Z"));
    expect(iso).toBe(obj);
    expect(iso).not.toBe("");
  });
});

// --- Contagens da base: campos certos do ProfileBundle, plural correto ---

function emptyBundle(): ProfileBundle {
  return {
    profile: { fullName: "Otávio" },
    experiences: [],
    educations: [],
    skills: [],
    projects: [],
    languages: [],
    courses: [],
  };
}

describe("countBaseItems — soma das 6 listas reais do ProfileBundle", () => {
  it("deve usar os campos certos (incl. 'educations' plural) e somar todos", () => {
    // Guarda contra um bug clássico: contar 'education' (singular, do ResumeContent)
    // em vez de 'educations' (plural, do ProfileBundle). Damos contagens distintas
    // por lista para que um campo trocado mude a soma.
    const bundle: ProfileBundle = {
      ...emptyBundle(),
      experiences: [
        { company: "A", role: "Dev", startDate: "2020" },
        { company: "B", role: "Dev", startDate: "2021" },
      ] as ProfileBundle["experiences"],
      educations: [
        { institution: "USP", degree: "BSc", startDate: "2018" },
      ] as ProfileBundle["educations"],
      skills: [
        { category: "L", name: "TS" },
        { category: "L", name: "Py" },
        { category: "L", name: "Go" },
      ] as ProfileBundle["skills"],
      projects: [{ name: "P", description: "d" }] as ProfileBundle["projects"],
      languages: [
        { name: "EN", proficiency: "C1" },
        { name: "ES", proficiency: "B2" },
      ] as ProfileBundle["languages"],
      courses: [{ title: "C", issuer: "I", date: "2021" }] as ProfileBundle["courses"],
    };
    // 2 + 1 + 3 + 1 + 2 + 1 = 10
    expect(countBaseItems(bundle)).toBe(10);
  });
});

describe("formatItemCount — plural PT-BR para o nav-sub", () => {
  it("deve usar singular só para exatamente 1", () => {
    expect(formatItemCount(1)).toBe("1 item");
  });

  it("deve usar plural para 0 e para N>1", () => {
    expect(formatItemCount(0)).toBe("0 itens");
    expect(formatItemCount(2)).toBe("2 itens");
    expect(formatItemCount(42)).toBe("42 itens");
  });
});

describe("baseStatChips — chips da Home (experiência/projeto/habilidade)", () => {
  it("deve omitir categorias com contagem zero", () => {
    // Só experiências preenchidas: os chips de projeto e habilidade não aparecem
    // (nada de placeholder fictício — regra de produto US-10 §Início).
    const bundle: ProfileBundle = {
      ...emptyBundle(),
      experiences: [
        { company: "A", role: "Dev", startDate: "2020" },
      ] as ProfileBundle["experiences"],
    };
    expect(baseStatChips(bundle)).toEqual(["1 experiência"]);
  });

  it("deve pluralizar cada chip conforme sua própria contagem", () => {
    const bundle: ProfileBundle = {
      ...emptyBundle(),
      experiences: [
        { company: "A", role: "Dev", startDate: "2020" },
        { company: "B", role: "Dev", startDate: "2021" },
      ] as ProfileBundle["experiences"],
      projects: [{ name: "P", description: "d" }] as ProfileBundle["projects"],
      skills: [
        { category: "L", name: "TS" },
        { category: "L", name: "Py" },
      ] as ProfileBundle["skills"],
    };
    // 2 experiências (plural), 1 projeto (singular), 2 habilidades (plural).
    expect(baseStatChips(bundle)).toEqual([
      "2 experiências",
      "1 projeto",
      "2 habilidades",
    ]);
  });

  it("deve devolver [] numa base totalmente vazia", () => {
    expect(baseStatChips(emptyBundle())).toEqual([]);
  });
});

// --- Tema: default dark + chave de persistência + resolução de valor cru ---

describe("tema — default dark, chave cv-theme e resolução de valor salvo", () => {
  it("deve ter default DARK e chave de persistência 'cv-theme' (US-10 travado)", () => {
    expect(DEFAULT_THEME).toBe("dark");
    expect(THEME_STORAGE_KEY).toBe("cv-theme");
  });

  it("deve aceitar valores válidos salvos e cair no default para qualquer outro", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
    // Valores inválidos/ausentes (inclusive string vazia e lixo) -> default dark.
    expect(resolveTheme(null)).toBe("dark");
    expect(resolveTheme(undefined)).toBe("dark");
    expect(resolveTheme("")).toBe("dark");
    expect(resolveTheme("DARK")).toBe("dark"); // case-sensitive: "DARK" != "dark"
    expect(resolveTheme("azul")).toBe("dark");
  });

  it("nextTheme deve ser involutivo (aplicar 2x volta ao original)", () => {
    expect(nextTheme(nextTheme("light"))).toBe("light");
    expect(nextTheme(nextTheme("dark"))).toBe("dark");
  });
});
