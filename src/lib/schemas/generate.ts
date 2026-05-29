// Schemas de geração: request da rota POST /api/resumes/generate, relatório de
// rastreabilidade do guardrail, e o registro persistido GeneratedResume.
// Ver docs/api-contract.md §1/§2 e docs/erd.md (GeneratedResume).

import { z } from "zod";
import { ResumeContentSchema } from "./resume-content";

/** Modo de geração: 1 (currículo padrão) ou 2 (adaptado à vaga). */
export const GenerationModeSchema = z.enum(["STANDARD", "JOB_ADAPTIVE"]);
export type GenerationMode = z.infer<typeof GenerationModeSchema>;

/**
 * Request de geração. `jobText` é obrigatório quando `mode === "JOB_ADAPTIVE"`
 * (Modo 2 precisa da vaga colada) e ignorado no Modo 1.
 */
export const GenerateRequestSchema = z
  .object({
    mode: GenerationModeSchema,
    jobText: z.string().optional(),
  })
  .refine(
    (data) =>
      data.mode !== "JOB_ADAPTIVE" ||
      (typeof data.jobText === "string" && data.jobText.trim().length > 0),
    {
      message: "jobText é obrigatório quando mode === 'JOB_ADAPTIVE'",
      path: ["jobText"],
    },
  );
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/**
 * Uma ocorrência do guardrail de rastreabilidade: campo gerado, valor e o motivo.
 * Usado tanto para `errors` (falha dura → regenerar) quanto `warnings` (preview).
 */
export const IssueSchema = z.object({
  field: z.string(),
  value: z.string(),
  reason: z.string(),
});
export type Issue = z.infer<typeof IssueSchema>;

/**
 * Relatório da checagem pós-geração (`validate-traceability.ts`).
 * `errors` = entidades não presentes na base (falha dura). `warnings` = números/
 * datas/tecnologias novos, surfados no preview.
 */
export const TraceabilityReportSchema = z.object({
  errors: z.array(IssueSchema).default([]),
  warnings: z.array(IssueSchema).default([]),
});
export type TraceabilityReport = z.infer<typeof TraceabilityReportSchema>;

/** Registro persistido de um currículo gerado (ver ERD: GeneratedResume). */
export const GeneratedResumeSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  mode: GenerationModeSchema,
  jobPostingId: z.string().nullable().optional(),
  modelId: z.string(),
  contentJson: ResumeContentSchema,
  texOutput: z.string(),
  traceabilityReport: TraceabilityReportSchema.nullable().optional(),
  createdAt: z.coerce.date(),
});
export type GeneratedResume = z.infer<typeof GeneratedResumeSchema>;
