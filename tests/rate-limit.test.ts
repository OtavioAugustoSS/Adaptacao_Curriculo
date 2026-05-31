import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, __resetRateLimit } from "@/lib/rate-limit";

// Rate limit em memória (ADR-0028). Relógio injetável → teste determinístico, sem timers.

describe("checkRateLimit (ADR-0028)", () => {
  beforeEach(() => __resetRateLimit());

  it("permite até o limite e bloqueia o excedente", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("k", 3, 1000, t).ok).toBe(true);
    }
    const blocked = checkRateLimit("k", 3, 1000, t);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.remaining).toBe(0);
  });

  it("libera após a janela deslizar", () => {
    expect(checkRateLimit("k", 1, 1000, 0).ok).toBe(true);
    expect(checkRateLimit("k", 1, 1000, 500).ok).toBe(false); // ainda na janela
    expect(checkRateLimit("k", 1, 1000, 1500).ok).toBe(true); // janela passou
  });

  it("isola por chave", () => {
    expect(checkRateLimit("a", 1, 1000, 0).ok).toBe(true);
    expect(checkRateLimit("a", 1, 1000, 0).ok).toBe(false);
    expect(checkRateLimit("b", 1, 1000, 0).ok).toBe(true); // outra chave, contador próprio
  });
});
