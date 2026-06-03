// GET/PATCH/DELETE /api/resumes/[id] — gestão de currículos (ADR-0021/0022/0030).
//
//   GET            -> 200 + GeneratedResumeSchema  · 404 (inexistente/alheio) — ADR-0030
//   PATCH  { name?, isDefault?: true, contentJson? }
//                  -> 200 + GeneratedResumeSchema  · 400 (Zod) · 404 (id inexistente
//                       OU não pertence ao usuário — não vazamos a diferença)
//   DELETE         -> 204 (sem corpo)               · 404 (idem)
//
// `contentJson` (ADR-0030) é a edição MANUAL: re-renderiza o `.tex` pelo renderer puro
// (sem IA) e zera o traceabilityReport; o guardrail NÃO roda (edição do dono dos dados).
//
// Identidade via getCurrentUserId() no repositório (todas as ops restringem ao usuário
// atual). Envelope de erro padrão de @/lib/http. Next.js 15: `params` é Promise.

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GeneratedResumeSchema,
  ResumeContentSchema,
  type GeneratedResume,
} from "@/lib/schemas";
import {
  renameGeneratedResume,
  deleteGeneratedResume,
  setDefaultResume,
  getGeneratedResumeById,
  updateGeneratedResumeContent,
} from "@/server/data/resume-repo";
import { getProfileBundle } from "@/server/data/profile-repo";
import { renderResume } from "@/server/resume/render-latex";
import { errorResponse, validationErrorResponse } from "@/lib/http";

/**
 * Body do PATCH (ADR-0021 + ADR-0022 + ADR-0030): `name` (renomear), `isDefault: true`
 * (marcar padrão) e/ou `contentJson` (editar o conteúdo). Todos opcionais, mas é preciso
 * informar PELO MENOS UM. `name`, se vier, não pode ser vazio (trim+min). `isDefault` só
 * aceita `true`. `contentJson` é validado estruturalmente pelo `ResumeContentSchema` (o
 * guardrail de rastreabilidade NÃO roda — edição manual, ADR-0030).
 */
const PatchRequestSchema = z
  .object({
    name: z.string().trim().min(1, "name não pode ser vazio").optional(),
    isDefault: z.literal(true).optional(),
    contentJson: ResumeContentSchema.optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.isDefault === true || d.contentJson !== undefined,
    {
      message:
        "Informe 'name' (renomear), 'isDefault: true' (definir padrão) ou 'contentJson' (editar).",
    },
  );

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const resume = await getGeneratedResumeById(id);
    if (!resume) {
      return errorResponse(404, "NOT_FOUND", "Currículo não encontrado.");
    }
    return NextResponse.json(GeneratedResumeSchema.parse(resume));
  } catch (err) {
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Falha ao carregar o currículo.",
      process.env.NODE_ENV !== "production" ? String(err) : undefined,
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Corpo da requisição não é um JSON válido.");
  }

  const parsed = PatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  try {
    // Aplica as operações pedidas (uma ou ambas). Qualquer uma devolvendo `null` significa
    // id inexistente/alheio → 404 (não vazamos a diferença, coerente com o ADR-0021).
    let updated: GeneratedResume | null = null;

    if (parsed.data.name !== undefined) {
      updated = await renameGeneratedResume(id, parsed.data.name);
      if (!updated) {
        return errorResponse(404, "NOT_FOUND", "Currículo não encontrado.");
      }
    }

    if (parsed.data.isDefault === true) {
      updated = await setDefaultResume(id);
      if (!updated) {
        return errorResponse(404, "NOT_FOUND", "Currículo não encontrado.");
      }
    }

    // Edição manual do conteúdo (ADR-0030): re-renderiza o `.tex` pelo renderer puro a
    // partir do conteúdo editado. O cabeçalho (\name/\address) vem do Profile (/perfil),
    // não do contentJson. SEM guardrail: é o dono dos dados editando, não a IA.
    if (parsed.data.contentJson !== undefined) {
      const { profile } = await getProfileBundle();
      const texOutput = renderResume(parsed.data.contentJson, profile);
      updated = await updateGeneratedResumeContent(id, parsed.data.contentJson, texOutput);
      if (!updated) {
        return errorResponse(404, "NOT_FOUND", "Currículo não encontrado.");
      }
    }

    return NextResponse.json(GeneratedResumeSchema.parse(updated));
  } catch (err) {
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Falha ao atualizar o currículo.",
      process.env.NODE_ENV !== "production" ? String(err) : undefined,
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const deleted = await deleteGeneratedResume(id);
    if (!deleted) {
      return errorResponse(404, "NOT_FOUND", "Currículo não encontrado.");
    }
    // 204 sem corpo (idiomático para exclusão; o cliente recarrega a lista).
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Falha ao excluir o currículo.",
      process.env.NODE_ENV !== "production" ? String(err) : undefined,
    );
  }
}
