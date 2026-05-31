import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { ProfileBundle, ResumeContent } from "@/lib/schemas";
import { LLMError } from "@/server/llm/provider";

// Testes de COMPORTAMENTO da rota POST /api/resumes/generate (US-05).
// Mockamos as FRONTEIRAS (repos de dados + fábrica do LLMProvider) e exercitamos
// o orquestrador: validação do request, pré-requisito (422), caminho feliz (persiste
// e devolve GeneratedResume) e erro do LLM (502). Sem rede, sem banco.

// --- Mocks de fronteira -----------------------------------------------------

const getProfileBundle = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/profile-repo", () => ({ getProfileBundle }));

const createGeneratedResume = vi.hoisted(() => vi.fn());
const getGeneratedResumeById = vi.hoisted(() => vi.fn());
const getDefaultResume = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/resume-repo", () => ({
  createGeneratedResume,
  getGeneratedResumeById,
  getDefaultResume,
}));

const createJobPosting = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/job-repo", () => ({ createJobPosting }));

const generateResumeContent = vi.hoisted(() => vi.fn());
const analyzeJob = vi.hoisted(() => vi.fn());
vi.mock("@/server/llm", () => ({
  getLLMProvider: () => ({ generateResumeContent, analyzeJob }),
}));

import { POST } from "@/app/api/resumes/generate/route";

// --- Helpers ----------------------------------------------------------------

// Um NextRequest mínimo: só o .json() importa para o handler.
function makeRequest(body: unknown, opts: { invalidJson?: boolean } = {}): NextRequest {
  return {
    json: opts.invalidJson
      ? async () => {
          throw new SyntaxError("bad json");
        }
      : async () => body,
  } as unknown as NextRequest;
}

const BUNDLE_OK: ProfileBundle = {
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

const BUNDLE_EMPTY: ProfileBundle = {
  profile: { fullName: "" },
  experiences: [],
  educations: [],
  skills: [],
  projects: [],
  languages: [],
  courses: [],
};

// Base no LIMITE do pré-requisito (ADR-0014): nome + SÓ uma formação, zero
// experiência. Deve PASSAR (não cai no 422) e seguir para a geração.
const BUNDLE_EDU_ONLY: ProfileBundle = {
  profile: { fullName: "Otávio" },
  experiences: [],
  educations: [
    {
      id: "edu-1",
      institution: "USP",
      degree: "BSc",
      startDate: "2018",
      current: false,
      order: 0,
    },
  ],
  skills: [],
  projects: [],
  languages: [],
  courses: [],
};

const CONTENT: ResumeContent = {
  objective: "Resumo",
  education: [],
  skills: [],
  experience: [
    {
      sourceId: "exp-1",
      role: "Dev",
      company: "Acme",
      period: "2020 — Atual",
      bullets: ["fez A"],
    },
  ],
  projects: [],
  languages: [],
  courses: [],
};

// Conteúdo rastreável à BUNDLE_EDU_ONLY (só formação, sem experiência): casa com
// edu-1/USP. Necessário porque o guardrail (US-07) reprova conteúdo que cite uma
// entidade ausente da base — CONTENT (que tem exp-1) seria erro contra essa base.
const CONTENT_EDU: ResumeContent = {
  objective: "Resumo",
  education: [{ sourceId: "edu-1", institution: "USP", degree: "BSc" }],
  skills: [],
  experience: [],
  projects: [],
  languages: [],
  courses: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/resumes/generate — validação do request", () => {
  it("deve responder 400 INVALID_JSON quando o corpo não é JSON válido, sem tocar na base", async () => {
    const res = await POST(makeRequest(null, { invalidJson: true }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_JSON");
    // Falha de parse acontece antes de qualquer acesso a dados/LLM.
    expect(getProfileBundle).not.toHaveBeenCalled();
    expect(generateResumeContent).not.toHaveBeenCalled();
  });

  it("deve responder 400 quando o mode é inválido (falha no schema)", async () => {
    const res = await POST(makeRequest({ mode: "FOO" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("deve responder 400 VALIDATION_ERROR para JOB_ADAPTIVE sem jobText (Zod)", async () => {
    // O refine de GenerateRequestSchema exige jobText não-vazio no Modo 2: a
    // validação do contrato falha (400) antes de qualquer acesso a dados/LLM.
    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(getProfileBundle).not.toHaveBeenCalled();
    expect(createJobPosting).not.toHaveBeenCalled();
    expect(generateResumeContent).not.toHaveBeenCalled();
  });

  it("deve responder 400 VALIDATION_ERROR para JOB_ADAPTIVE com jobText só de espaços", async () => {
    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE", jobText: "   " }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(createJobPosting).not.toHaveBeenCalled();
  });
});

describe("POST /api/resumes/generate — pré-requisito (ADR-0014)", () => {
  it("deve responder 422 PREREQUISITE_NOT_MET quando a base é insuficiente, sem chamar o LLM", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_EMPTY);

    const res = await POST(makeRequest({ mode: "STANDARD" }));

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("PREREQUISITE_NOT_MET");
    // Não pode ter chamado o LLM nem persistido.
    expect(generateResumeContent).not.toHaveBeenCalled();
    expect(createGeneratedResume).not.toHaveBeenCalled();
  });

  it("deve PASSAR no limite (nome + só uma formação, zero experiência) e chamar o LLM", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_EDU_ONLY);
    // Conteúdo rastreável a essa base (só formação) — passa no guardrail.
    generateResumeContent.mockResolvedValue(CONTENT_EDU);
    createGeneratedResume.mockImplementation(
      async (input: { texOutput: string; modelId: string }) => ({
        id: "gr-edu",
        userId: "user-local",
        name: "Currículo padrão — 30/05/2026",
        mode: "STANDARD",
        jobPostingId: null,
        modelId: input.modelId,
        contentJson: CONTENT_EDU,
        texOutput: input.texOutput,
        traceabilityReport: { errors: [], warnings: [] },
        createdAt: new Date("2026-05-30T00:00:00.000Z"),
      }),
    );

    const res = await POST(makeRequest({ mode: "STANDARD" }));

    // Pré-requisito satisfeito por formação só: NÃO retorna 422; gera normalmente.
    expect(res.status).toBe(200);
    expect(generateResumeContent).toHaveBeenCalledTimes(1);
    expect(createGeneratedResume).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/resumes/generate — caminho feliz (Modo 1)", () => {
  it("deve gerar, validar o guardrail, persistir com o relatório real e devolver o registro", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    // CONTENT é rastreável à BUNDLE_OK (exp-1/Acme) -> guardrail passa, sem warnings.
    generateResumeContent.mockResolvedValue(CONTENT);
    // createGeneratedResume devolve o registro persistido (formato de domínio).
    createGeneratedResume.mockImplementation(async (input: { texOutput: string; modelId: string }) => ({
      id: "gr1",
      userId: "user-local",
      name: "Currículo padrão — 30/05/2026",
      mode: "STANDARD",
      jobPostingId: null,
      modelId: input.modelId,
      contentJson: CONTENT,
      texOutput: input.texOutput,
      traceabilityReport: { errors: [], warnings: [] },
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
    }));

    const res = await POST(makeRequest({ mode: "STANDARD" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("gr1");
    expect(json.mode).toBe("STANDARD");
    // O .tex foi renderizado a partir do content (contém o template + a empresa real).
    expect(json.texOutput).toContain("\\documentclass{resume}");
    expect(json.texOutput).toContain("Acme");

    // Persistiu com o relatório REAL do guardrail (US-07): conteúdo limpo -> vazio,
    // NÃO null (null era o placeholder pré-US-07 do ADR-0014).
    const saveArg = createGeneratedResume.mock.calls[0][0];
    expect(saveArg.mode).toBe("STANDARD");
    expect(saveArg.traceabilityReport).toEqual({ errors: [], warnings: [] });
    expect(saveArg.content).toEqual(CONTENT);
    expect(typeof saveArg.modelId).toBe("string");
    expect(saveArg.modelId.length).toBeGreaterThan(0);
  });
});

describe("POST /api/resumes/generate — guardrail de rastreabilidade (US-07/ADR-0015)", () => {
  // Conteúdo com entidade FORA da base (empresa que não casa com exp-1) -> erro forte.
  const CONTENT_HALLUCINATED: ResumeContent = {
    objective: "Resumo",
    education: [],
    skills: [],
    experience: [
      {
        sourceId: "exp-1",
        role: "Dev",
        company: "Empresa Fantasma",
        period: "2020",
        bullets: [],
      },
    ],
    projects: [],
    languages: [],
    courses: [],
  };

  it("deve regenerar 1x e, persistindo o erro, responder 422 GUARDRAIL_FAILED sem persistir", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    // Erra nas duas tentativas (1 geração + 1 regeneração) -> 422.
    generateResumeContent.mockResolvedValue(CONTENT_HALLUCINATED);

    const res = await POST(makeRequest({ mode: "STANDARD" }));

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("GUARDRAIL_FAILED");
    // O relatório com os erros vai em details (para diagnóstico).
    expect(json.error.details.errors.length).toBeGreaterThan(0);
    // Regenerou 1x (2 chamadas no total) e NÃO persistiu (ADR-0015).
    expect(generateResumeContent).toHaveBeenCalledTimes(2);
    expect(createGeneratedResume).not.toHaveBeenCalled();
  });

  it("deve aceitar quando a regeneração corrige o erro (2ª tentativa OK)", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    // 1ª tentativa alucinada, 2ª limpa -> passa e persiste.
    generateResumeContent
      .mockResolvedValueOnce(CONTENT_HALLUCINATED)
      .mockResolvedValueOnce(CONTENT);
    createGeneratedResume.mockImplementation(
      async (input: { texOutput: string; modelId: string }) => ({
        id: "gr2",
        userId: "user-local",
        name: "Currículo padrão — 30/05/2026",
        mode: "STANDARD",
        jobPostingId: null,
        modelId: input.modelId,
        contentJson: CONTENT,
        texOutput: input.texOutput,
        traceabilityReport: { errors: [], warnings: [] },
        createdAt: new Date("2026-05-30T00:00:00.000Z"),
      }),
    );

    const res = await POST(makeRequest({ mode: "STANDARD" }));

    expect(res.status).toBe(200);
    expect(generateResumeContent).toHaveBeenCalledTimes(2);
    expect(createGeneratedResume).toHaveBeenCalledTimes(1);
  });

  it("deve responder 502 quando a regeneração (2ª tentativa) lança LLMError, sem persistir", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    // 1ª tentativa alucinada (dispara regeneração); 2ª falha no transporte do LLM.
    // O erro de transporte deve escapar do loop e virar 502, NÃO 422.
    generateResumeContent
      .mockResolvedValueOnce(CONTENT_HALLUCINATED)
      .mockRejectedValueOnce(new LLMError("transport", "caiu na regeneração"));

    const res = await POST(makeRequest({ mode: "STANDARD" }));

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error.code).toBe("LLM_ERROR");
    expect(generateResumeContent).toHaveBeenCalledTimes(2);
    expect(createGeneratedResume).not.toHaveBeenCalled();
  });

  it("deve persistir normalmente quando há só warnings (número novo), sem regenerar", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    // Entidade OK (exp-1/Acme), mas um número novo no bullet -> só aviso.
    const contentWithWarning: ResumeContent = {
      ...CONTENT,
      experience: [
        {
          sourceId: "exp-1",
          role: "Dev",
          company: "Acme",
          period: "2020 — Atual",
          bullets: ["Aumentou as vendas em 73%"],
        },
      ],
    };
    generateResumeContent.mockResolvedValue(contentWithWarning);
    createGeneratedResume.mockImplementation(
      async (input: { texOutput: string; modelId: string }) => ({
        id: "gr3",
        userId: "user-local",
        name: "Currículo padrão — 30/05/2026",
        mode: "STANDARD",
        jobPostingId: null,
        modelId: input.modelId,
        contentJson: contentWithWarning,
        texOutput: input.texOutput,
        traceabilityReport: { errors: [], warnings: [{ field: "x", value: "73%", reason: "r" }] },
        createdAt: new Date("2026-05-30T00:00:00.000Z"),
      }),
    );

    const res = await POST(makeRequest({ mode: "STANDARD" }));

    expect(res.status).toBe(200);
    // Só aviso -> NÃO regenera (uma chamada) e persiste com o warning.
    expect(generateResumeContent).toHaveBeenCalledTimes(1);
    const saveArg = createGeneratedResume.mock.calls[0][0];
    expect(saveArg.traceabilityReport.errors).toEqual([]);
    expect(saveArg.traceabilityReport.warnings.length).toBeGreaterThan(0);
  });
});

describe("POST /api/resumes/generate — erro do LLM (502)", () => {
  it("deve responder 502 quando o provider lança LLMError, sem persistir", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    generateResumeContent.mockRejectedValue(
      new LLMError("transport", "provedor caiu"),
    );

    const res = await POST(makeRequest({ mode: "STANDARD" }));

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error.code).toBe("LLM_ERROR");
    expect(createGeneratedResume).not.toHaveBeenCalled();
  });
});

describe("POST /api/resumes/generate — erro inesperado (500)", () => {
  it("deve responder 500 INTERNAL_ERROR quando uma falha não-LLM escapa (ex.: banco)", async () => {
    // Erro genérico (NÃO LLMError) vindo da camada de dados: cai no catch geral.
    getProfileBundle.mockRejectedValue(new Error("conexão com o banco caiu"));

    const res = await POST(makeRequest({ mode: "STANDARD" }));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
    // Não persistiu nada num caminho de falha.
    expect(createGeneratedResume).not.toHaveBeenCalled();
  });
});

describe("POST /api/resumes/generate — Modo 2 (JOB_ADAPTIVE, US-08)", () => {
  const JOB_TEXT = "Vaga: Backend em Node, foco em testes e qualidade.";

  it("deve criar o JobPosting, gerar e persistir GeneratedResume com mode + jobPostingId", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    createJobPosting.mockResolvedValue({ id: "job-1", rawText: JOB_TEXT });
    // CONTENT é rastreável à BUNDLE_OK (exp-1/Acme) -> guardrail passa.
    generateResumeContent.mockResolvedValue(CONTENT);
    createGeneratedResume.mockImplementation(
      async (input: {
        texOutput: string;
        modelId: string;
        mode: string;
        jobPostingId: string | null;
      }) => ({
        id: "gr-job",
        userId: "user-local",
        name: "Adaptado à vaga — 30/05/2026",
        mode: input.mode,
        jobPostingId: input.jobPostingId,
        modelId: input.modelId,
        contentJson: CONTENT,
        texOutput: input.texOutput,
        traceabilityReport: { errors: [], warnings: [] },
        createdAt: new Date("2026-05-30T00:00:00.000Z"),
      }),
    );

    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE", jobText: JOB_TEXT }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("JOB_ADAPTIVE");
    expect(json.jobPostingId).toBe("job-1");

    // Persistiu a vaga a partir do rawText (ADR-0016).
    expect(createJobPosting).toHaveBeenCalledTimes(1);
    expect(createJobPosting.mock.calls[0][0]).toEqual({ rawText: JOB_TEXT });

    // Persistiu o currículo com o modo e o id da vaga.
    const saveArg = createGeneratedResume.mock.calls[0][0];
    expect(saveArg.mode).toBe("JOB_ADAPTIVE");
    expect(saveArg.jobPostingId).toBe("job-1");
    expect(saveArg.content).toEqual(CONTENT);
  });

  it("deve responder 422 PREREQUISITE_NOT_MET sem criar JobPosting nem chamar o LLM", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_EMPTY);

    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE", jobText: JOB_TEXT }));

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("PREREQUISITE_NOT_MET");
    // Pré-requisito barra antes de persistir a vaga ou chamar o modelo.
    expect(createJobPosting).not.toHaveBeenCalled();
    expect(generateResumeContent).not.toHaveBeenCalled();
    expect(createGeneratedResume).not.toHaveBeenCalled();
  });

  it("deve regenerar 1x e responder 422 GUARDRAIL_FAILED sem persistir o currículo", async () => {
    // Conteúdo com entidade fora da base (empresa que não casa com exp-1) -> erro forte.
    const CONTENT_HALLUCINATED: ResumeContent = {
      objective: "Resumo",
      education: [],
      skills: [],
      experience: [
        {
          sourceId: "exp-1",
          role: "Dev",
          company: "Empresa Fantasma",
          period: "2020",
          bullets: [],
        },
      ],
      projects: [],
      languages: [],
      courses: [],
    };
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    createJobPosting.mockResolvedValue({ id: "job-2", rawText: JOB_TEXT });
    generateResumeContent.mockResolvedValue(CONTENT_HALLUCINATED);

    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE", jobText: JOB_TEXT }));

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("GUARDRAIL_FAILED");
    expect(generateResumeContent).toHaveBeenCalledTimes(2);
    expect(createGeneratedResume).not.toHaveBeenCalled();
  });

  it("deve responder 502 quando o provider lança LLMError, sem persistir o currículo", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    createJobPosting.mockResolvedValue({ id: "job-3", rawText: JOB_TEXT });
    generateResumeContent.mockRejectedValue(
      new LLMError("transport", "provedor caiu"),
    );

    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE", jobText: JOB_TEXT }));

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error.code).toBe("LLM_ERROR");
    expect(createGeneratedResume).not.toHaveBeenCalled();
  });

  it("deve regenerar 1x no Modo 2 e, recuperando na 2ª, criar o JobPosting UMA só vez", async () => {
    // O guardrail é compartilhado entre os modos (generateWithGuardrail recebe a
    // função geradora). Aqui confirmamos que o Modo 2 também REGENERA quando a 1ª
    // tentativa alucina — e que o efeito colateral (persistir a vaga) acontece UMA
    // vez, FORA do loop de regeneração (a vaga é o insumo, não a saída regenerada).
    const CONTENT_HALLUCINATED: ResumeContent = {
      objective: "Resumo",
      education: [],
      skills: [],
      experience: [
        {
          sourceId: "exp-1",
          role: "Dev",
          company: "Empresa Fantasma",
          period: "2020",
          bullets: [],
        },
      ],
      projects: [],
      languages: [],
      courses: [],
    };
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    createJobPosting.mockResolvedValue({ id: "job-4", rawText: JOB_TEXT });
    // 1ª tentativa alucinada, 2ª limpa -> regenera e passa.
    generateResumeContent
      .mockResolvedValueOnce(CONTENT_HALLUCINATED)
      .mockResolvedValueOnce(CONTENT);
    createGeneratedResume.mockImplementation(
      async (input: {
        texOutput: string;
        modelId: string;
        mode: string;
        jobPostingId: string | null;
      }) => ({
        id: "gr-job-regen",
        userId: "user-local",
        name: "Adaptado à vaga — 30/05/2026",
        mode: input.mode,
        jobPostingId: input.jobPostingId,
        modelId: input.modelId,
        contentJson: CONTENT,
        texOutput: input.texOutput,
        traceabilityReport: { errors: [], warnings: [] },
        createdAt: new Date("2026-05-30T00:00:00.000Z"),
      }),
    );

    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE", jobText: JOB_TEXT }));

    expect(res.status).toBe(200);
    // Regenerou (2 chamadas ao LLM)…
    expect(generateResumeContent).toHaveBeenCalledTimes(2);
    // …mas a vaga foi persistida só UMA vez (fora do loop) e o currículo, uma vez.
    expect(createJobPosting).toHaveBeenCalledTimes(1);
    expect(createGeneratedResume).toHaveBeenCalledTimes(1);
    expect(createGeneratedResume.mock.calls[0][0].jobPostingId).toBe("job-4");
  });

  it("deve enviar a vaga ao LLM (prompt do Modo 2, não o do Modo 1)", async () => {
    // Guarda contra uma regressão sutil: a rota ligar o gerador errado (standard) no
    // Modo 2. O Modo 2 deve chamar o provider com um prompt que carrega o texto da
    // vaga; se usasse o gerador do Modo 1, a vaga nunca chegaria ao modelo.
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    createJobPosting.mockResolvedValue({ id: "job-5", rawText: JOB_TEXT });
    generateResumeContent.mockResolvedValue(CONTENT);
    createGeneratedResume.mockImplementation(
      async (input: {
        texOutput: string;
        modelId: string;
        mode: string;
        jobPostingId: string | null;
      }) => ({
        id: "gr-job-prompt",
        userId: "user-local",
        name: "Adaptado à vaga — 30/05/2026",
        mode: input.mode,
        jobPostingId: input.jobPostingId,
        modelId: input.modelId,
        contentJson: CONTENT,
        texOutput: input.texOutput,
        traceabilityReport: { errors: [], warnings: [] },
        createdAt: new Date("2026-05-30T00:00:00.000Z"),
      }),
    );

    await POST(makeRequest({ mode: "JOB_ADAPTIVE", jobText: JOB_TEXT }));

    const params = generateResumeContent.mock.calls[0][0];
    // O user prompt do Modo 2 carrega a vaga + a base (id real que vira sourceId).
    expect(params.user).toContain(JOB_TEXT);
    expect(params.user).toContain("exp-1");
  });

  it("Modo 2 NÃO injeta mais currículo-referência nem consulta base/padrão na geração (ADR-0027)", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    createJobPosting.mockResolvedValue({ id: "job-6", rawText: JOB_TEXT });
    generateResumeContent.mockResolvedValue(CONTENT);
    createGeneratedResume.mockImplementation(
      async (input: { texOutput: string; modelId: string; mode: string; jobPostingId: string | null }) => ({
        id: "gr-base",
        userId: "user-local",
        name: "Adaptado à vaga — 31/05/2026",
        mode: input.mode,
        jobPostingId: input.jobPostingId,
        modelId: input.modelId,
        contentJson: CONTENT,
        texOutput: input.texOutput,
        traceabilityReport: { errors: [], warnings: [] },
        createdAt: new Date("2026-05-31T00:00:00.000Z"),
      }),
    );

    // Mesmo com baseResumeId no request, a geração não carrega mais o currículo-referência
    // (ADR-0027 substituiu o gabarito por regra sobre a base).
    const res = await POST(
      makeRequest({ mode: "JOB_ADAPTIVE", jobText: JOB_TEXT, baseResumeId: "base-1" }),
    );

    expect(res.status).toBe(200);
    expect(getGeneratedResumeById).not.toHaveBeenCalled();
    expect(getDefaultResume).not.toHaveBeenCalled();
    const params = generateResumeContent.mock.calls[0][0];
    expect(params.user).not.toContain("CURRÍCULO PADRÃO DE REFERÊNCIA");
  });

  it("Modo 2 injeta a ANÁLISE DA VAGA no prompt quando o provider a fornece (ADR-0027)", async () => {
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    createJobPosting.mockResolvedValue({ id: "job-7", rawText: JOB_TEXT });
    generateResumeContent.mockResolvedValue(CONTENT);
    analyzeJob.mockResolvedValue({
      role: "Backend",
      seniority: "",
      domain: "back-end",
      mustHave: ["testes automatizados"],
      niceToHave: [],
      keywords: ["MARCADOR_KEYWORD"],
    });
    createGeneratedResume.mockImplementation(
      async (input: { texOutput: string; modelId: string; mode: string; jobPostingId: string | null }) => ({
        id: "gr-an",
        userId: "user-local",
        name: "Adaptado à vaga — 31/05/2026",
        mode: input.mode,
        jobPostingId: input.jobPostingId,
        modelId: input.modelId,
        contentJson: CONTENT,
        texOutput: input.texOutput,
        traceabilityReport: { errors: [], warnings: [] },
        createdAt: new Date("2026-05-31T00:00:00.000Z"),
      }),
    );

    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE", jobText: JOB_TEXT }));

    expect(res.status).toBe(200);
    expect(analyzeJob).toHaveBeenCalledTimes(1);
    const params = generateResumeContent.mock.calls[0][0];
    expect(params.user).toContain("ANÁLISE DA VAGA");
    expect(params.user).toContain("MARCADOR_KEYWORD");
  });

  it("deve persistir jobPostingId null quando a vaga criada não traz id (fallback ?? null)", async () => {
    // A rota faz `jobPosting.id ?? null`. Se o repo devolver um registro sem id,
    // o currículo ainda é gerado e persiste jobPostingId = null (não undefined).
    getProfileBundle.mockResolvedValue(BUNDLE_OK);
    createJobPosting.mockResolvedValue({ rawText: JOB_TEXT });
    generateResumeContent.mockResolvedValue(CONTENT);
    createGeneratedResume.mockImplementation(
      async (input: {
        texOutput: string;
        modelId: string;
        mode: string;
        jobPostingId: string | null;
      }) => ({
        id: "gr-job-noid",
        userId: "user-local",
        name: "Adaptado à vaga — 30/05/2026",
        mode: input.mode,
        jobPostingId: input.jobPostingId,
        modelId: input.modelId,
        contentJson: CONTENT,
        texOutput: input.texOutput,
        traceabilityReport: { errors: [], warnings: [] },
        createdAt: new Date("2026-05-30T00:00:00.000Z"),
      }),
    );

    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE", jobText: JOB_TEXT }));

    expect(res.status).toBe(200);
    expect(createGeneratedResume.mock.calls[0][0].jobPostingId).toBeNull();
  });

  it("deve responder 400 VALIDATION_ERROR para jobText string vazia, sem tocar dados nem LLM", async () => {
    // Distinto do caso \"só espaços\": string totalmente vazia. O refine do schema
    // reprova (trim().length === 0) antes de qualquer acesso a base/vaga/LLM.
    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE", jobText: "" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(getProfileBundle).not.toHaveBeenCalled();
    expect(createJobPosting).not.toHaveBeenCalled();
    expect(generateResumeContent).not.toHaveBeenCalled();
  });
});
