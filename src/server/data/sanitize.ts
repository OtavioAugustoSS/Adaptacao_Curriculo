// Fronteira única de saneamento para a persistência em Postgres.
//
// O Postgres rejeita o byte NUL (U+0000) em colunas `text`/`varchar`: um INSERT com
// NUL falha com o erro 22021 "invalid byte sequence for encoding \"UTF8\": 0x00".
// O SQLite (banco do MVP, ADR-0005) ACEITAVA NUL, então o problema só apareceu na
// migração para Postgres (ADR-0025) em produção: texto vindo do import de PDF/DOCX
// (unpdf/mammoth podem emitir NUL) entrava no formulário, passava na validação Zod
// (NUL é um char de string JS válido) e só quebrava no `INSERT` — virando um 500
// genérico ("Falha ao salvar"). Outros chars de controle (SOH, STX…) são UTF-8
// válidos e o Postgres aceita; só o NUL precisa sair.
//
// Espelha a filosofia de fronteira única do escapeLatex: uma só passagem, pura e
// testável, aplicada na borda de escrita (saveProfileBundle) e na extração de texto.

// U+0000 construído por código para não depender de um char de controle literal no fonte.
const NUL_CHAR = String.fromCharCode(0);

/** Remove os bytes NUL (U+0000) de uma string — o Postgres não os aceita em `text`. */
export function stripNul(value: string): string {
  return value.includes(NUL_CHAR) ? value.split(NUL_CHAR).join("") : value;
}

/**
 * Remove NUL recursivamente de todas as strings de um valor JSON-like (string,
 * array, objeto), preservando a estrutura e os tipos não-string (number/boolean/
 * null/undefined passam intactos). Usado para sanear o ProfileBundle inteiro antes
 * de persistir.
 */
export function stripNulDeep<T>(value: T): T {
  if (typeof value === "string") return stripNul(value) as T;
  if (Array.isArray(value)) return value.map((v) => stripNulDeep(v)) as unknown as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripNulDeep(v);
    }
    return out as T;
  }
  return value;
}
