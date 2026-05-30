import { describe, it, expect, vi, beforeEach } from "vitest";

// Testes de COMPORTAMENTO do repositório de currículos gerados (US-05).
// prisma e o seam de identidade são FRONTEIRAS: mockamos os dois, sem banco real.
// Foco: a (de)serialização JSON que vive SÓ aqui (contentJson, traceabilityReport)
// e a regra do ADR-0014 (traceabilityReport=null = "não avaliado").

vi.mock("@/server/auth/getCurrentUserId", () => ({
  getCurrentUserId: () => "user-local",
}));

const prismaMock = vi.hoisted(() => {
  const m: any = {
    generatedResume: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return m;
});

vi.mock("@/server/db", () => ({ prisma: prismaMock }));

import {
  createGeneratedResume,
  listGeneratedResumes,
  getGeneratedResumeById,
} from "@/server/data/resume-repo";
import type { ResumeContent } from "@/lib/schemas";

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

// Linha crua de GeneratedResume (formato Prisma: campos JSON como String).
function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "gr1",
    userId: "user-local",
    mode: "STANDARD",
    jobPostingId: null,
    modelId: "meta/llama-3.3-70b-instruct",
    contentJson: JSON.stringify(CONTENT),
    texOutput: "\\documentclass{resume}",
    traceabilityReport: null,
    createdAt: new Date("2026-05-30T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createGeneratedResume — serialização", () => {
  it("deve serializar content como String-JSON e gravar mode/modelId/texOutput", async () => {
    prismaMock.generatedResume.create.mockResolvedValue(makeRow());

    await createGeneratedResume({
      mode: "STANDARD",
      modelId: "meta/llama-3.3-70b-instruct",
      content: CONTENT,
      texOutput: "\\documentclass{resume}",
      traceabilityReport: null,
    });

    const arg = prismaMock.generatedResume.create.mock.calls[0][0];
    expect(arg.data.userId).toBe("user-local");
    expect(arg.data.mode).toBe("STANDARD");
    expect(arg.data.contentJson).toBe(JSON.stringify(CONTENT));
    expect(arg.data.texOutput).toBe("\\documentclass{resume}");
  });

  it("deve gravar traceabilityReport como null quando não avaliado (ADR-0014)", async () => {
    prismaMock.generatedResume.create.mockResolvedValue(makeRow());

    await createGeneratedResume({
      mode: "STANDARD",
      modelId: "m",
      content: CONTENT,
      texOutput: "x",
      traceabilityReport: null,
    });

    const arg = prismaMock.generatedResume.create.mock.calls[0][0];
    expect(arg.data.traceabilityReport).toBeNull();
  });

  it("deve serializar o traceabilityReport como String-JSON quando presente", async () => {
    const report = { errors: [], warnings: [{ field: "x", value: "1", reason: "novo" }] };
    prismaMock.generatedResume.create.mockResolvedValue(
      makeRow({ traceabilityReport: JSON.stringify(report) }),
    );

    await createGeneratedResume({
      mode: "STANDARD",
      modelId: "m",
      content: CONTENT,
      texOutput: "x",
      traceabilityReport: report,
    });

    const arg = prismaMock.generatedResume.create.mock.calls[0][0];
    expect(arg.data.traceabilityReport).toBe(JSON.stringify(report));
  });

  it("deve devolver o registro de domínio com content desserializado", async () => {
    prismaMock.generatedResume.create.mockResolvedValue(makeRow());

    const saved = await createGeneratedResume({
      mode: "STANDARD",
      modelId: "meta/llama-3.3-70b-instruct",
      content: CONTENT,
      texOutput: "\\documentclass{resume}",
      traceabilityReport: null,
    });

    expect(saved.id).toBe("gr1");
    expect(saved.contentJson).toEqual(CONTENT);
    expect(saved.traceabilityReport).toBeNull();
  });

  it("deve desserializar de volta um traceabilityReport presente (String-JSON -> objeto)", async () => {
    // Lado simétrico do round-trip (US-07): quando a linha tem o relatório como
    // String-JSON, a leitura precisa devolvê-lo como OBJETO de domínio, não string.
    const report = { errors: [], warnings: [{ field: "x", value: "1", reason: "novo número" }] };
    prismaMock.generatedResume.create.mockResolvedValue(
      makeRow({ traceabilityReport: JSON.stringify(report) }),
    );

    const saved = await createGeneratedResume({
      mode: "STANDARD",
      modelId: "m",
      content: CONTENT,
      texOutput: "x",
      traceabilityReport: report,
    });

    expect(saved.traceabilityReport).toEqual(report);
    expect(typeof saved.traceabilityReport).toBe("object");
  });
});

describe("listGeneratedResumes — leitura", () => {
  it("deve listar do mais recente ao mais antigo e desserializar cada um", async () => {
    prismaMock.generatedResume.findMany.mockResolvedValue([makeRow()]);

    const list = await listGeneratedResumes();

    // Filtra pelo usuário atual e ordena desc por createdAt.
    const arg = prismaMock.generatedResume.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: "user-local" });
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
    expect(list[0].contentJson).toEqual(CONTENT);
  });

  it("deve devolver lista vazia quando o usuário não tem currículos", async () => {
    prismaMock.generatedResume.findMany.mockResolvedValue([]);
    const list = await listGeneratedResumes();
    expect(list).toEqual([]);
  });
});

describe("getGeneratedResumeById — leitura por id", () => {
  it("deve restringir a busca ao usuário atual", async () => {
    prismaMock.generatedResume.findFirst.mockResolvedValue(makeRow());

    await getGeneratedResumeById("gr1");

    const arg = prismaMock.generatedResume.findFirst.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "gr1", userId: "user-local" });
  });

  it("deve devolver null quando não encontra", async () => {
    prismaMock.generatedResume.findFirst.mockResolvedValue(null);
    const result = await getGeneratedResumeById("inexistente");
    expect(result).toBeNull();
  });
});
