// Ponto de acesso ao `LLMProvider` padrão do app (seam da US-04).
//
// Os call sites (rota de geração) pegam o provider DAQUI, não instanciam o adapter
// concreto. Trocar de provedor (incl. Claude) é mudar esta fábrica + envs, sem
// tocar no orquestrador. Nos testes, o provider é injetado/mockado nas funções de
// `select-content`, então este módulo não precisa de mock global.

import { NimProvider } from "./nim";
import type { LLMProvider } from "./provider";

export type { LLMProvider } from "./provider";

/**
 * Devolve a implementação padrão de `LLMProvider` (NIM no MVP). Cria sob demanda
 * para que a validação das envs (`LLM_API_KEY`/`LLM_BASE_URL`) só ocorra quando há
 * de fato uma geração — não no import do módulo.
 */
export function getLLMProvider(): LLMProvider {
  return new NimProvider();
}
