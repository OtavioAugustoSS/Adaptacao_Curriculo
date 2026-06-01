import { describe, it, expect } from "vitest";
import { stripNul, stripNulDeep } from "@/server/data/sanitize";

// Regressão do bug de produção: o Postgres rejeita o byte NUL (U+0000) em colunas
// `text` (erro 22021). O SQLite do MVP aceitava; texto de import de PDF/DOCX podia
// trazer NUL e quebrar o save (500 "Falha ao salvar"). O saneamento é a fronteira.
const NUL = String.fromCharCode(0);

describe("stripNul", () => {
  it("remove o byte NUL do meio da string", () => {
    expect(stripNul("PHP" + NUL + " Node")).toBe("PHP Node");
  });

  it("remove múltiplos NUL", () => {
    expect(stripNul(NUL + "a" + NUL + "b" + NUL)).toBe("ab");
  });

  it("preserva acentos, símbolos e quebras de linha", () => {
    const s = "Olá, São Paulo — R$ 100% & #1\nlinha2\tcol";
    expect(stripNul(s)).toBe(s);
  });

  it("preserva outros chars de controle (Postgres os aceita; só o NUL quebra)", () => {
    const soh = String.fromCharCode(1);
    expect(stripNul("a" + soh + "b")).toBe("a" + soh + "b");
  });

  it("é idempotente e não altera string já limpa (mesma referência lógica)", () => {
    expect(stripNul("limpo")).toBe("limpo");
  });
});

describe("stripNulDeep", () => {
  it("limpa strings dentro de arrays e objetos aninhados", () => {
    const input = {
      profile: { fullName: "Maria" + NUL, summary: "ok" },
      experiences: [{ company: "Acme" + NUL, bullets: ["fez" + NUL + " A", "fez B"] }],
    };
    const out = stripNulDeep(input);
    expect(out.profile.fullName).toBe("Maria");
    expect(out.experiences[0].company).toBe("Acme");
    expect(out.experiences[0].bullets).toEqual(["fez A", "fez B"]);
  });

  it("preserva tipos não-string (number/boolean/null/undefined)", () => {
    const input = { n: 42, b: true, z: null, u: undefined, order: 0 };
    expect(stripNulDeep(input)).toEqual({ n: 42, b: true, z: null, u: undefined, order: 0 });
  });
});
