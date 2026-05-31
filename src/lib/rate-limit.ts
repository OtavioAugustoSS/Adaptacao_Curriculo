// Rate limit EM MEMÓRIA por chave (ADR-0028). Suficiente num único processo persistente
// (Render free = 1 instância): protege as rotas caras (geração/import) — cota da NIM (chave
// compartilhada), custo e carga. Janela deslizante simples. Trade-off: o estado zera em
// restart/redeploy (aceitável p/ teste fechado <20); multi-instância → trocar por Redis/Upstash.
//
// Função PURA o suficiente para teste (relógio injetável); o store vive no módulo (processo).

const store = new Map<string, number[]>();

export interface RateLimitResult {
  /** `true` se a requisição pode prosseguir. */
  ok: boolean;
  /** Segundos até liberar a próxima (só quando `ok` é false). */
  retryAfterSec: number;
  /** Quantas requisições ainda cabem na janela. */
  remaining: number;
}

/**
 * Janela deslizante: permite `limit` requisições por `windowMs` para a `key`. Chame ANTES da
 * operação cara; se `ok` for false, responda 429. Conta a requisição atual quando permite.
 *
 * @param key      Identificador (ex.: `generate:<userId>`).
 * @param limit    Máximo de requisições na janela.
 * @param windowMs Tamanho da janela em ms.
 * @param now      Relógio (injetável para teste; default `Date.now()`).
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const cutoff = now - windowMs;
  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    store.set(key, hits);
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    return { ok: false, retryAfterSec, remaining: 0 };
  }

  hits.push(now);
  store.set(key, hits);
  return { ok: true, retryAfterSec: 0, remaining: limit - hits.length };
}

/** Limpa o store (uso em testes). */
export function __resetRateLimit(): void {
  store.clear();
}
