import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { ProfileBundle } from "@/lib/schemas";
import { LLMError } from "@/server/llm/provider";

// Testes de COMPORTAMENTO da rota POST /api/profile/import (US-11, ADR-0018).
// Mockamos as FRONTEIRAS (fábrica do LLMProvider + repo de perfil) e exercitamos o
// handler: validação do request (400), caminho feliz (200 com o rascunho), erro do
// LLM (502) e — o invariante central deste fluxo — NÃO PERSISTE: o repo de escrita
// (saveProfileBundle) nunca é chamado. Sem rede, sem banco.

// --- Mocks de fronteira -----------------------------------------------------

// Mockamos o passo de extração (texto -> rascunho via LLM). É a fronteira do handler:
// a ponte base->LLM em si é testada em extract-profile.test. Aqui exercitamos a ROTA.
const extractProfileFromDump = vi.hoisted(() => vi.fn());
vi.mock("@/server/profile/extract-profile", () => ({ extractProfileFromDump }));

// A fábrica do provider precisa existir (a rota a chama antes de extract): devolve um
// duble inerte — quem importa é o extractProfileFromDump mockado acima.
vi.mock("@/server/llm", () => ({
  getLLMProvider: () => ({ extractProfileFromDump: vi.fn() }),
}));

// O repo de perfil é mockado SÓ para provar que a rota não persiste: a rota nem o
// importa, mas montamos o mock e asseguramos que saveProfileBundle não foi chamado.
const saveProfileBundle = vi.hoisted(() => vi.fn());
const getProfileBundle = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/profile-repo", () => ({ saveProfileBundle, getProfileBundle }));

import { POST } from "@/app/api/profile/import/route";

// --- Helpers ----------------------------------------------------------------

// Um NextRequest mínimo: só o .json() importa para o handler.
function makeRequest(body: unknown, opts: { invalidJson?: boolean } = {}): NextRequest {
  return {
    json: opts.invalidJson
      ? async () => {
          throw new SyntaxError("bad json");
        }
      : async () => body,
  } as unknown as NextRequest;
}

// Rascunho devolvido pela extração (sem ids — gerados só no save). O fullName pode
// vir vazio (ADR-0018 §5); aqui um caso com nome preenchido, com uma formação em curso.
const DRAFT: ProfileBundle = {
  profile: { fullName: "Otávio" },
  experiences: [],
  educations: [
    {
      institution: "USP",
      degree: "BSc",
      startDate: "2022",
      current: true,
      order: 0,
    },
  ],
  skills: [],
  projects: [],
  languages: [],
  courses: [],
};

const RAW_TEXT = "Otávio. Cursando BSc na USP desde 2022.";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/profile/import — validação do request", () => {
  it("deve responder 400 INVALID_JSON quando o corpo não é JSON válido, sem chamar o LLM", async () => {
    const res = await POST(makeRequest(null, { invalidJson: true }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_JSON");
    expect(extractProfileFromDump).not.toHaveBeenCalled();
  });

  it("deve responder 400 VALIDATION_ERROR para rawText vazio, sem chamar o LLM", async () => {
    const res = await POST(makeRequest({ rawText: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(extractProfileFromDump).not.toHaveBeenCalled();
  });

  it("deve responder 400 VALIDATION_ERROR para rawText ausente, sem chamar o LLM", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(extractProfileFromDump).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/import — caminho feliz", () => {
  it("deve devolver 200 com o rascunho retornado pela extração", async () => {
    extractProfileFromDump.mockResolvedValue(DRAFT);

    const res = await POST(makeRequest({ rawText: RAW_TEXT }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(DRAFT);
    // A formação em andamento sobrevive ao round-trip do rascunho.
    expect(json.educations[0].current).toBe(true);
  });

  it("deve passar o rawText do request para a extração", async () => {
    extractProfileFromDump.mockResolvedValue(DRAFT);

    await POST(makeRequest({ rawText: RAW_TEXT }));

    expect(extractProfileFromDump).toHaveBeenCalledTimes(1);
    // 1º arg é o rawText (a assinatura é (rawText, provider, modelId)).
    expect(extractProfileFromDump.mock.calls[0][0]).toBe(RAW_TEXT);
  });

  it("NÃO deve persistir nada (o save é do PUT /api/profile, após revisão humana)", async () => {
    extractProfileFromDump.mockResolvedValue(DRAFT);

    await POST(makeRequest({ rawText: RAW_TEXT }));

    // Invariante do fluxo (ADR-0018 §4): import devolve rascunho, não grava.
    expect(saveProfileBundle).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/import — erro do LLM (502)", () => {
  it("deve responder 502 LLM_ERROR quando a extração lança LLMError(transport), sem persistir", async () => {
    extractProfileFromDump.mockRejectedValue(
      new LLMError("transport", "provedor caiu"),
    );

    const res = await POST(makeRequest({ rawText: RAW_TEXT }));

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error.code).toBe("LLM_ERROR");
    expect(saveProfileBundle).not.toHaveBeenCalled();
  });

  it("deve responder 502 LLM_ERROR quando a extração lança LLMError(validation), sem persistir", async () => {
    // Saída do modelo não-conforme ao bundle -> LLMError(validation) -> também 502.
    extractProfileFromDump.mockRejectedValue(
      new LLMError("validation", "saída fora do formato"),
    );

    const res = await POST(makeRequest({ rawText: RAW_TEXT }));

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error.code).toBe("LLM_ERROR");
    expect(saveProfileBundle).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/import — erro inesperado (500)", () => {
  it("deve responder 500 INTERNAL_ERROR quando uma falha não-LLM escapa, sem persistir", async () => {
    extractProfileFromDump.mockRejectedValue(new Error("falha inesperada"));

    const res = await POST(makeRequest({ rawText: RAW_TEXT }));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(saveProfileBundle).not.toHaveBeenCalled();
  });
});
