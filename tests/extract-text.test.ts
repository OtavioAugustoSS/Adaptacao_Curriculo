import { describe, it, expect, vi, beforeEach } from "vitest";

// Testes de COMPORTAMENTO da fronteira arquivo -> texto (US-13, ADR-0019 §2).
// As libs de parsing (unpdf/mammoth) são a FRONTEIRA: mockadas, sem rede e sem ler
// arquivos reais. O código usa import DINÂMICO (`await import("unpdf")`), mas o
// vi.mock é hoisted e substitui o módulo no registry — cobre o import dinâmico também.
// TXT não tem lib: decodifica UTF-8 com bytes reais (round-trip de uma string).

// --- Mocks das libs de parsing (fronteira) ---------------------------------

const getDocumentProxy = vi.hoisted(() => vi.fn());
const extractText = vi.hoisted(() => vi.fn());
vi.mock("unpdf", () => ({ getDocumentProxy, extractText }));

const mammothExtractRawText = vi.hoisted(() => vi.fn());
// mammoth é usado como default export no código: `(await import("mammoth")).default`.
vi.mock("mammoth", () => ({
  default: { extractRawText: mammothExtractRawText },
}));

import {
  extractTextFromFile,
  UnsupportedFileTypeError,
} from "@/server/profile/extract-text";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractTextFromFile — TXT (UTF-8, sem lib)", () => {
  it("deve decodificar bytes UTF-8 reais como texto", async () => {
    const original = "Otávio — currículo com acento e travessão.";
    const bytes = new TextEncoder().encode(original);

    const text = await extractTextFromFile({
      bytes,
      mimeType: "text/plain",
      fileName: "cv.txt",
    });

    expect(text).toBe(original);
    // TXT não usa as libs de parsing.
    expect(getDocumentProxy).not.toHaveBeenCalled();
    expect(mammothExtractRawText).not.toHaveBeenCalled();
  });

  it("NÃO deve fazer trim (vazio/whitespace é decisão da rota)", async () => {
    const bytes = new TextEncoder().encode("   ");
    const text = await extractTextFromFile({
      bytes,
      mimeType: "text/plain",
      fileName: "cv.txt",
    });
    expect(text).toBe("   ");
  });
});

describe("extractTextFromFile — PDF (via mock de unpdf)", () => {
  it("deve retornar o texto extraído pelo unpdf", async () => {
    const fakeProxy = { numPages: 2 };
    getDocumentProxy.mockResolvedValue(fakeProxy);
    extractText.mockResolvedValue({ text: "Texto do PDF" });

    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
    const text = await extractTextFromFile({
      bytes,
      mimeType: "application/pdf",
      fileName: "cv.pdf",
    });

    expect(text).toBe("Texto do PDF");
    expect(getDocumentProxy).toHaveBeenCalledWith(bytes);
    // extractText recebe o proxy e mergePages:true (texto contínuo).
    expect(extractText).toHaveBeenCalledWith(fakeProxy, { mergePages: true });
  });

  it("deve despachar para PDF por extensão mesmo com MIME genérico", async () => {
    getDocumentProxy.mockResolvedValue({});
    extractText.mockResolvedValue({ text: "do nome .pdf" });

    const text = await extractTextFromFile({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "application/octet-stream",
      fileName: "curriculo.pdf",
    });

    expect(text).toBe("do nome .pdf");
    expect(getDocumentProxy).toHaveBeenCalledTimes(1);
  });
});

describe("extractTextFromFile — DOCX (via mock de mammoth)", () => {
  it("deve retornar o value extraído pelo mammoth", async () => {
    mammothExtractRawText.mockResolvedValue({ value: "Texto do DOCX" });

    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // "PK.." (zip)
    const text = await extractTextFromFile({
      bytes,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: "cv.docx",
    });

    expect(text).toBe("Texto do DOCX");
    // mammoth precisa de Buffer do Node, não Uint8Array cru.
    expect(mammothExtractRawText).toHaveBeenCalledTimes(1);
    const arg = mammothExtractRawText.mock.calls[0][0];
    expect(Buffer.isBuffer(arg.buffer)).toBe(true);
  });

  it("deve despachar para DOCX por extensão mesmo com MIME ausente", async () => {
    mammothExtractRawText.mockResolvedValue({ value: "por extensão" });

    const text = await extractTextFromFile({
      bytes: new Uint8Array([0x50, 0x4b]),
      mimeType: "",
      fileName: "curriculo.docx",
    });

    expect(text).toBe("por extensão");
    expect(getDocumentProxy).not.toHaveBeenCalled();
  });
});

describe("extractTextFromFile — tipo fora da whitelist", () => {
  it("deve lançar UnsupportedFileTypeError para .png", async () => {
    await expect(
      extractTextFromFile({
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        mimeType: "image/png",
        fileName: "foto.png",
      }),
    ).rejects.toBeInstanceOf(UnsupportedFileTypeError);
  });

  it("deve lançar UnsupportedFileTypeError quando MIME genérico e sem extensão válida", async () => {
    await expect(
      extractTextFromFile({
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "application/octet-stream",
        fileName: "arquivo-sem-extensao",
      }),
    ).rejects.toBeInstanceOf(UnsupportedFileTypeError);
    // Não deve tocar nenhuma lib de parsing antes de barrar.
    expect(getDocumentProxy).not.toHaveBeenCalled();
    expect(mammothExtractRawText).not.toHaveBeenCalled();
  });
});
