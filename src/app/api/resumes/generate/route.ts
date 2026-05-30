// POST /api/resumes/generate — gera um currículo (contrato §2).
//
// Esta rota implementa o Modo 1 (mode=STANDARD). Fluxo (spec §3):
//   1. Valida o request (GenerateRequestSchema) -> 400 se inválido.
//   2. Resolve usuário + carrega a base; valida pré-requisito (ADR-0014)
//      -> 422 PREREQUISITE_NOT_MET (sem chamar o LLM).
//   3. select-content: base -> LLMProvider -> ResumeContent validado.
//   4. GUARDRAIL (US-07, ADR-0015): validateTraceability(content, base).
//      errors -> regenera 1x; persistindo -> 422 GUARDRAIL_FAILED (não persiste).
//   5. render-latex: ResumeContent (+ header do Profile) -> .tex.
//   6. Persiste GeneratedResume (mode=STANDARD, traceabilityReport = relatório real).
// Erros do LLM (LLMError) -> 502. Modo 2 (JOB_ADAPTIVE) fica para a US-08.

import { NextResponse, type NextRequest } from "next/server";
import {
  GenerateRequestSchema,
  GeneratedResumeSchema,
  type ResumeContent,
  type ProfileBundle,
  type TraceabilityReport,
} from "@/lib/schemas";
import { errorResponse, validationErrorResponse } from "@/lib/http";
import { getProfileBundle } from "@/server/data/profile-repo";
import { createGeneratedResume } from "@/server/data/resume-repo";
import {
  meetsGenerationPrerequisite,
  PREREQUISITE_MESSAGE,
} from "@/server/resume/prerequisite";
import { generateStandardContent } from "@/server/resume/select-content";
import { validateTraceability } from "@/server/resume/validate-traceability";
import { renderResume } from "@/server/resume/render-latex";
import { getLLMProvider, type LLMProvider } from "@/server/llm";
import { LLMError } from "@/server/llm/provider";
import { resolveModel } from "@/server/llm/models";

// Máximo de tentativas TOTAIS (1 geração + 1 regeneração) — ADR-0015.
const MAX_ATTEMPTS = 2;

/**
 * Gera o conteúdo e roda o guardrail, regenerando em caso de erro forte até o
 * limite do ADR-0015. Devolve o conteúdo aprovado + seu relatório (só warnings),
 * ou o último relatório com erros (para o handler responder 422 sem persistir).
 */
async function generateWithGuardrail(
  bundle: ProfileBundle,
  provider: LLMProvider,
  modelId: string,
): Promise<
  | { ok: true; content: ResumeContent; report: TraceabilityReport }
  | { ok: false; report: TraceabilityReport }
> {
  let lastReport: TraceabilityReport = { errors: [], warnings: [] };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const content = await generateStandardContent(bundle, provider, modelId);
    const report = validateTraceability(content, bundle);
    if (report.errors.length === 0) {
      return { ok: true, content, report };
    }
    lastReport = report; // erro forte: tenta de novo (até o limite)
  }

  return { ok: false, report: lastReport };
}

export async function POST(req: NextRequest) {
  // 1. Corpo JSON + validação do contrato.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Corpo da requisição não é um JSON válido.");
  }

  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  // Modo 2 (adaptativo à vaga) é da US-08; ainda não implementado. O request é
  // bem-formado (passa no Zod), mas o modo não pode ser processado nesta fatia ->
  // 422 (semântica de Unprocessable, alinhada ao uso de 422 no contrato §2).
  if (parsed.data.mode === "JOB_ADAPTIVE") {
    return errorResponse(
      422,
      "MODE_NOT_IMPLEMENTED",
      "O modo adaptativo à vaga ainda não está disponível.",
    );
  }

  try {
    // 2. Base + pré-requisito (ADR-0014). Bem-formado mas base insuficiente -> 422.
    const bundle = await getProfileBundle();
    if (!meetsGenerationPrerequisite(bundle)) {
      return errorResponse(422, "PREREQUISITE_NOT_MET", PREREQUISITE_MESSAGE);
    }

    // Resolve o modelo UMA vez: o mesmo id vai ao provider e é persistido (consistência).
    const modelId = resolveModel().id;

    // 3-4. Conteúdo via LLM + guardrail de rastreabilidade (regenera 1x em erro forte).
    const provider = getLLMProvider();
    const result = await generateWithGuardrail(bundle, provider, modelId);

    // Erro forte persistente após a regeneração -> 422, com o relatório em details.
    // Geração que falha o guardrail NÃO é persistida (ADR-0015).
    if (!result.ok) {
      return errorResponse(
        422,
        "GUARDRAIL_FAILED",
        "A geração incluiu itens fora da sua base e não pôde ser validada. Tente novamente.",
        result.report,
      );
    }

    // 5. Render determinístico -> .tex (header verbatim do Profile; contrato §3).
    const texOutput = renderResume(result.content, bundle.profile);

    // 6. Persiste com o relatório real (warnings exibidos no preview; ADR-0015).
    const saved = await createGeneratedResume({
      mode: "STANDARD",
      modelId,
      content: result.content,
      texOutput,
      traceabilityReport: result.report,
    });

    return NextResponse.json(GeneratedResumeSchema.parse(saved));
  } catch (err) {
    // Falha da camada de IA (transporte ou validação da saída) -> 502 (ADR-0012).
    if (err instanceof LLMError) {
      return errorResponse(
        502,
        "LLM_ERROR",
        "Falha ao gerar o currículo com o provedor de IA. Tente novamente.",
        process.env.NODE_ENV !== "production" ? String(err.cause ?? err) : undefined,
      );
    }
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Falha ao gerar o currículo.",
      process.env.NODE_ENV !== "production" ? String(err) : undefined,
    );
  }
}
