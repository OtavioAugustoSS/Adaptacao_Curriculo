// Repositório de vagas coladas (JobPosting) — insumo do Modo 2 (US-08).
// Mesma disciplina do resume-repo/profile-repo: a (de)serialização JSON vive SÓ
// aqui (ADR-0005) e o acesso é sempre via getCurrentUserId() (ADR-0006).
//
// No MVP (ADR-0016) só persistimos o `rawText`: `title`/`company` ficam vazios e
// `parsedKeywords` fica null (o casamento vaga×base acontece dentro do prompt do
// LLM, não por extração prévia). Esses campos seguem no schema como pontos de
// extensão futuros.

import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/auth/getCurrentUserId";
import { JobPostingSchema, type JobPosting } from "@/lib/schemas";

/** Linha crua de JobPosting (parsedKeywords é String-JSON ou null no Prisma). */
interface JobPostingRow {
  id: string;
  userId: string;
  rawText: string;
  title: string | null;
  company: string | null;
  parsedKeywords: string | null;
  createdAt: Date;
}

/**
 * Converte a linha do Prisma no `JobPosting` de domínio, desserializando
 * `parsedKeywords` (String-JSON → string[]) e revalidando com o schema. `null`
 * vira `undefined` para casar com os `.optional()` do JobPostingSchema.
 */
function toJobPosting(row: JobPostingRow): JobPosting {
  return JobPostingSchema.parse({
    id: row.id,
    userId: row.userId,
    rawText: row.rawText,
    title: row.title ?? undefined,
    company: row.company ?? undefined,
    parsedKeywords: row.parsedKeywords
      ? JSON.parse(row.parsedKeywords)
      : undefined,
  });
}

/**
 * Persiste a vaga colada pelo usuário atual a partir do texto integral e devolve
 * o registro de domínio. MVP (ADR-0016): só `rawText`; `title`/`company` vazios e
 * `parsedKeywords` null — sem extração prévia.
 */
export async function createJobPosting(input: {
  rawText: string;
}): Promise<JobPosting> {
  const userId = await getCurrentUserId();

  const row = await prisma.jobPosting.create({
    data: {
      userId,
      rawText: input.rawText,
      title: null,
      company: null,
      parsedKeywords: null,
    },
  });

  return toJobPosting(row);
}
