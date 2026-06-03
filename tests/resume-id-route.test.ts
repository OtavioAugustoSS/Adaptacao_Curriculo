import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GeneratedResume } from "@/lib/schemas";

// Testes de COMPORTAMENTO das rotas GET/PATCH/DELETE /api/resumes/[id]
// (US-15, ADR-0021/0022/0030). O repositório é a FRONTEIRA: mockamos as funções e
// exercitamos os handlers.
//   GET            -> 200 + GeneratedResume · 404 (alheio/inexistente)            — ADR-0030
//   PATCH { name } -> 200 + GeneratedResume · 400 (name ausente/vazio) · 404
//   PATCH { isDefault: true } -> 200 · 404                                        — ADR-0022
//   PATCH { contentJson } -> 200 + .tex re-renderizado · 400 (inválido) · 404     — ADR-0030
//   DELETE         -> 204                     · 404 (idem)
// Next.js 15: `params` é Promise. Sem rede, sem banco. render-latex NÃO é mockado
// (é puro) — a edição de conteúdo re-renderiza o `.tex` de verdade.

const renameGeneratedResume = vi.hoisted(() => vi.fn());
const deleteGeneratedResume = vi.hoisted(() => vi.fn());
const setDefaultResume = vi.hoisted(() => vi.fn());
const getGeneratedResumeById = vi.hoisted(() => vi.fn());
const updateGeneratedResumeContent = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/resume-repo", () => ({
  renameGeneratedResume,
  deleteGeneratedResume,
  setDefaultResume,
  getGeneratedResumeById,
  updateGeneratedResumeContent,
}));

// profile-repo é fronteira: a edição de conteúdo (ADR-0030) carrega o Profile para o
// cabeçalho (\name/\address) do `.tex`. render-latex fica REAL (puro) — re-renderiza.
const getProfileBundle = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/profile-repo", () => ({ getProfileBundle }));

import { GET, PATCH, DELETE } from "@/app/api/resumes/[id]/route";

// `params` é uma Promise no Next 15 — reproduzimos isso no teste.
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

// Um Request mínimo: só o .json() importa para o PATCH. `invalidJson` simula corpo ilegível.
function makeRequest(body: unknown, opts: { invalidJson?: boolean } = {}): Request {
  return {
    json: opts.invalidJson
      ? async () => {
          throw new SyntaxError("bad json");
        }
      : async () => body,
  } as unknown as Request;
}

const RENAMED: GeneratedResume = {
  id: "gr1",
  userId: "user-local",
  name: "Novo nome",
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
  texOutput: "\\documentclass{resume}",
  traceabilityReport: null,
  createdAt: new Date("2026-05-30T00:00:00.000Z"),
};

// Conteúdo editado mínimo e válido (experiência exige sourceId).
const EDITED_CONTENT = {
  objective: "Objetivo editado pelo usuário",
  education: [],
  skills: [],
  experience: [
    { sourceId: "exp-1", role: "Dev", company: "Acme", period: "2020 — Atual", bullets: ["fez A"] },
  ],
  projects: [],
  languages: [],
  courses: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default do Profile usado no cabeçalho do `.tex` re-renderizado (edição de conteúdo).
  getProfileBundle.mockResolvedValue({ profile: { fullName: "Otávio Augusto" } });
});

describe("GET /api/resumes/[id] — carregar um currículo (ADR-0030)", () => {
  it("deve devolver 200 com o currículo do usuário", async () => {
    getGeneratedResumeById.mockResolvedValue(RENAMED);

    const res = await GET(makeRequest(null), ctx("gr1"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("gr1");
    expect(getGeneratedResumeById).toHaveBeenCalledWith("gr1");
  });

  it("deve devolver 404 quando inexistente ou de outro usuário", async () => {
    getGeneratedResumeById.mockResolvedValue(null);

    const res = await GET(makeRequest(null), ctx("alheio"));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/resumes/[id] — editar conteúdo (ADR-0030)", () => {
  it("deve re-renderizar o .tex e persistir o conteúdo editado, 200", async () => {
    updateGeneratedResumeContent.mockResolvedValue({
      ...RENAMED,
      contentJson: EDITED_CONTENT,
      texOutput: "\\documentclass{resume}\n…",
      traceabilityReport: null,
    });

    const res = await PATCH(makeRequest({ contentJson: EDITED_CONTENT }), ctx("gr1"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.contentJson.objective).toBe("Objetivo editado pelo usuário");

    // Carregou o Profile (cabeçalho) e chamou o repo com (id, content, tex re-renderizado).
    expect(getProfileBundle).toHaveBeenCalled();
    expect(updateGeneratedResumeContent).toHaveBeenCalledTimes(1);
    const [calledId, calledContent, calledTex] = updateGeneratedResumeContent.mock.calls[0];
    expect(calledId).toBe("gr1");
    expect(calledContent).toMatchObject({ objective: "Objetivo editado pelo usuário" });
    // O .tex é o renderizado de verdade (renderer puro, sem mock): classe + nome do Profile.
    expect(calledTex).toContain("\\documentclass{resume}");
    expect(calledTex).toContain("Otávio Augusto");
  });

  it("deve responder 400 quando o contentJson é estruturalmente inválido (Zod)", async () => {
    // objective deve ser string; aqui é número → Zod rejeita, sem tocar no repo.
    const res = await PATCH(makeRequest({ contentJson: { objective: 123 } }), ctx("gr1"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(updateGeneratedResumeContent).not.toHaveBeenCalled();
  });

  it("deve responder 404 quando o id é inexistente/alheio", async () => {
    updateGeneratedResumeContent.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ contentJson: EDITED_CONTENT }), ctx("alheio"));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/resumes/[id] — renomear", () => {
  it("deve renomear e devolver 200 com o registro atualizado", async () => {
    renameGeneratedResume.mockResolvedValue(RENAMED);

    const res = await PATCH(makeRequest({ name: "Novo nome" }), ctx("gr1"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe("Novo nome");
    expect(renameGeneratedResume).toHaveBeenCalledWith("gr1", "Novo nome");
  });

  it("deve responder 400 quando name está ausente (Zod), sem tocar no repo", async () => {
    const res = await PATCH(makeRequest({}), ctx("gr1"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(renameGeneratedResume).not.toHaveBeenCalled();
  });

  it("deve responder 400 quando name é vazio/só espaços (Zod trim+min)", async () => {
    const res = await PATCH(makeRequest({ name: "   " }), ctx("gr1"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(renameGeneratedResume).not.toHaveBeenCalled();
  });

  it("deve responder 400 INVALID_JSON quando o corpo não é JSON válido", async () => {
    const res = await PATCH(makeRequest(null, { invalidJson: true }), ctx("gr1"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_JSON");
    expect(renameGeneratedResume).not.toHaveBeenCalled();
  });

  it("deve responder 404 quando o currículo não existe ou é de outro usuário", async () => {
    // O repo devolve null quando id inexistente/alheio (não vazamos a diferença).
    renameGeneratedResume.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ name: "X" }), ctx("alheio"));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/resumes/[id] — definir como padrão (ADR-0022)", () => {
  it("deve marcar como padrão e devolver 200, sem renomear", async () => {
    setDefaultResume.mockResolvedValue({ ...RENAMED, isDefault: true });

    const res = await PATCH(makeRequest({ isDefault: true }), ctx("gr1"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.isDefault).toBe(true);
    expect(setDefaultResume).toHaveBeenCalledWith("gr1");
    expect(renameGeneratedResume).not.toHaveBeenCalled();
  });

  it("deve responder 404 quando o id é inexistente/alheio", async () => {
    setDefaultResume.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ isDefault: true }), ctx("alheio"));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });

  it("deve aceitar name + isDefault juntos (renomeia e marca padrão)", async () => {
    renameGeneratedResume.mockResolvedValue(RENAMED);
    setDefaultResume.mockResolvedValue({ ...RENAMED, isDefault: true });

    const res = await PATCH(
      makeRequest({ name: "Novo nome", isDefault: true }),
      ctx("gr1"),
    );

    expect(res.status).toBe(200);
    expect(renameGeneratedResume).toHaveBeenCalledWith("gr1", "Novo nome");
    expect(setDefaultResume).toHaveBeenCalledWith("gr1");
    const json = await res.json();
    expect(json.isDefault).toBe(true);
  });

  it("deve responder 400 quando o corpo está vazio (nem name nem isDefault)", async () => {
    const res = await PATCH(makeRequest({}), ctx("gr1"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(renameGeneratedResume).not.toHaveBeenCalled();
    expect(setDefaultResume).not.toHaveBeenCalled();
  });

  it("deve responder 400 quando isDefault é false (só aceita true)", async () => {
    const res = await PATCH(makeRequest({ isDefault: false }), ctx("gr1"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(setDefaultResume).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/resumes/[id] — excluir", () => {
  it("deve excluir e responder 204 sem corpo", async () => {
    deleteGeneratedResume.mockResolvedValue(true);

    const res = await DELETE(makeRequest(null), ctx("gr1"));

    expect(res.status).toBe(204);
    expect(deleteGeneratedResume).toHaveBeenCalledWith("gr1");
    expect(await res.text()).toBe("");
  });

  it("deve responder 404 quando o currículo não existe ou é de outro usuário", async () => {
    deleteGeneratedResume.mockResolvedValue(false);

    const res = await DELETE(makeRequest(null), ctx("alheio"));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });
});
