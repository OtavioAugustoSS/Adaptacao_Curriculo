import { describe, it, expect, vi, beforeEach } from "vitest";

// Testes de COMPORTAMENTO do repositório de vagas (JobPosting, US-08).
// prisma e o seam de identidade são FRONTEIRAS: mockamos os dois, sem banco real.
// Foco: persistir só o rawText (MVP/ADR-0016 — title/company vazios, parsedKeywords
// null), userId via getCurrentUserId, e a desserialização ao mapear de volta.

vi.mock("@/server/auth/getCurrentUserId", () => ({
  getCurrentUserId: () => "user-local",
}));

const prismaMock = vi.hoisted(() => {
  const m: any = {
    jobPosting: {
      create: vi.fn(),
    },
  };
  return m;
});

vi.mock("@/server/db", () => ({ prisma: prismaMock }));

import { createJobPosting } from "@/server/data/job-repo";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    userId: "user-local",
    rawText: "Vaga: Engenheiro de Software.",
    title: null,
    company: null,
    parsedKeywords: null,
    createdAt: new Date("2026-05-30T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createJobPosting", () => {
  it("deve persistir o rawText do usuário atual com title/company/parsedKeywords vazios (ADR-0016)", async () => {
    prismaMock.jobPosting.create.mockResolvedValue(makeRow());

    await createJobPosting({ rawText: "Vaga: Engenheiro de Software." });

    const arg = prismaMock.jobPosting.create.mock.calls[0][0];
    expect(arg.data.userId).toBe("user-local");
    expect(arg.data.rawText).toBe("Vaga: Engenheiro de Software.");
    // MVP: nada de extração — campos vazios/null.
    expect(arg.data.title).toBeNull();
    expect(arg.data.company).toBeNull();
    expect(arg.data.parsedKeywords).toBeNull();
  });

  it("deve devolver o JobPosting de domínio (id + rawText)", async () => {
    prismaMock.jobPosting.create.mockResolvedValue(makeRow());

    const saved = await createJobPosting({ rawText: "Vaga: Engenheiro de Software." });

    expect(saved.id).toBe("job-1");
    expect(saved.rawText).toBe("Vaga: Engenheiro de Software.");
    // null do Prisma vira undefined no domínio (campos .optional()).
    expect(saved.title).toBeUndefined();
    expect(saved.company).toBeUndefined();
    expect(saved.parsedKeywords).toBeUndefined();
  });

  it("deve desserializar parsedKeywords (String-JSON -> string[]) quando presente", async () => {
    // Não é o caminho do MVP, mas o mapeamento precisa cobrir o ponto de extensão.
    prismaMock.jobPosting.create.mockResolvedValue(
      makeRow({ parsedKeywords: JSON.stringify(["node", "testes"]) }),
    );

    const saved = await createJobPosting({ rawText: "x" });

    expect(saved.parsedKeywords).toEqual(["node", "testes"]);
  });
});
