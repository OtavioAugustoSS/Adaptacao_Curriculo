// Schemas do import de perfil por dump/arquivo (US-11/US-13, ADR-0018/0019).
//
// Fluxo NOVO e SEPARADO da geração de currículo: o usuário cola um texto livre OU
// envia um arquivo (currículo antigo, LinkedIn, anotações) e a IA ESTRUTURA isso num
// RASCUNHO de `ProfileBundle` para ele revisar e salvar. EXTRAÇÃO ≠ GERAÇÃO — não há
// base de referência aqui, então o guardrail de rastreabilidade NÃO se aplica
// (ADR-0018 §4). A proteção é prompt restritivo + revisão humana antes de persistir.
//
// IMPORTANTE — por que o RASCUNHO usa um schema TOLERANTE (não o estrito):
// o prompt manda a IA "deixar VAZIO o que não aparecer no texto" (ADR-0018/0019). Um
// currículo real quase sempre tem itens incompletos — idioma sem nível, formação só com
// ano de fim, projeto sem descrição, curso sem data. Sob o `ProfileBundleSchema` ESTRITO
// (vários campos `.min(1)`), QUALQUER item incompleto faria o `safeParse` rejeitar o
// bundle INTEIRO -> `LLMError("validation")` -> 502 (bug observado no 1º upload real).
// Por isso o rascunho valida com campos de texto TOLERANTES (ausente/"" vira ""): o
// rascunho nunca falha por estar incompleto; o usuário completa na revisão e a
// obrigatoriedade real é cobrada no `PUT /api/profile` (ESTRITO), antes de persistir.

import { z } from "zod";
import {
  ProfileSchema,
  ExperienceSchema,
  EducationSchema,
  SkillSchema,
  ProjectSchema,
  LanguageSchema,
  CourseSchema,
} from "./profile";

/**
 * Request do `POST /api/profile/import`: o texto livre colado pelo usuário.
 * Só exigimos conteúdo (`min(1)`); o resto é trabalho da IA.
 */
export const ProfileImportRequestSchema = z.object({
  rawText: z.string().min(1),
});
export type ProfileImportRequest = z.infer<typeof ProfileImportRequestSchema>;

/**
 * Campo de texto TOLERANTE do rascunho: ausente/`undefined` vira `""`. Substitui os
 * `.min(1)` dos schemas estritos SÓ no rascunho do import — para que um item incompleto
 * (extração legítima de "deixe vazio o que não aparecer") não derrube o bundle inteiro.
 * A obrigatoriedade real permanece no `PUT /api/profile` (schema estrito).
 */
const draftString = z.string().default("");

// Variantes de RASCUNHO das listas: herdam o item estrito e relaxam SÓ os campos de
// texto antes obrigatórios (`.min(1)`) para `draftString`. Os demais campos (opcionais,
// `current`/`order`/`bullets`/`techStack` com default) permanecem como no estrito.
const ImportProfileSchema = ProfileSchema.extend({ fullName: draftString });
const ImportExperienceSchema = ExperienceSchema.extend({
  company: draftString,
  role: draftString,
  startDate: draftString,
});
const ImportEducationSchema = EducationSchema.extend({
  institution: draftString,
  degree: draftString,
  startDate: draftString,
});
const ImportSkillSchema = SkillSchema.extend({
  category: draftString,
  name: draftString,
});
const ImportProjectSchema = ProjectSchema.extend({
  name: draftString,
  description: draftString,
});
const ImportLanguageSchema = LanguageSchema.extend({
  name: draftString,
  proficiency: draftString,
});
const ImportCourseSchema = CourseSchema.extend({
  title: draftString,
  issuer: draftString,
  date: draftString,
});

/**
 * Variante TOLERANTE do bundle, usada SÓ para validar o RASCUNHO do import no adapter
 * (ADR-0018 §5). Difere do `ProfileBundleSchema` por aceitar campos de texto vazios em
 * todos os itens (e no `fullName`) — um currículo real raramente vem 100% completo, e o
 * rascunho é para REVISÃO, não para persistir. A barreira de completude fica no
 * `PUT /api/profile` (estrito). Estruturalmente continua um `ProfileBundle`.
 */
export const ImportProfileBundleSchema = z.object({
  profile: ImportProfileSchema,
  experiences: z.array(ImportExperienceSchema).default([]),
  educations: z.array(ImportEducationSchema).default([]),
  skills: z.array(ImportSkillSchema).default([]),
  projects: z.array(ImportProjectSchema).default([]),
  languages: z.array(ImportLanguageSchema).default([]),
  courses: z.array(ImportCourseSchema).default([]),
});
export type ImportProfileBundle = z.infer<typeof ImportProfileBundleSchema>;
