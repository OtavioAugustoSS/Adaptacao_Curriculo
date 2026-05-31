import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Comportamento do seam de identidade assíncrono (ADR-0024). O Auth.js (`@/auth`) é uma
// FRONTEIRA: mockamos `auth()` e nunca tocamos OAuth/Prisma. Cobrimos as 3 ramificações:
// sessão válida, fallback de dev (LOCAL_USER_ID fora de produção) e lançamento (401).
// Env via vi.stubEnv (NODE_ENV é read-only nos tipos do Next — não dá para atribuir).

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));

import { getCurrentUserId, UnauthenticatedError } from "@/server/auth/getCurrentUserId";

describe("getCurrentUserId (ADR-0024)", () => {
  beforeEach(() => authMock.mockReset());
  afterEach(() => vi.unstubAllEnvs());

  it("retorna o id da sessão quando autenticado", async () => {
    authMock.mockResolvedValue({ user: { id: "user-abc" } });
    await expect(getCurrentUserId()).resolves.toBe("user-abc");
  });

  it("fora de produção, usa LOCAL_USER_ID como fallback quando não há sessão", async () => {
    authMock.mockResolvedValue(null);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_USER_ID", "local-user");
    await expect(getCurrentUserId()).resolves.toBe("local-user");
  });

  it("lança UnauthenticatedError sem sessão e sem fallback (dev)", async () => {
    authMock.mockResolvedValue(null);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_USER_ID", "");
    await expect(getCurrentUserId()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("em produção, ignora o fallback e lança mesmo com LOCAL_USER_ID setado", async () => {
    authMock.mockResolvedValue(null);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOCAL_USER_ID", "local-user");
    await expect(getCurrentUserId()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
