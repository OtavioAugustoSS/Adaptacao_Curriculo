import { describe, it, expect } from "vitest";
import {
  isAcceptedImportFile,
  ACCEPTED_IMPORT_MIME,
  ACCEPTED_IMPORT_EXTENSIONS,
  MAX_IMPORT_FILE_BYTES,
  IMPORT_FILE_ACCEPT,
} from "@/lib/import-file";

// Testes de COMPORTAMENTO da whitelist do import por arquivo (US-13, ADR-0019 §3).
// Lógica pura, sem fronteira: decide se um arquivo é aceito por MIME OU por extensão.
// O ponto central é tolerar o MIME impreciso do multipart (vazio/genérico) caindo na
// extensão do nome — sem isso, uploads legítimos de PDF/DOCX/TXT seriam rejeitados.

describe("isAcceptedImportFile — aceita pelos MIMEs oficiais", () => {
  it("deve aceitar PDF pelo MIME application/pdf", () => {
    expect(isAcceptedImportFile("curriculo.pdf", "application/pdf")).toBe(true);
  });

  it("deve aceitar DOCX pelo MIME oficial do Office", () => {
    expect(
      isAcceptedImportFile(
        "curriculo.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
  });

  it("deve aceitar TXT pelo MIME text/plain", () => {
    expect(isAcceptedImportFile("curriculo.txt", "text/plain")).toBe(true);
  });
});

describe("isAcceptedImportFile — fallback por extensão quando o MIME falha", () => {
  it("deve aceitar PDF por extensão quando o MIME vem vazio (multipart sem tipo)", () => {
    expect(isAcceptedImportFile("curriculo.pdf", "")).toBe(true);
  });

  it("deve aceitar DOCX por extensão quando o MIME vem genérico (octet-stream)", () => {
    expect(isAcceptedImportFile("curriculo.docx", "application/octet-stream")).toBe(true);
  });

  it("deve aceitar TXT por extensão quando o MIME vem vazio", () => {
    expect(isAcceptedImportFile("curriculo.txt", "")).toBe(true);
  });

  it("deve ser case-insensitive na extensão (.PDF maiúsculo)", () => {
    expect(isAcceptedImportFile("CURRICULO.PDF", "")).toBe(true);
    expect(isAcceptedImportFile("Curriculo.DocX", "")).toBe(true);
  });
});

describe("isAcceptedImportFile — rejeita o que está fora da whitelist", () => {
  it("deve rejeitar .png mesmo com extensão presente (não está na whitelist)", () => {
    expect(isAcceptedImportFile("foto.png", "image/png")).toBe(false);
  });

  it("deve rejeitar MIME genérico SEM extensão válida no nome", () => {
    expect(isAcceptedImportFile("arquivo", "application/octet-stream")).toBe(false);
  });

  it("deve rejeitar quando MIME e extensão são ambos inaceitáveis", () => {
    expect(isAcceptedImportFile("planilha.xlsx", "application/vnd.ms-excel")).toBe(false);
  });

  it("deve aceitar quando o MIME é válido mesmo que a extensão não seja (MIME OU extensão)", () => {
    // A regra é OU: um MIME oficial basta, independente do nome do arquivo.
    expect(isAcceptedImportFile("curriculo", "application/pdf")).toBe(true);
  });
});

describe("constantes do import por arquivo", () => {
  it("MAX_IMPORT_FILE_BYTES deve ser 8 MB", () => {
    expect(MAX_IMPORT_FILE_BYTES).toBe(8 * 1024 * 1024);
  });

  it("IMPORT_FILE_ACCEPT deve conter os 3 MIMEs e as 3 extensões", () => {
    for (const mime of ACCEPTED_IMPORT_MIME) {
      expect(IMPORT_FILE_ACCEPT).toContain(mime);
    }
    for (const ext of ACCEPTED_IMPORT_EXTENSIONS) {
      expect(IMPORT_FILE_ACCEPT).toContain(ext);
    }
  });
});
