// Análise estruturada de uma VAGA (ADR-0027, passo 1 do pipeline de adaptação).
//
// É ANDAIME INTERNO, não contrato de API e NÃO fonte de fatos do currículo: serve só para
// GUIAR o passo 2 (adaptação) — dar ao modelo um mapa explícito do que a vaga pede, para ele
// reordenar/realçar os itens REAIS da base. O guardrail (validate-traceability) continua
// validando o currículo contra a BASE, nunca contra esta análise. Por isso vive na camada LLM
// (server) e não no barrel do contrato congelado (src/lib/schemas).
//
// Schema TOLERANTE (campos default "" / []): uma vaga atípica não deve dar 502 — pior caso, a
// análise vem pobre e o passo 2 ainda adapta a partir da base (resiliência no select-content).

import { z } from "zod";

export const JobAnalysisSchema = z.object({
  /** Cargo/título da vaga (ex.: "Desenvolvedor Back-end", "Engenheiro de Dados"). */
  role: z.string().default(""),
  /** Senioridade explícita na vaga (ex.: "Júnior/Pleno"), se houver. */
  seniority: z.string().default(""),
  /** Área/domínio (ex.: "back-end em nuvem", "front-end web", "dados"). */
  domain: z.string().default(""),
  /** Requisitos ESSENCIAIS (must-have) da vaga. */
  mustHave: z.array(z.string()).default([]),
  /** Requisitos desejáveis (nice-to-have). */
  niceToHave: z.array(z.string()).default([]),
  /** Termos técnicos/keywords a casar com a base (ATS): linguagens, ferramentas, conceitos. */
  keywords: z.array(z.string()).default([]),
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;
