import { describe, it, expect, vi, beforeEach } from "vitest";

// Testes de COMPORTAMENTO de DELETE /api/profile — limpar a base (US-16, ADR-0021).
// O repositório é a FRONTEIRA: mockamos clearProfile (o cascade real do Prisma é
// responsabilidade do schema, não desta rota) e verificamos o contrato da rota:
//   DELETE -> 204 sem corpo · idempotente (sem Profile → ainda 204) · 500 em falha real.

const clearProfile = vi.hoisted(() => vi.fn());
const getProfileBundle = vi.hoisted(() => vi.fn());
const saveProfileBundle = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/profile-repo", () => ({
  clearProfile,
  getProfileBundle,
  saveProfileBundle,
}));

import { DELETE } from "@/app/api/profile/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/profile — limpar a base", () => {
  it("deve chamar clearProfile e responder 204 sem corpo", async () => {
    clearProfile.mockResolvedValue(undefined);

    const res = await DELETE();

    expect(res.status).toBe(204);
    expect(clearProfile).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe("");
  });

  it("deve responder 204 mesmo quando a base já está vazia (idempotente)", async () => {
    // clearProfile é idempotente (deleteMany não lança sem linha) → ainda 204.
    clearProfile.mockResolvedValue(undefined);

    const res = await DELETE();

    expect(res.status).toBe(204);
  });

  it("deve responder 500 INTERNAL_ERROR quando a camada de dados falha", async () => {
    clearProfile.mockRejectedValue(new Error("banco caiu"));

    const res = await DELETE();

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
  });
});
