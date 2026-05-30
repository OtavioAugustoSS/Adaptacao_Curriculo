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
vi.mock("@/server/data/resume-repo", () => ({ createGeneratedResume }));

const generateResumeContent = vi.hoisted(() => vi.fn());
vi.mock("@/server/llm", () => ({
  getLLMProvider: () => ({ generateResumeContent }),
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

  it("deve responder 400 VALIDATION_ERROR para JOB_ADAPTIVE sem jobText (Zod antes do modo)", async () => {
    // O refine de GenerateRequestSchema exige jobText não-vazio no Modo 2: a
    // validação do contrato falha (400) ANTES de chegar ao 422 MODE_NOT_IMPLEMENTED.
    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
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

describe("POST /api/resumes/generate — Modo 2 ainda não implementado", () => {
  it("deve responder 422 MODE_NOT_IMPLEMENTED para JOB_ADAPTIVE", async () => {
    const res = await POST(makeRequest({ mode: "JOB_ADAPTIVE", jobText: "vaga X" }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("MODE_NOT_IMPLEMENTED");
  });
});
