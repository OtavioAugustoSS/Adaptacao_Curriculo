import { describe, it, expect } from "vitest";
import { escapeLatex } from "@/server/resume/escape-latex";

describe("escapeLatex", () => {
  it("mantém texto sem caracteres especiais inalterado", () => {
    expect(escapeLatex("Engenheiro de Software")).toBe("Engenheiro de Software");
  });

  it("retorna string vazia para entrada vazia", () => {
    expect(escapeLatex("")).toBe("");
  });

  it("escapa o E comercial (&)", () => {
    expect(escapeLatex("R&D")).toBe("R\\&D");
  });

  it("escapa porcentagem, cifrão, cerquilha e underscore", () => {
    expect(escapeLatex("100% $5 #1 a_b")).toBe("100\\% \\$5 \\#1 a\\_b");
  });

  it("escapa chaves", () => {
    expect(escapeLatex("{x}")).toBe("\\{x\\}");
  });

  it("escapa a barra invertida como \\textbackslash{}", () => {
    expect(escapeLatex("a\\b")).toBe("a\\textbackslash{}b");
  });

  it("escapa til e circunflexo com comandos LaTeX", () => {
    expect(escapeLatex("~^")).toBe("\\textasciitilde{}\\textasciicircum{}");
  });

  it("não re-escapa os caracteres que ele mesmo insere (barra antes das chaves)", () => {
    // A barra vira \textbackslash{}; as chaves inseridas NÃO podem ser re-escapadas.
    expect(escapeLatex("\\")).toBe("\\textbackslash{}");
  });

  it("escapa uma combinação realista de bullet de currículo", () => {
    expect(escapeLatex("Aumentou vendas em 30% usando C# & Node_JS")).toBe(
      "Aumentou vendas em 30\\% usando C\\# \\& Node\\_JS",
    );
  });
});
