// GET /api/resumes/[id]/download — serve o `.tex` cacheado (US-06, contrato §2).
//
// Devolve o `texOutput` já renderizado (sem nova chamada ao LLM — cache do ERD §4)
// como `text/plain` com `Content-Disposition: attachment`, para o usuário levar ao
// Overleaf. 404 se o currículo não existir ou não pertencer ao usuário atual.
//
// Next.js 15: em route handler dinâmico, `params` é uma Promise e precisa de await.

import { getGeneratedResumeById } from "@/server/data/resume-repo";
import { getProfileBundle } from "@/server/data/profile-repo";
import { buildTexFilename } from "@/server/resume/filename";
import { errorResponse } from "@/lib/http";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // getGeneratedResumeById já restringe ao usuário atual (getCurrentUserId): null
  // cobre tanto "não existe" quanto "não é do usuário" — ambos viram 404 (não
  // vazamos a diferença, coerente com o contrato §2).
  const resume = await getGeneratedResumeById(id);
  if (!resume) {
    return errorResponse(404, "NOT_FOUND", "Currículo não encontrado.");
  }

  // Nome do arquivo a partir do nome real do usuário + a data de geração (ADR-0014).
  const { profile } = await getProfileBundle();
  const filename = buildTexFilename(profile.fullName, resume.createdAt, resume.id);

  return new Response(resume.texOutput, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
