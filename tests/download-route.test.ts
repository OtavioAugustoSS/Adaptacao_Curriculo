import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GeneratedResume } from "@/lib/schemas";

// Testes de COMPORTAMENTO da rota GET /api/resumes/[id]/download (US-06).
// Mockamos as FRONTEIRAS (repos). Foco: 404 quando não acha; 200 text/plain +
// Content-Disposition com o nome de arquivo do ADR-0014 quando acha.

const getGeneratedResumeById = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/resume-repo", () => ({ getGeneratedResumeById }));

const getProfileBundle = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/profile-repo", () => ({ getProfileBundle }));

import { GET } from "@/app/api/resumes/[id]/download/route";

// Next.js 15: `params` é uma Promise. Reproduzimos isso no teste.
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

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
    experience: [],
    projects: [],
    languages: [],
    courses: [],
  },
  texOutput: "\\documentclass{resume}\n\\begin{document}\\end{document}",
  traceabilityReport: null,
  createdAt: new Date("2026-05-30T10:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/resumes/[id]/download — não encontrado", () => {
  it("deve responder 404 quando o currículo não existe/não é do usuário", async () => {
    getGeneratedResumeById.mockResolvedValue(null);

    const res = await GET(new Request("http://x/download"), ctx("inexistente"));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/resumes/[id]/download — sucesso", () => {
  it("deve servir o .tex como text/plain com attachment e o nome do ADR-0014", async () => {
    getGeneratedResumeById.mockResolvedValue(RESUME);
    getProfileBundle.mockResolvedValue({
      profile: { fullName: "Otávio Silva" },
      experiences: [],
      educations: [],
      skills: [],
      projects: [],
      languages: [],
      courses: [],
    });

    const res = await GET(new Request("http://x/download"), ctx("gr1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="curriculo-otavio-silva-2026-05-30.tex"',
    );
    // O corpo é exatamente o texOutput cacheado (sem nova chamada ao LLM).
    const body = await res.text();
    expect(body).toBe(RESUME.texOutput);
  });

  it("deve usar o fallback curriculo-<id>.tex quando o nome não gera slug", async () => {
    getGeneratedResumeById.mockResolvedValue(RESUME);
    getProfileBundle.mockResolvedValue({
      profile: { fullName: "###" },
      experiences: [],
      educations: [],
      skills: [],
      projects: [],
      languages: [],
      courses: [],
    });

    const res = await GET(new Request("http://x/download"), ctx("gr1"));

    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="curriculo-gr1.tex"',
    );
  });
});
