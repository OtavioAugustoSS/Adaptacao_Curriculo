import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { ProfileBundle } from "@/lib/schemas";
import { LLMError } from "@/server/llm/provider";
import { UnsupportedFileTypeError } from "@/server/profile/extract-text";

// Testes de COMPORTAMENTO da rota POST /api/profile/import/file (US-13, ADR-0019).
// Irmã da rota de import por texto: mesmo invariante (NÃO PERSISTE) + o mapa de status
// específico do arquivo. Mockamos as FRONTEIRAS que o handler invoca — extract-text
// (arquivo->texto) e extract-profile (texto->rascunho via LLM) — para tests
// determinísticos sem libs de parsing nem rede. O corpo é multipart real via FormData.

// --- Mocks de fronteira -----------------------------------------------------

// Arquivo -> texto. Testada à parte em extract-text.test; aqui é a fronteira da ROTA.
const extractTextFromFile = vi.hoisted(() => vi.fn());
vi.mock("@/server/profile/extract-text", async () => {
  // Mantém a classe de erro REAL (a rota faz `instanceof UnsupportedFileTypeError`).
  const actual = await vi.importActual<typeof import("@/server/profile/extract-text")>(
    "@/server/profile/extract-text",
  );
  return { ...actual, extractTextFromFile };
});

// Texto -> rascunho (via LLM). Mockado para isolar a rota do transporte.
const extractProfileFromDump = vi.hoisted(() => vi.fn());
vi.mock("@/server/profile/extract-profile", () => ({ extractProfileFromDump }));

// A rota chama getLLMProvider() antes de extract: duble inerte (quem importa é o mock acima).
vi.mock("@/server/llm", () => ({
  getLLMProvider: () => ({ extractProfileFromDump: vi.fn() }),
}));

// Repo de perfil mockado SÓ para provar que a rota não persiste.
const saveProfileBundle = vi.hoisted(() => vi.fn());
const getProfileBundle = vi.hoisted(() => vi.fn());
vi.mock("@/server/data/profile-repo", () => ({ saveProfileBundle, getProfileBundle }));

import { POST } from "@/app/api/profile/import/file/route";

// --- Helpers ----------------------------------------------------------------

// Monta um NextRequest multipart real com um campo `file`. `req.formData()` no handler
// lê deste corpo. `bytes` controla o tamanho efetivo do File (para o teste do limite).
function makeFileRequest(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): NextRequest {
  const fd = new FormData();
  // `bytes` é Uint8Array; sob o TS do projeto ele não casa com BlobPart (distinção
  // ArrayBuffer × SharedArrayBuffer). Cast explícito — em runtime é um BlobPart válido.
  fd.append("file", new File([bytes as BlobPart], fileName, { type: mimeType }));
  return new Request("http://localhost/api/profile/import/file", {
    method: "POST",
    body: fd,
  }) as unknown as NextRequest;
}

// Request multipart SEM o campo `file` (outro campo presente).
function makeRequestWithoutFile(): NextRequest {
  const fd = new FormData();
  fd.append("outro", "valor");
  return new Request("http://localhost/api/profile/import/file", {
    method: "POST",
    body: fd,
  }) as unknown as NextRequest;
}

const DRAFT: ProfileBundle = {
  profile: { fullName: "Otávio" },
  experiences: [],
  educations: [
    { institution: "USP", degree: "BSc", startDate: "2022", current: true, order: 0 },
  ],
  skills: [],
  projects: [],
  languages: [],
  courses: [],
};

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/profile/import/file — caminho feliz", () => {
  it("deve devolver 200 com o rascunho da extração", async () => {
    extractTextFromFile.mockResolvedValue("Texto do currículo extraído.");
    extractProfileFromDump.mockResolvedValue(DRAFT);

    const res = await POST(makeFileRequest(PDF_BYTES, "cv.pdf", "application/pdf"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(DRAFT);
    // A formação em andamento sobrevive ao round-trip do rascunho.
    expect(json.educations[0].current).toBe(true);
  });

  it("deve passar o texto extraído para a extração de perfil", async () => {
    extractTextFromFile.mockResolvedValue("Currículo do Otávio.");
    extractProfileFromDump.mockResolvedValue(DRAFT);

    await POST(makeFileRequest(PDF_BYTES, "cv.pdf", "application/pdf"));

    expect(extractProfileFromDump).toHaveBeenCalledTimes(1);
    // 1º arg é o texto extraído (assinatura (text, provider, modelId)).
    expect(extractProfileFromDump.mock.calls[0][0]).toBe("Currículo do Otávio.");
  });

  it("NÃO deve persistir (o save é do PUT /api/profile, após revisão humana)", async () => {
    extractTextFromFile.mockResolvedValue("Texto válido.");
    extractProfileFromDump.mockResolvedValue(DRAFT);

    await POST(makeFileRequest(PDF_BYTES, "cv.pdf", "application/pdf"));

    expect(saveProfileBundle).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/import/file — validação do request", () => {
  it("deve responder 400 INVALID_REQUEST quando não há campo file, sem extrair", async () => {
    const res = await POST(makeRequestWithoutFile());

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_REQUEST");
    expect(extractTextFromFile).not.toHaveBeenCalled();
    expect(extractProfileFromDump).not.toHaveBeenCalled();
    expect(saveProfileBundle).not.toHaveBeenCalled();
  });

  it("deve responder 415 UNSUPPORTED_MEDIA_TYPE para tipo fora da whitelist (.png), sem extrair", async () => {
    const res = await POST(
      makeFileRequest(new Uint8Array([0x89, 0x50]), "foto.png", "image/png"),
    );

    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(extractTextFromFile).not.toHaveBeenCalled();
    expect(saveProfileBundle).not.toHaveBeenCalled();
  });

  it("deve responder 413 PAYLOAD_TOO_LARGE para arquivo acima de 8 MB, sem extrair", async () => {
    // 8 MB + 1 byte. O File reporta esse size; a rota barra antes de ler.
    const tooBig = new Uint8Array(8 * 1024 * 1024 + 1);
    const res = await POST(makeFileRequest(tooBig, "cv.pdf", "application/pdf"));

    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(extractTextFromFile).not.toHaveBeenCalled();
    expect(saveProfileBundle).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/import/file — texto extraído vazio (422)", () => {
  it("deve responder 422 EMPTY_EXTRACTION quando o texto vem vazio (PDF imagem), sem chamar o LLM", async () => {
    extractTextFromFile.mockResolvedValue("");

    const res = await POST(makeFileRequest(PDF_BYTES, "cv.pdf", "application/pdf"));

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("EMPTY_EXTRACTION");
    // Sem texto não há o que interpretar: o LLM não é chamado nem persiste.
    expect(extractProfileFromDump).not.toHaveBeenCalled();
    expect(saveProfileBundle).not.toHaveBeenCalled();
  });

  it("deve responder 422 EMPTY_EXTRACTION quando o texto é só whitespace", async () => {
    extractTextFromFile.mockResolvedValue("   \n\t  ");

    const res = await POST(makeFileRequest(PDF_BYTES, "cv.pdf", "application/pdf"));

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("EMPTY_EXTRACTION");
    expect(extractProfileFromDump).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/import/file — erros da camada de IA e inesperados", () => {
  it("deve responder 502 LLM_ERROR quando a extração de perfil lança LLMError, sem persistir", async () => {
    extractTextFromFile.mockResolvedValue("Texto válido para interpretar.");
    extractProfileFromDump.mockRejectedValue(new LLMError("transport", "provedor caiu"));

    const res = await POST(makeFileRequest(PDF_BYTES, "cv.pdf", "application/pdf"));

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error.code).toBe("LLM_ERROR");
    expect(saveProfileBundle).not.toHaveBeenCalled();
  });

  it("deve responder 415 quando extract-text lança UnsupportedFileTypeError (defesa redundante)", async () => {
    extractTextFromFile.mockRejectedValue(new UnsupportedFileTypeError());

    const res = await POST(makeFileRequest(PDF_BYTES, "cv.pdf", "application/pdf"));

    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(saveProfileBundle).not.toHaveBeenCalled();
  });

  it("deve responder 500 INTERNAL_ERROR quando a lib de parsing lança erro inesperado (arquivo corrompido)", async () => {
    extractTextFromFile.mockRejectedValue(new Error("PDF corrompido"));

    const res = await POST(makeFileRequest(PDF_BYTES, "cv.pdf", "application/pdf"));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(saveProfileBundle).not.toHaveBeenCalled();
  });
});
