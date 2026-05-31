// PATCH/DELETE /api/resumes/[id] — gestão de currículos (ADR-0021, Fatia 7 / WS4).
//
//   PATCH  { name } -> 200 + GeneratedResumeSchema  · 400 (Zod) · 404 (id inexistente
//                       OU não pertence ao usuário — não vazamos a diferença)
//   DELETE         -> 204 (sem corpo)               · 404 (idem)
//
// Identidade via getCurrentUserId() no repositório (rename/delete já restringem ao
// usuário atual). Envelope de erro padrão de @/lib/http. Next.js 15: `params` é Promise.

import { NextResponse } from "next/server";
import { z } from "zod";
import { GeneratedResumeSchema } from "@/lib/schemas";
import {
  renameGeneratedResume,
  deleteGeneratedResume,
} from "@/server/data/resume-repo";
import { errorResponse, validationErrorResponse } from "@/lib/http";

/** Body do PATCH: `name` obrigatório e não-vazio (após trim). */
const RenameRequestSchema = z.object({
  name: z.string().trim().min(1, "name é obrigatório"),
});

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

  const parsed = RenameRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  try {
    const updated = await renameGeneratedResume(id, parsed.data.name);
    if (!updated) {
      return errorResponse(404, "NOT_FOUND", "Currículo não encontrado.");
    }
    return NextResponse.json(GeneratedResumeSchema.parse(updated));
  } catch (err) {
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Falha ao renomear o currículo.",
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
