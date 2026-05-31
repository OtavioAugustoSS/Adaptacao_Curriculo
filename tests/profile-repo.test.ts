import { describe, it, expect, vi, beforeEach } from "vitest";

// Testes de COMPORTAMENTO do repositório de perfil (US-02/US-03).
// O prisma e o seam de identidade são FRONTEIRAS do sistema: mockamos os dois e
// nunca tocamos num banco real. O foco é a lógica de (de)serialização que vive SÓ
// no repo (ADR-0005): bullets/techStack array<->String-JSON, null->undefined, e a
// ordenação por `order`. Também verificamos o contrato de escrita (replace + reindex).

// --- Mocks de fronteira -----------------------------------------------------

// Identidade: sempre o mesmo usuário local (evita depender de env nos testes).
vi.mock("@/server/auth/getCurrentUserId", () => ({
  getCurrentUserId: () => "user-local",
}));

// Cliente Prisma: substituído por um duble com as operações que o repo usa.
// `vi.hoisted` cria o mock antes do hoist do `vi.mock`, permitindo referenciá-lo
// tanto na factory quanto nos testes.
const prismaMock = vi.hoisted(() => {
  const m: any = {
    profile: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    user: { upsert: vi.fn() },
    experience: { deleteMany: vi.fn(), createMany: vi.fn() },
    education: { deleteMany: vi.fn(), createMany: vi.fn() },
    skill: { deleteMany: vi.fn(), createMany: vi.fn() },
    project: { deleteMany: vi.fn(), createMany: vi.fn() },
    language: { deleteMany: vi.fn(), createMany: vi.fn() },
    course: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  // $transaction roda o callback com o próprio mock como `tx`.
  m.$transaction = vi.fn(async (fn: (tx: any) => unknown) => fn(m));
  return m;
});

vi.mock("@/server/db", () => ({ prisma: prismaMock }));

import { getProfileBundle, saveProfileBundle, clearProfile } from "@/server/data/profile-repo";

// Linha de Profile crua (formato Prisma) com listas; campos opcionais como null.
function makeProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    userId: "user-local",
    fullName: "Otávio",
    phone: null,
    location: null,
    email: null,
    linkedin: null,
    github: null,
    website: null,
    summary: null,
    experiences: [],
    educations: [],
    skills: [],
    projects: [],
    languages: [],
    courses: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProfileBundle — estado vazio", () => {
  // Sem Profile, devolve um bundle vazio (fullName="", listas []) para a tela /perfil
  // renderizar o estado inicial. A regra .min(1) de fullName é de ESCRITA (validada no
  // PUT), não de leitura. (O bug anterior — emptyBundle via parse com .min(1) lançando
  // ZodError — foi corrigido pelo fullstack: emptyBundle agora é um literal tipado.)
  it("deve devolver um bundle vazio válido quando não há Profile ainda", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(null);

    const bundle = await getProfileBundle();

    expect(bundle.profile.fullName).toBe("");
    expect(bundle.experiences).toEqual([]);
    expect(bundle.skills).toEqual([]);
  });
});

describe("getProfileBundle — desserialização (Prisma -> domínio)", () => {
  it("deve converter null em undefined nos campos opcionais do profile", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(
      makeProfileRow({ phone: null, email: "x@y.com" }),
    );

    const bundle = await getProfileBundle();

    expect(bundle.profile.phone).toBeUndefined();
    expect(bundle.profile.email).toBe("x@y.com");
  });

  it("deve parsear bullets de String-JSON para string[]", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(
      makeProfileRow({
        experiences: [
          {
            id: "e1",
            userId: "user-local",
            profileId: "p1",
            company: "Acme",
            role: "Dev",
            location: null,
            startDate: "2020",
            endDate: null,
            current: true,
            bullets: JSON.stringify(["fez A", "fez B"]),
            order: 0,
          },
        ],
      }),
    );

    const bundle = await getProfileBundle();

    expect(bundle.experiences[0].bullets).toEqual(["fez A", "fez B"]);
  });

  it("deve devolver [] quando bullets é uma String-JSON malformada (parse defensivo)", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(
      makeProfileRow({
        experiences: [
          {
            id: "e1",
            userId: "user-local",
            profileId: "p1",
            company: "Acme",
            role: "Dev",
            location: null,
            startDate: "2020",
            endDate: null,
            current: false,
            bullets: "{nao eh json}",
            order: 0,
          },
        ],
      }),
    );

    const bundle = await getProfileBundle();

    expect(bundle.experiences[0].bullets).toEqual([]);
  });

  it("deve parsear bullets e techStack de um projeto independentemente", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(
      makeProfileRow({
        projects: [
          {
            id: "pr1",
            userId: "user-local",
            profileId: "p1",
            name: "Proj",
            description: "Desc",
            bullets: JSON.stringify(["b1"]),
            techStack: JSON.stringify(["TS", "Node"]),
            url: null,
            order: 0,
          },
        ],
      }),
    );

    const bundle = await getProfileBundle();

    expect(bundle.projects[0].bullets).toEqual(["b1"]);
    expect(bundle.projects[0].techStack).toEqual(["TS", "Node"]);
  });

  it("deve ordenar os itens das listas por `order` crescente", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(
      makeProfileRow({
        skills: [
          { id: "s2", userId: "user-local", profileId: "p1", category: "B", name: "b", level: null, order: 2 },
          { id: "s0", userId: "user-local", profileId: "p1", category: "A", name: "a", level: null, order: 0 },
          { id: "s1", userId: "user-local", profileId: "p1", category: "M", name: "m", level: null, order: 1 },
        ],
      }),
    );

    const bundle = await getProfileBundle();

    expect(bundle.skills.map((s) => s.name)).toEqual(["a", "m", "b"]);
  });
});

describe("saveProfileBundle — serialização e contrato de escrita", () => {
  // Reaproveita o findUnique (saveProfileBundle relê via getProfileBundle no fim).
  function stubReadbackEmpty() {
    prismaMock.profile.findUnique.mockResolvedValue(makeProfileRow());
  }

  it("deve serializar bullets como String-JSON ao criar experiências", async () => {
    stubReadbackEmpty();
    prismaMock.profile.upsert.mockResolvedValue({ id: "p1" });

    await saveProfileBundle({
      profile: { fullName: "Otávio" },
      experiences: [
        {
          company: "Acme",
          role: "Dev",
          startDate: "2020",
          current: false,
          bullets: ["fez A", "fez B"],
          order: 0,
        },
      ],
      educations: [],
      skills: [],
      projects: [],
      languages: [],
      courses: [],
    });

    const arg = prismaMock.experience.createMany.mock.calls[0][0];
    expect(arg.data[0].bullets).toBe(JSON.stringify(["fez A", "fez B"]));
  });

  it("deve reindexar `order` pela posição no array (replace determinístico)", async () => {
    stubReadbackEmpty();
    prismaMock.profile.upsert.mockResolvedValue({ id: "p1" });

    await saveProfileBundle({
      profile: { fullName: "Otávio" },
      experiences: [],
      educations: [],
      skills: [
        { category: "A", name: "a", order: 99 },
        { category: "B", name: "b", order: 5 },
      ],
      projects: [],
      languages: [],
      courses: [],
    });

    const arg = prismaMock.skill.createMany.mock.calls[0][0];
    expect(arg.data.map((s: { order: number }) => s.order)).toEqual([0, 1]);
  });

  it("deve apagar todas as listas antes de recriar (estratégia replace)", async () => {
    stubReadbackEmpty();
    prismaMock.profile.upsert.mockResolvedValue({ id: "p1" });

    await saveProfileBundle({
      profile: { fullName: "Otávio" },
      experiences: [],
      educations: [],
      skills: [],
      projects: [],
      languages: [],
      courses: [],
    });

    expect(prismaMock.experience.deleteMany).toHaveBeenCalledWith({ where: { profileId: "p1" } });
    expect(prismaMock.skill.deleteMany).toHaveBeenCalled();
    // Sem itens -> nenhum createMany.
    expect(prismaMock.experience.createMany).not.toHaveBeenCalled();
  });

  it("deve converter campos opcionais ausentes em null ao gravar o profile", async () => {
    stubReadbackEmpty();
    prismaMock.profile.upsert.mockResolvedValue({ id: "p1" });

    await saveProfileBundle({
      profile: { fullName: "Otávio" },
      experiences: [],
      educations: [],
      skills: [],
      projects: [],
      languages: [],
      courses: [],
    });

    const upsertArg = prismaMock.profile.upsert.mock.calls[0][0];
    expect(upsertArg.create.phone).toBeNull();
    expect(upsertArg.create.email).toBeNull();
  });

  it("deve gravar o `current` da formação como veio no bundle (US-12)", async () => {
    stubReadbackEmpty();
    prismaMock.profile.upsert.mockResolvedValue({ id: "p1" });

    await saveProfileBundle({
      profile: { fullName: "Otávio" },
      experiences: [],
      educations: [
        {
          institution: "USP",
          degree: "Mestrado",
          startDate: "2022",
          current: true,
          order: 0,
        },
      ],
      skills: [],
      projects: [],
      languages: [],
      courses: [],
    });

    // A formação em andamento (US-12) é persistida com current=true (sem perder o flag).
    const arg = prismaMock.education.createMany.mock.calls[0][0];
    expect(arg.data[0].current).toBe(true);
  });
});

describe("clearProfile — limpar a base (US-16, ADR-0021)", () => {
  it("deve apagar o Profile do usuário atual (cascade derruba as listas)", async () => {
    prismaMock.profile.deleteMany.mockResolvedValue({ count: 1 });

    await clearProfile();

    // Restrito ao usuário atual; o cascade do Prisma cuida das 6 listas.
    expect(prismaMock.profile.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-local" },
    });
  });

  it("deve ser idempotente: sem Profile não lança (deleteMany count 0)", async () => {
    prismaMock.profile.deleteMany.mockResolvedValue({ count: 0 });

    await expect(clearProfile()).resolves.toBeUndefined();
  });
});

describe("getProfileBundle — round-trip do `current` da formação (US-12)", () => {
  it("deve desserializar o `current` da formação vindo do Prisma", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(
      makeProfileRow({
        educations: [
          {
            id: "ed1",
            userId: "user-local",
            profileId: "p1",
            institution: "USP",
            degree: "Mestrado",
            field: null,
            startDate: "2022",
            endDate: null,
            current: true,
            gpa: null,
            details: null,
            order: 0,
          },
        ],
      }),
    );

    const bundle = await getProfileBundle();

    expect(bundle.educations[0].current).toBe(true);
  });
});
