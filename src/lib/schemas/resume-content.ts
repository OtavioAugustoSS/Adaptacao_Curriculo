// `ResumeContentSchema` — a SAÍDA ESTRUTURADA do LLM (núcleo do guardrail).
// Ver docs/api-contract.md §3 e ARCHITECTURE.md §6.
//
// INVARIANTE DE PRODUTO: o LLM NUNCA emite `.tex` e NUNCA inventa fatos. Ele só
// seleciona/omite/reordena/reescreve itens REAIS da base. Por isso cada item de
// `experience`/`projects` carrega um `sourceId` apontando para o item da base,
// permitindo ao renderer e ao validate-traceability rastrear a origem.

import { z } from "zod";

/** Bloco de habilidades agrupadas por categoria (saída do LLM). */
export const ResumeSkillGroupSchema = z.object({
  category: z.string().min(1),
  items: z.array(z.string().min(1)),
});
export type ResumeSkillGroup = z.infer<typeof ResumeSkillGroupSchema>;

/** Formação selecionada/ordenada da base (texto reescrito, fatos preservados). */
export const ResumeEducationItemSchema = z.object({
  sourceId: z.string().optional(),
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().optional(),
  period: z.string().optional(),
  details: z.string().optional(),
});
export type ResumeEducationItem = z.infer<typeof ResumeEducationItemSchema>;

/**
 * Experiência selecionada da base. `sourceId` é OBRIGATÓRIO: rastreia o item real
 * (guardrail). `period` é o intervalo já formatado (ex.: "Jan 2020 — Atual").
 */
export const ResumeExperienceItemSchema = z.object({
  sourceId: z.string().min(1),
  role: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  period: z.string().min(1),
  bullets: z.array(z.string()),
});
export type ResumeExperienceItem = z.infer<typeof ResumeExperienceItemSchema>;

/** Projeto selecionado da base. `sourceId` opcional (pode não vir da base de projetos). */
export const ResumeProjectItemSchema = z.object({
  sourceId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  url: z.string().optional(),
});
export type ResumeProjectItem = z.infer<typeof ResumeProjectItemSchema>;

/** Objeto completo que o LLM retorna (validado antes de renderizar o `.tex`). */
export const ResumeContentSchema = z.object({
  objective: z.string(),
  education: z.array(ResumeEducationItemSchema),
  skills: z.array(ResumeSkillGroupSchema),
  experience: z.array(ResumeExperienceItemSchema),
  projects: z.array(ResumeProjectItemSchema),
  extras: z.array(z.string()).optional(),
  leadership: z.array(z.string()).optional(),
});
export type ResumeContent = z.infer<typeof ResumeContentSchema>;
