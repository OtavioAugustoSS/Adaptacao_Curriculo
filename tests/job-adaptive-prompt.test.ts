import { describe, it, expect } from "vitest";
import {
  JOB_ADAPTIVE_CV_SYSTEM_PROMPT,
  buildJobAdaptiveCvUserPrompt,
  buildJobAdaptiveCvPrompts,
} from "@/server/llm/prompts/job-adaptive-cv";
import type { ProfileBundle } from "@/lib/schemas";
import type { JobAnalysis } from "@/server/llm/job-analysis";

// Testes do PROMPT do Modo 2 (US-08). O prompt é a 2ª camada do invariante
// anti-alucinação (ARCHITECTURE §6) e o ponto mais sensível do Modo 2: a vaga
// "puxa" o modelo a inventar requisitos. Verificamos que o system carrega as
// regras de NÃO INVENTAR + OMITIR, e que o user carrega a vaga + a base real.

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

const JOB_TEXT = "Vaga: Engenheiro de Software Sênior em Rust e Kubernetes.";

describe("Modo 2 — system prompt (regras anti-alucinação)", () => {
  it("deve conter a regra inegociável de não inventar", () => {
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("NÃO INVENTE NADA");
  });

  it("deve instruir a OMITIR o que a vaga pede e o usuário não tem (nunca preencher)", () => {
    // O risco específico do Modo 2: preencher requisitos da vaga. O prompt precisa
    // dizer explicitamente para OMITIR em vez de inventar.
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("OMITA");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT.toLowerCase()).toContain("nunca preencha");
    // Reforça que nem a vaga justifica inventar.
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT.toLowerCase()).toContain(
      "nem mesmo se a vaga pedir",
    );
  });

  it("deve manter o formato ResumeContent com sourceId obrigatório em experience", () => {
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain('"objective"');
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain('"experience"');
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("sourceId");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("OBRIGATÓRIO");
  });

  it("deve instruir a priorizar/reordenar/reescrever só itens reais que casam com a vaga", () => {
    const lower = JOB_ADAPTIVE_CV_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain("priorize");
    expect(lower).toContain("reordene");
    expect(lower).toContain("reescreva");
  });
});

describe("Modo 2 — user prompt (vaga + base)", () => {
  it("deve incluir o texto da vaga", () => {
    const user = buildJobAdaptiveCvUserPrompt(BUNDLE, JOB_TEXT);
    expect(user).toContain(JOB_TEXT);
  });

  it("deve incluir a base serializada (nome + id real que vira sourceId)", () => {
    const user = buildJobAdaptiveCvUserPrompt(BUNDLE, JOB_TEXT);
    expect(user).toContain("Otávio");
    expect(user).toContain("exp-1");
  });

  it("deve avisar para não extrair fatos da vaga para o currículo", () => {
    const user = buildJobAdaptiveCvUserPrompt(BUNDLE, JOB_TEXT);
    expect(user.toLowerCase()).toContain("não extraia fatos da vaga");
  });

  it("deve embutir a vaga verbatim mesmo com caracteres especiais (aspas/quebras/JSON)", () => {
    // A vaga é texto livre colado pelo usuário e vai cru no prompt (interpolado, não
    // re-serializado). Caracteres que poderiam quebrar JSON/markdown precisam passar
    // intactos — é só conteúdo de prompt, não estrutura.
    const messy = 'Vaga "Sênior" {backend}: 50% remoto\nbônus: R$ \\ "aspas"';
    const user = buildJobAdaptiveCvUserPrompt(BUNDLE, messy);
    expect(user).toContain(messy);
  });

  it("deve manter a base e a vaga em blocos distintos (vaga não vaza para dentro da base)", () => {
    const user = buildJobAdaptiveCvUserPrompt(BUNDLE, JOB_TEXT);
    const jobIdx = user.indexOf(JOB_TEXT);
    const baseIdx = user.indexOf("BASE DE DADOS DO USUÁRIO");
    // A vaga vem ANTES do bloco da base — são seções separadas e rotuladas.
    expect(jobIdx).toBeGreaterThanOrEqual(0);
    expect(baseIdx).toBeGreaterThan(jobIdx);
  });
});

describe("buildJobAdaptiveCvPrompts", () => {
  it("deve devolver o system fixo e o user com vaga + base", () => {
    const { system, user } = buildJobAdaptiveCvPrompts(BUNDLE, JOB_TEXT);
    expect(system).toBe(JOB_ADAPTIVE_CV_SYSTEM_PROMPT);
    expect(user).toContain(JOB_TEXT);
    expect(user).toContain("exp-1");
  });
});

// --- ADR-0027: adaptar é obrigatório + anti-encolhimento por regra + análise da vaga ---

const ANALYSIS: JobAnalysis = {
  role: "Engenheiro Back-end",
  seniority: "Pleno",
  domain: "back-end em nuvem",
  mustHave: ["Python", "microsserviços"],
  niceToHave: ["Kubernetes"],
  keywords: ["Python", "CI/CD", "MARCADOR_ANALISE"],
};

describe("Modo 2 — ADAPTAR é obrigatório (ADR-0027)", () => {
  it("deve exigir reordenar por relevância e objetivo focado na vaga (não genérico)", () => {
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("ADAPTAR É OBRIGATÓRIO");
    const lower = JOB_ADAPTIVE_CV_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain("reordene");
    expect(lower).toContain("focado na vaga");
    expect(lower).toContain("proibido"); // proíbe objetivo genérico (falha vista no Magalu)
  });

  it("deve manter o anti-encolhimento como regra sobre a base (sem gabarito para copiar)", () => {
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("NÃO ENCOLHA");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("TODOS os projetos");
    // O gabarito de copiar (currículo-referência do ADR-0022) NÃO existe mais.
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).not.toContain("CURRÍCULO PADRÃO DE REFERÊNCIA");
  });

  it("deve preservar os tokens do invariante anti-alucinação", () => {
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("NÃO INVENTE NADA");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("OMITA");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT.toLowerCase()).toContain("nunca preencha");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT.toLowerCase()).toContain(
      "nem mesmo se a vaga pedir",
    );
  });
});

describe("Modo 2 — injeção da ANÁLISE da vaga (ADR-0027)", () => {
  it("deve incluir o bloco ANÁLISE DA VAGA e as keywords quando a análise é fornecida", () => {
    const user = buildJobAdaptiveCvUserPrompt(BUNDLE, JOB_TEXT, ANALYSIS);
    expect(user).toContain("ANÁLISE DA VAGA");
    expect(user).toContain("MARCADOR_ANALISE"); // keyword da análise serializada
    // Deixa explícito que a análise é GUIA, não fonte de fatos.
    expect(user.toLowerCase()).toContain("todo fato vem da base");
  });

  it("NÃO deve incluir o bloco de análise quando ausente (resiliência)", () => {
    const user = buildJobAdaptiveCvUserPrompt(BUNDLE, JOB_TEXT);
    expect(user).not.toContain("ANÁLISE DA VAGA");
  });

  it("deve propagar a análise via buildJobAdaptiveCvPrompts", () => {
    const { user } = buildJobAdaptiveCvPrompts(BUNDLE, JOB_TEXT, ANALYSIS);
    expect(user).toContain("ANÁLISE DA VAGA");
    expect(user).toContain("MARCADOR_ANALISE");
  });
});
