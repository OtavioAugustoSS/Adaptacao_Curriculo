// Repositório da base de dados pessoal (Profile + listas).
// Camada de mapeamento entre os schemas de domínio (arrays/objetos) e o Prisma,
// que guarda alguns campos como String-JSON (ADR-0005): Experience.bullets,
// Project.bullets, Project.techStack. A (de)serialização JSON vive SÓ aqui — os
// schemas Zod e o prisma/schema.prisma NÃO mudam por causa disso.
//
// Acesso a dados sempre via getCurrentUserId() (ADR-0006): nenhuma função recebe
// userId por parâmetro vindo de request.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/auth/getCurrentUserId";
import type {
  ProfileBundle,
  Profile,
} from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Serialização de campos JSON-string
// ---------------------------------------------------------------------------

/** Parse defensivo de uma coluna String-JSON em string[]; falha vira []. */
function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Mapeamento Prisma -> domínio (row -> schema de domínio)
// ---------------------------------------------------------------------------

type ProfileRow = Prisma.ProfileGetPayload<{
  include: {
    experiences: true;
    educations: true;
    skills: true;
    projects: true;
    languages: true;
    courses: true;
  };
}>;

/** Converte `null` do Prisma em `undefined` (os schemas usam `.optional()`). */
function orUndefined(value: string | null): string | undefined {
  return value ?? undefined;
}

function toBundle(row: ProfileRow): ProfileBundle {
  const profile: Profile = {
    id: row.id,
    userId: row.userId,
    fullName: row.fullName,
    phone: orUndefined(row.phone),
    location: orUndefined(row.location),
    email: orUndefined(row.email),
    linkedin: orUndefined(row.linkedin),
    github: orUndefined(row.github),
    website: orUndefined(row.website),
    summary: orUndefined(row.summary),
  };

  const byOrder = <T extends { order: number }>(items: T[]): T[] =>
    [...items].sort((a, b) => a.order - b.order);

  return {
    profile,
    experiences: byOrder(row.experiences).map((e) => ({
      id: e.id,
      userId: e.userId,
      profileId: e.profileId,
      company: e.company,
      role: e.role,
      location: orUndefined(e.location),
      startDate: e.startDate,
      endDate: orUndefined(e.endDate),
      current: e.current,
      bullets: parseStringArray(e.bullets),
      order: e.order,
    })),
    educations: byOrder(row.educations).map((e) => ({
      id: e.id,
      userId: e.userId,
      profileId: e.profileId,
      institution: e.institution,
      degree: e.degree,
      field: orUndefined(e.field),
      startDate: e.startDate,
      endDate: orUndefined(e.endDate),
      current: e.current,
      gpa: orUndefined(e.gpa),
      details: orUndefined(e.details),
      order: e.order,
    })),
    skills: byOrder(row.skills).map((s) => ({
      id: s.id,
      userId: s.userId,
      profileId: s.profileId,
      category: s.category,
      name: s.name,
      level: orUndefined(s.level),
      order: s.order,
    })),
    projects: byOrder(row.projects).map((p) => ({
      id: p.id,
      userId: p.userId,
      profileId: p.profileId,
      name: p.name,
      description: p.description,
      bullets: parseStringArray(p.bullets),
      techStack: parseStringArray(p.techStack),
      url: orUndefined(p.url),
      order: p.order,
    })),
    languages: byOrder(row.languages).map((l) => ({
      id: l.id,
      userId: l.userId,
      profileId: l.profileId,
      name: l.name,
      proficiency: l.proficiency,
      order: l.order,
    })),
    courses: byOrder(row.courses).map((c) => ({
      id: c.id,
      userId: c.userId,
      profileId: c.profileId,
      title: c.title,
      issuer: c.issuer,
      date: c.date,
      url: orUndefined(c.url),
      order: c.order,
    })),
  };
}

const INCLUDE_LISTS = {
  experiences: true,
  educations: true,
  skills: true,
  projects: true,
  languages: true,
  courses: true,
} as const;

/**
 * Bundle vazio (sem Profile ainda): estado "vazio" da tela /perfil.
 * NÃO passa pelo ProfileBundleSchema: `fullName: ""` é um placeholder de leitura
 * (o usuário ainda não preencheu nada) e `ProfileSchema.fullName` é `.min(1)`, então
 * o parse lançaria ZodError para todo usuário novo. A validação `.min(1)` é uma regra
 * de ESCRITA (aplicada no PUT antes de persistir), não de leitura — por isso aqui
 * montamos o objeto como literal tipado.
 */
function emptyBundle(): ProfileBundle {
  return {
    profile: { fullName: "" },
    experiences: [],
    educations: [],
    skills: [],
    projects: [],
    languages: [],
    courses: [],
  };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * Lê a base completa do usuário atual. Se ainda não há Profile, devolve um bundle
 * vazio (fullName em branco, listas vazias) para a tela renderizar o estado inicial.
 */
export async function getProfileBundle(): Promise<ProfileBundle> {
  const userId = await getCurrentUserId();

  const row = await prisma.profile.findUnique({
    where: { userId },
    include: INCLUDE_LISTS,
  });

  if (!row) return emptyBundle();
  return toBundle(row);
}

/**
 * Limpa a base do usuário atual (ADR-0021 — DELETE /api/profile): apaga o `Profile`,
 * e o `onDelete: Cascade` do Prisma derruba as 6 listas (experiences, educations,
 * skills, projects, languages, courses). GeneratedResume/JobPosting referenciam o
 * `User`, NÃO o `Profile` → SOBREVIVEM (correto: limpar a base não apaga o histórico).
 * Depois, `getProfileBundle` volta a devolver `emptyBundle()`. IDEMPOTENTE: sem
 * `Profile` → não faz nada e retorna normalmente (o handler responde 204 de toda forma).
 */
export async function clearProfile(): Promise<void> {
  const userId = await getCurrentUserId();
  // deleteMany não lança quando não há linha (idempotência); o cascade cuida das listas.
  await prisma.profile.deleteMany({ where: { userId } });
}

// ---------------------------------------------------------------------------
// Escrita (upsert transacional do bundle completo)
// ---------------------------------------------------------------------------

/**
 * Persiste a base COMPLETA (cabeçalho + todas as listas) do usuário atual num
 * único `$transaction` (US-03).
 *
 * Estratégia "replace": o payload representa o estado desejado inteiro da base.
 * Dentro da transação, cada lista é apagada e recriada a partir do payload. Isso
 * cobre add/editar/remover/reordenar de forma uniforme e determinística — sem diff:
 * itens ausentes no payload somem; novos são criados; o `order` é REINDEXADO pela
 * posição no array (índice 0,1,2…), que é a convenção de ordenação manual da tela.
 *
 * Justificativa (MVP single-user, volume baixo): correção e simplicidade acima de
 * micro-otimização de writes; ids dos itens são regenerados a cada save (os ids da
 * base não são referenciados externamente — o renderer/guardrail usam sourceId dos
 * itens REAIS lidos no momento da geração, não ids persistidos de versões antigas).
 */
export async function saveProfileBundle(bundle: ProfileBundle): Promise<ProfileBundle> {
  const userId = await getCurrentUserId();
  const p = bundle.profile;

  const profileData = {
    fullName: p.fullName,
    phone: p.phone ?? null,
    location: p.location ?? null,
    email: p.email ?? null,
    linkedin: p.linkedin ?? null,
    github: p.github ?? null,
    website: p.website ?? null,
    summary: p.summary ?? null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const profileRow = await tx.profile.upsert({
      where: { userId },
      update: profileData,
      create: { ...profileData, userId },
    });
    const profileId = profileRow.id;

    // Replace de todas as listas (apaga + recria, reindexando `order` pela posição).
    await Promise.all([
      tx.experience.deleteMany({ where: { profileId } }),
      tx.education.deleteMany({ where: { profileId } }),
      tx.skill.deleteMany({ where: { profileId } }),
      tx.project.deleteMany({ where: { profileId } }),
      tx.language.deleteMany({ where: { profileId } }),
      tx.course.deleteMany({ where: { profileId } }),
    ]);

    const base = { userId, profileId };

    if (bundle.experiences.length > 0) {
      await tx.experience.createMany({
        data: bundle.experiences.map((e, order) => ({
          ...base,
          company: e.company,
          role: e.role,
          location: e.location ?? null,
          startDate: e.startDate,
          endDate: e.endDate ?? null,
          current: e.current,
          bullets: JSON.stringify(e.bullets),
          order,
        })),
      });
    }

    if (bundle.educations.length > 0) {
      await tx.education.createMany({
        data: bundle.educations.map((e, order) => ({
          ...base,
          institution: e.institution,
          degree: e.degree,
          field: e.field ?? null,
          startDate: e.startDate,
          endDate: e.endDate ?? null,
          current: e.current,
          gpa: e.gpa ?? null,
          details: e.details ?? null,
          order,
        })),
      });
    }

    if (bundle.skills.length > 0) {
      await tx.skill.createMany({
        data: bundle.skills.map((s, order) => ({
          ...base,
          category: s.category,
          name: s.name,
          level: s.level ?? null,
          order,
        })),
      });
    }

    if (bundle.projects.length > 0) {
      await tx.project.createMany({
        data: bundle.projects.map((pr, order) => ({
          ...base,
          name: pr.name,
          description: pr.description,
          bullets: JSON.stringify(pr.bullets),
          techStack: JSON.stringify(pr.techStack),
          url: pr.url ?? null,
          order,
        })),
      });
    }

    if (bundle.languages.length > 0) {
      await tx.language.createMany({
        data: bundle.languages.map((l, order) => ({
          ...base,
          name: l.name,
          proficiency: l.proficiency,
          order,
        })),
      });
    }

    if (bundle.courses.length > 0) {
      await tx.course.createMany({
        data: bundle.courses.map((c, order) => ({
          ...base,
          title: c.title,
          issuer: c.issuer,
          date: c.date,
          url: c.url ?? null,
          order,
        })),
      });
    }
  });

  return getProfileBundle();
}
