import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GeneratedResume } from "@/lib/schemas";

// Testes de COMPORTAMENTO da rota GET /api/resumes (histórico — US-09).
// A camada de dados (listGeneratedResumes) é a FRONTEIRA: mockamos só ela e
// verificamos que o handler devolve a lista (populada/vazia) e trata erro -> 500.
// Sem join com JobPosting (ADR-0016) — o response é GeneratedResumeSchema[] cru.

const listGeneratedResumes = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/resume-repo", () => ({ listGeneratedResumes }));

import { GET } from "@/app/api/resumes/route";

const RESUME: GeneratedResume = {
  id: "gr1",
  userId: "user-local",
  name: "Currículo padrão — 30/05/2026",
  mode: "STANDARD",
  isDefault: false,
  jobPostingId: null,
  modelId: "meta/llama-3.3-70b-instruct",
  contentJson: {
    objective: "Resumo",
    education: [],
    skills: [],
    experience: [
      { sourceId: "exp-1", role: "Dev", company: "Acme", period: "2020", bullets: ["fez A"] },
    ],
    projects: [],
    languages: [],
    courses: [],
  },
  texOutput: "\\documentclass{resume}",
  traceabilityReport: { errors: [], warnings: [] },
  createdAt: new Date("2026-05-30T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/resumes", () => {
  it("deve devolver a lista de currículos do usuário", async () => {
    const adaptive: GeneratedResume = {
      ...RESUME,
      id: "gr2",
      mode: "JOB_ADAPTIVE",
      jobPostingId: "job-1",
    };
    listGeneratedResumes.mockResolvedValue([RESUME, adaptive]);

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].id).toBe("gr1");
    expect(json[1].mode).toBe("JOB_ADAPTIVE");
    expect(json[1].jobPostingId).toBe("job-1");
    expect(listGeneratedResumes).toHaveBeenCalledTimes(1);
  });

  it("deve devolver [] quando o usuário não tem currículos", async () => {
    listGeneratedResumes.mockResolvedValue([]);

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("deve responder 500 INTERNAL_ERROR quando a camada de dados falha", async () => {
    listGeneratedResumes.mockRejectedValue(new Error("banco caiu"));

    const res = await GET();

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
  });
});
