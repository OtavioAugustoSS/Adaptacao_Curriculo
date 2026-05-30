// GET /api/resumes — histórico de currículos gerados do usuário atual (US-09).
//
// Devolve `GeneratedResumeSchema[]` do mais recente ao mais antigo (contrato §2),
// sem paginação no MVP e SEM join com JobPosting (ADR-0016 — o histórico não exibe
// o título da vaga; isso exigiria denormalizar o contrato congelado). Identidade via
// getCurrentUserId() no repositório — sem userId no request.

import { NextResponse } from "next/server";
import { listGeneratedResumes } from "@/server/data/resume-repo";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    const resumes = await listGeneratedResumes();
    return NextResponse.json(resumes);
  } catch (err) {
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Falha ao listar os currículos.",
      process.env.NODE_ENV !== "production" ? String(err) : undefined,
    );
  }
}
