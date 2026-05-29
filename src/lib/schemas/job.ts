// Schema da vaga colada pelo usuário (Modo 2 — currículo adaptativo).
// Ver docs/erd.md (JobPosting) e docs/api-contract.md §1.

import { z } from "zod";

/** Vaga colada pelo usuário. `rawText` é o texto integral; título/empresa são opcionais. */
export const JobPostingSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  rawText: z.string().min(1),
  title: z.string().optional(),
  company: z.string().optional(),
  parsedKeywords: z.array(z.string()).optional(),
});
export type JobPosting = z.infer<typeof JobPostingSchema>;
