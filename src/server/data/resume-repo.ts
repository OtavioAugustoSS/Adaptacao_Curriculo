// Repositório de currículos gerados (GeneratedResume).
// Mesma disciplina do profile-repo: a (de)serialização JSON vive SÓ aqui (ADR-0005).
// No Prisma, `contentJson` e `traceabilityReport` são String-JSON; no domínio são
// objetos (`ResumeContent` / `TraceabilityReport`). Os schemas Zod não mudam por isso.
//
// Acesso a dados sempre via getCurrentUserId() (ADR-0006): nenhuma função recebe
// userId por parâmetro vindo de request.

import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/auth/getCurrentUserId";
import {
  GeneratedResumeSchema,
  type GeneratedResume,
  type GenerationMode,
  type ResumeContent,
  type TraceabilityReport,
} from "@/lib/schemas";
import { defaultResumeName } from "@/lib/presentation/resume-meta";

/** Dados necessários para persistir um currículo gerado (entrada da escrita). */
export interface NewGeneratedResume {
  mode: GenerationMode;
  modelId: string;
  content: ResumeContent;
  texOutput: string;
  /**
   * Nome do usuário (ADR-0021). Ausente/vazio → default = rótulo do modo + data
   * (`defaultResumeName`), o mesmo aplicado no backfill da migração.
   */
  name?: string;
  /** Id da vaga (Modo 2). `null`/ausente no Modo 1. */
  jobPostingId?: string | null;
  /**
   * Relatório de rastreabilidade. ADR-0014: enquanto a US-07 não existe, gravar
   * `null` (= "não avaliado"), nunca `{ errors: [], warnings: [] }`.
   */
  traceabilityReport?: TraceabilityReport | null;
}

// ---------------------------------------------------------------------------
// Mapeamento Prisma -> domínio
// ---------------------------------------------------------------------------

/** Linha crua de GeneratedResume (campos JSON como String). */
interface GeneratedResumeRow {
  id: string;
  userId: string;
  name: string;
  mode: string;
  isDefault: boolean;
  jobPostingId: string | null;
  modelId: string;
  contentJson: string;
  texOutput: string;
  traceabilityReport: string | null;
  createdAt: Date;
}

/**
 * Converte a linha do Prisma no `GeneratedResume` de domínio, desserializando os
 * campos JSON e revalidando com o schema (fronteira de confiança na leitura também).
 */
function toGeneratedResume(row: GeneratedResumeRow): GeneratedResume {
  return GeneratedResumeSchema.parse({
    id: row.id,
    userId: row.userId,
    name: row.name,
    mode: row.mode,
    isDefault: row.isDefault,
    jobPostingId: row.jobPostingId,
    modelId: row.modelId,
    contentJson: JSON.parse(row.contentJson),
    texOutput: row.texOutput,
    traceabilityReport: row.traceabilityReport
      ? JSON.parse(row.traceabilityReport)
      : null,
    createdAt: row.createdAt,
  });
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

/**
 * Persiste um currículo gerado para o usuário atual e devolve o registro de domínio.
 * Serializa `content` e `traceabilityReport` para String-JSON (só aqui — ADR-0005).
 */
export async function createGeneratedResume(
  input: NewGeneratedResume,
): Promise<GeneratedResume> {
  const userId = getCurrentUserId();

  // Default do nome (ADR-0021): rótulo do modo + data de hoje (a coluna `createdAt`
  // também usa now(), então casam na data). Nome vazio/ausente → default no servidor.
  const name =
    input.name && input.name.trim().length > 0
      ? input.name.trim()
      : defaultResumeName(input.mode, new Date());

  // Auto-default (ADR-0022): se o usuário ainda não tem nenhum currículo, este vira o
  // padrão — garante "pelo menos um padrão" sem fricção. Caso contrário, preserva o atual.
  const existingCount = await prisma.generatedResume.count({ where: { userId } });
  const isDefault = existingCount === 0;

  const row = await prisma.generatedResume.create({
    data: {
      userId,
      name,
      mode: input.mode,
      isDefault,
      jobPostingId: input.jobPostingId ?? null,
      modelId: input.modelId,
      contentJson: JSON.stringify(input.content),
      texOutput: input.texOutput,
      traceabilityReport:
        input.traceabilityReport != null
          ? JSON.stringify(input.traceabilityReport)
          : null,
    },
  });

  return toGeneratedResume(row);
}

/**
 * Renomeia um currículo do usuário atual (ADR-0021 — PATCH /api/resumes/[id]).
 * Restrito ao usuário (updateMany com `where: { id, userId }`): id inexistente OU
 * alheio → 0 linhas afetadas → devolve `null` (o handler responde 404, sem vazar a
 * existência de recurso alheio). Devolve o registro atualizado no sucesso.
 */
export async function renameGeneratedResume(
  id: string,
  name: string,
): Promise<GeneratedResume | null> {
  const userId = getCurrentUserId();

  const result = await prisma.generatedResume.updateMany({
    where: { id, userId },
    data: { name },
  });
  if (result.count === 0) return null;

  return getGeneratedResumeById(id);
}

/**
 * Define um currículo como o PADRÃO do usuário atual (ADR-0022 — PATCH com isDefault).
 * No máximo um padrão por usuário (garantido aqui, não por constraint de banco).
 *
 * Ordem proposital: marca o ALVO primeiro (`updateMany where { id, userId }`). Se nada
 * foi afetado (id inexistente/alheio) devolve `null` SEM ter mexido no padrão atual — não
 * deixamos o usuário sem padrão por um id inválido. Só então zera o `isDefault` dos demais.
 */
export async function setDefaultResume(
  id: string,
): Promise<GeneratedResume | null> {
  const userId = getCurrentUserId();

  const set = await prisma.generatedResume.updateMany({
    where: { id, userId },
    data: { isDefault: true },
  });
  if (set.count === 0) return null; // inexistente/alheio: nada muda (padrão atual intacto)

  // Desmarca todos os OUTROS padrões do usuário (mantém só o alvo).
  await prisma.generatedResume.updateMany({
    where: { userId, isDefault: true, NOT: { id } },
    data: { isDefault: false },
  });

  return getGeneratedResumeById(id);
}

/**
 * Exclui um currículo do usuário atual (ADR-0021 — DELETE /api/resumes/[id]).
 * Restrito ao usuário (deleteMany com `where: { id, userId }`): devolve `true` se algo
 * foi apagado, `false` se id inexistente/alheio (o handler responde 404).
 */
export async function deleteGeneratedResume(id: string): Promise<boolean> {
  const userId = getCurrentUserId();

  const result = await prisma.generatedResume.deleteMany({
    where: { id, userId },
  });
  return result.count > 0;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * Lista o histórico de currículos do usuário atual, do mais recente ao mais antigo
 * (contrato §2: GET /api/resumes). Sem paginação no MVP.
 */
export async function listGeneratedResumes(): Promise<GeneratedResume[]> {
  const userId = getCurrentUserId();

  const rows = await prisma.generatedResume.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(toGeneratedResume);
}

/**
 * Lê um currículo gerado por id, restrito ao usuário atual (evita ler de outro
 * usuário quando entrar multiusuário). `null` se não existir/não pertencer.
 * Consumido pela US-06 (download do `.tex` cacheado).
 */
export async function getGeneratedResumeById(
  id: string,
): Promise<GeneratedResume | null> {
  const userId = getCurrentUserId();

  const row = await prisma.generatedResume.findFirst({
    where: { id, userId },
  });

  if (!row) return null;
  return toGeneratedResume(row);
}

/**
 * Devolve o currículo PADRÃO do usuário atual (ADR-0022) — usado como referência de
 * profundidade no Modo 2 quando o request não traz `baseResumeId`. Se nenhum estiver
 * marcado `isDefault` (caso de borda — ex.: o padrão foi excluído), faz fallback para o
 * **STANDARD mais recente** (o currículo "completo" mais natural como base). `null` se o
 * usuário não tiver nenhum currículo.
 */
export async function getDefaultResume(): Promise<GeneratedResume | null> {
  const userId = getCurrentUserId();

  const explicit = await prisma.generatedResume.findFirst({
    where: { userId, isDefault: true },
  });
  if (explicit) return toGeneratedResume(explicit);

  const latestStandard = await prisma.generatedResume.findFirst({
    where: { userId, mode: "STANDARD" },
    orderBy: { createdAt: "desc" },
  });
  return latestStandard ? toGeneratedResume(latestStandard) : null;
}
