import { describe, it, expect } from "vitest";
import {
  JOB_ADAPTIVE_CV_SYSTEM_PROMPT,
  buildJobAdaptiveCvUserPrompt,
  buildJobAdaptiveCvPrompts,
} from "@/server/llm/prompts/job-adaptive-cv";
import type { ProfileBundle, ResumeContent } from "@/lib/schemas";

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

// --- ADR-0022: política "Equilibrado" + referência de profundidade ---

const BASE_CONTENT: ResumeContent = {
  objective: "Resumo profundo",
  education: [],
  skills: [],
  experience: [
    {
      sourceId: "exp-1",
      role: "Dev",
      company: "Acme",
      period: "2020 — Atual",
      bullets: ["contexto, fez X com Y, impacto Z, porque Y resolve W"],
    },
  ],
  projects: [
    {
      title: "Projeto Bússola",
      description: "plataforma",
      bullets: ["b1", "b2"],
      techStack: ["React", "Node"],
    },
  ],
  languages: [],
  courses: [],
};

describe("Modo 2 — filosofia Equilibrado (ADR-0022: não enxugar demais)", () => {
  it("deve trocar o viés de enxugar pela orientação de manter riqueza", () => {
    // A frase antiga que enviesava a IA a cortar NÃO pode mais existir.
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).not.toContain(
      "Um currículo mais curto e 100% verdadeiro é melhor que um inflado",
    );
    // E o prompt passa a exigir manter a maioria dos itens e a profundidade.
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("MAIORIA dos projetos");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("PROFUNDIDADE");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT.toLowerCase()).toContain("ats");
  });

  it("deve preservar os tokens do invariante anti-alucinação", () => {
    // A virada de filosofia NÃO pode afrouxar o invariante.
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("NÃO INVENTE NADA");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT).toContain("OMITA");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT.toLowerCase()).toContain("nunca preencha");
    expect(JOB_ADAPTIVE_CV_SYSTEM_PROMPT.toLowerCase()).toContain(
      "nem mesmo se a vaga pedir",
    );
  });
});

describe("Modo 2 — referência de profundidade (baseContent)", () => {
  it("deve incluir o bloco de referência e o conteúdo base quando baseContent é fornecido", () => {
    const user = buildJobAdaptiveCvUserPrompt(BUNDLE, JOB_TEXT, BASE_CONTENT);
    expect(user).toContain("CURRÍCULO PADRÃO DE REFERÊNCIA");
    expect(user).toContain("Projeto Bússola"); // conteúdo do baseContent serializado
    // Continua deixando claro que NÃO é fonte de fatos novos.
    expect(user.toLowerCase()).toContain("não é fonte de fatos");
  });

  it("NÃO deve incluir o bloco de referência quando baseContent é ausente (retrocompat)", () => {
    const user = buildJobAdaptiveCvUserPrompt(BUNDLE, JOB_TEXT);
    expect(user).not.toContain("CURRÍCULO PADRÃO DE REFERÊNCIA");
  });

  it("deve propagar o baseContent via buildJobAdaptiveCvPrompts", () => {
    const { user } = buildJobAdaptiveCvPrompts(BUNDLE, JOB_TEXT, BASE_CONTENT);
    expect(user).toContain("CURRÍCULO PADRÃO DE REFERÊNCIA");
    expect(user).toContain("Projeto Bússola");
  });
});
