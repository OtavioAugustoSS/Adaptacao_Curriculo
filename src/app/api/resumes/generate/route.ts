// POST /api/resumes/generate — gera um currículo (contrato §2).
//
// Esta rota implementa o Modo 1 (mode=STANDARD) e o Modo 2 (mode=JOB_ADAPTIVE,
// US-08). Fluxo (spec §3):
//   1. Valida o request (GenerateRequestSchema) -> 400 se inválido (no Modo 2 o
//      refine já exige `jobText` não-vazio).
//   2. Resolve usuário + carrega a base; valida pré-requisito (ADR-0014/0016: o
//      mesmo nos dois modos) -> 422 PREREQUISITE_NOT_MET (sem chamar o LLM).
//   2b. Modo 2: persiste o JobPosting a partir do `jobText` (ADR-0016).
//   3. select-content: base (+ vaga no Modo 2) -> LLMProvider -> ResumeContent validado.
//   4. GUARDRAIL (US-07, ADR-0015): validateTraceability(content, base) — reutilizado
//      sem mudança nos dois modos. errors -> regenera 1x; persistindo -> 422
//      GUARDRAIL_FAILED (não persiste).
//   5. render-latex: ResumeContent (+ header do Profile) -> .tex.
//   6. Persiste GeneratedResume (mode + jobPostingId no Modo 2 + traceabilityReport real).
// Erros do LLM (LLMError) -> 502.

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
import { createJobPosting } from "@/server/data/job-repo";
import {
  meetsGenerationPrerequisite,
  PREREQUISITE_MESSAGE,
} from "@/server/resume/prerequisite";
import {
  generateStandardContent,
  generateJobAdaptiveContent,
} from "@/server/resume/select-content";
import { validateTraceability } from "@/server/resume/validate-traceability";
import { renderResume } from "@/server/resume/render-latex";
import { getLLMProvider } from "@/server/llm";
import { LLMError } from "@/server/llm/provider";
import { resolveModel } from "@/server/llm/models";

// Máximo de tentativas TOTAIS (1 geração + 1 regeneração) — ADR-0015.
const MAX_ATTEMPTS = 2;

/**
 * Roda o guardrail sobre uma função geradora de conteúdo, regenerando em caso de
 * erro forte até o limite do ADR-0015. Recebe o GERADOR (Modo 1 ou Modo 2) já
 * fechado sobre seus insumos (base / base+vaga), de modo que a lógica do guardrail
 * é única — não duplicada por modo. O guardrail confere o conteúdo contra a `bundle`
 * (base): independe do modo (ADR-0016).
 *
 * Devolve o conteúdo aprovado + seu relatório (só warnings), ou o último relatório
 * com erros (para o handler responder 422 sem persistir).
 */
async function generateWithGuardrail(
  bundle: ProfileBundle,
  generate: () => Promise<ResumeContent>,
): Promise<
  | { ok: true; content: ResumeContent; report: TraceabilityReport }
  | { ok: false; report: TraceabilityReport }
> {
  let lastReport: TraceabilityReport = { errors: [], warnings: [] };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const content = await generate();
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
  const { mode, name } = parsed.data;

  try {
    // 2. Base + pré-requisito (ADR-0014/0016: o mesmo nos dois modos). Bem-formado
    //    mas base insuficiente -> 422 (sem chamar o LLM, sem criar JobPosting).
    const bundle = await getProfileBundle();
    if (!meetsGenerationPrerequisite(bundle)) {
      return errorResponse(422, "PREREQUISITE_NOT_MET", PREREQUISITE_MESSAGE);
    }

    // Resolve o modelo UMA vez: o mesmo id vai ao provider e é persistido (consistência).
    const modelId = resolveModel().id;
    const provider = getLLMProvider();

    // 2b. Modo 2 (ADR-0016): persiste a vaga (rawText) e monta o gerador adaptativo.
    //     O refine do schema já garante jobText não-vazio aqui; o `??""` é só para o
    //     tipo. O guardrail é o mesmo dos dois modos — só muda a função geradora.
    let jobPostingId: string | null = null;
    let generate: () => Promise<ResumeContent>;
    if (mode === "JOB_ADAPTIVE") {
      const jobText = parsed.data.jobText ?? "";
      const jobPosting = await createJobPosting({ rawText: jobText });
      jobPostingId = jobPosting.id ?? null;

      // ADR-0027: pipeline de 2 passos (análise da vaga → adaptação), encapsulado em
      // generateJobAdaptiveContent. NÃO se injeta mais o currículo-referência (ADR-0022),
      // que causava o copy-paste; o anti-encolhimento virou regra sobre a base. O campo
      // `baseResumeId` do contrato segue aceito, mas deixou de ser usado como gabarito.
      generate = () =>
        generateJobAdaptiveContent(bundle, jobText, provider, modelId);
    } else {
      generate = () => generateStandardContent(bundle, provider, modelId);
    }

    // 3-4. Conteúdo via LLM + guardrail de rastreabilidade (regenera 1x em erro forte).
    const result = await generateWithGuardrail(bundle, generate);

    // Erro forte persistente após a regeneração -> 422, com o relatório em details.
    // Geração que falha o guardrail NÃO é persistida (ADR-0015). No Modo 2 o
    // JobPosting já foi salvo — é o insumo da tentativa, não um currículo gerado.
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
    //    No Modo 2 grava o jobPostingId (ADR-0016).
    const saved = await createGeneratedResume({
      mode,
      name, // ausente/vazio → default no repo (rótulo do modo + data; ADR-0021)
      jobPostingId,
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
