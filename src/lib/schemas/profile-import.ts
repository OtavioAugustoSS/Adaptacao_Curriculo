// Schemas do import de perfil por dump (US-11, ADR-0018).
//
// Fluxo NOVO e SEPARADO da geração de currículo: o usuário cola um texto livre
// (currículo antigo, perfil do LinkedIn, anotações) e a IA ESTRUTURA isso num
// rascunho de `ProfileBundle` para ele revisar e salvar. EXTRAÇÃO ≠ GERAÇÃO — não
// há base de referência aqui, então o guardrail de rastreabilidade NÃO se aplica
// (ADR-0018 §4). A proteção é prompt restritivo + revisão humana antes de persistir.

import { z } from "zod";
import { ProfileSchema, ProfileBundleSchema } from "./profile";

/**
 * Request do `POST /api/profile/import`: o texto livre colado pelo usuário.
 * Só exigimos conteúdo (`min(1)`); o resto é trabalho da IA.
 */
export const ProfileImportRequestSchema = z.object({
  rawText: z.string().min(1),
});
export type ProfileImportRequest = z.infer<typeof ProfileImportRequestSchema>;

/**
 * Variante TOLERANTE do bundle, usada SÓ para validar o RASCUNHO do import no
 * adapter (ADR-0018 §5). Diferença do `ProfileBundleSchema`: o `profile.fullName`
 * pode vir VAZIO/ausente — um dump sem nome (lista de skills, anotações soltas) é
 * uma extração legítima e NÃO deve gerar 502 espúrio. A obrigatoriedade do nome
 * permanece onde importa: no `PUT /api/profile`, que segue validando o bundle
 * ESTRITO antes de persistir. O usuário preenche o nome na revisão.
 */
export const ImportProfileBundleSchema = ProfileBundleSchema.extend({
  profile: ProfileSchema.extend({ fullName: z.string().default("") }),
});
export type ImportProfileBundle = z.infer<typeof ImportProfileBundleSchema>;
