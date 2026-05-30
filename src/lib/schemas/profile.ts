// Schemas Zod da base de dados (a "base" = fonte da verdade do usuário).
// Campos seguem docs/erd.md e prisma/schema.prisma. Toda entidade de domínio
// carrega `userId` (seam de migração multiusuário — ver ARCHITECTURE.md).
//
// Convenções:
// - `id`/`userId`/`profileId` são opcionais na entrada (gerados pelo banco no create),
//   mas presentes na saída. Para o MVP usamos um schema único com esses campos opcionais.
// - Campos string opcionais usam `.optional()` (casam com `String?` do Prisma).
// - `order` é inteiro >= 0; default 0 para casar com o Prisma.

import { z } from "zod";

/** Item de experiência profissional na base. */
export const ExperienceSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  profileId: z.string().optional(),
  company: z.string().min(1),
  role: z.string().min(1),
  location: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  current: z.boolean().default(false),
  bullets: z.array(z.string()).default([]),
  order: z.number().int().min(0).default(0),
});
export type Experience = z.infer<typeof ExperienceSchema>;

/** Item de formação acadêmica na base. */
export const EducationSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  profileId: z.string().optional(),
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  current: z.boolean().default(false),
  gpa: z.string().optional(),
  details: z.string().optional(),
  order: z.number().int().min(0).default(0),
});
export type Education = z.infer<typeof EducationSchema>;

/** Habilidade/competência na base, agrupada por `category`. */
export const SkillSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  profileId: z.string().optional(),
  category: z.string().min(1),
  name: z.string().min(1),
  level: z.string().optional(),
  order: z.number().int().min(0).default(0),
});
export type Skill = z.infer<typeof SkillSchema>;

/** Projeto na base. */
export const ProjectSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  profileId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  bullets: z.array(z.string()).default([]),
  techStack: z.array(z.string()).default([]),
  url: z.string().optional(),
  order: z.number().int().min(0).default(0),
});
export type Project = z.infer<typeof ProjectSchema>;

/** Idioma na base. */
export const LanguageSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  profileId: z.string().optional(),
  name: z.string().min(1),
  proficiency: z.string().min(1),
  order: z.number().int().min(0).default(0),
});
export type Language = z.infer<typeof LanguageSchema>;

/** Curso/certificação na base. */
export const CourseSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  profileId: z.string().optional(),
  title: z.string().min(1),
  issuer: z.string().min(1),
  date: z.string().min(1),
  url: z.string().optional(),
  order: z.number().int().min(0).default(0),
});
export type Course = z.infer<typeof CourseSchema>;

/**
 * Cabeçalho + resumo do currículo. Campos de contato opcionais casam com o
 * Prisma (`String?`); apenas `fullName` é obrigatório.
 */
export const ProfileSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  location: z.string().optional(),
  email: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  website: z.string().optional(),
  summary: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/**
 * Base de dados completa serializada: o `Profile` + todas as listas de itens.
 * É o input do LLM (a fonte da verdade) e o payload de GET/PUT `/api/profile`.
 */
export const ProfileBundleSchema = z.object({
  profile: ProfileSchema,
  experiences: z.array(ExperienceSchema).default([]),
  educations: z.array(EducationSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
  courses: z.array(CourseSchema).default([]),
});
export type ProfileBundle = z.infer<typeof ProfileBundleSchema>;
