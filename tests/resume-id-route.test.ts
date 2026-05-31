import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GeneratedResume } from "@/lib/schemas";

// Testes de COMPORTAMENTO das rotas PATCH/DELETE /api/resumes/[id] (US-15, ADR-0021).
// O repositório é a FRONTEIRA: mockamos rename/delete e exercitamos os handlers.
//   PATCH  { name } -> 200 + GeneratedResume · 400 (name ausente/vazio) · 404 (alheio/inexistente)
//   DELETE         -> 204                     · 404 (idem)
// Next.js 15: `params` é Promise. Sem rede, sem banco.

const renameGeneratedResume = vi.hoisted(() => vi.fn());
const deleteGeneratedResume = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/resume-repo", () => ({
  renameGeneratedResume,
  deleteGeneratedResume,
}));

import { PATCH, DELETE } from "@/app/api/resumes/[id]/route";

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

beforeEach(() => {
  vi.clearAllMocks();
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
