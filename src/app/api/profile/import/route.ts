// POST /api/profile/import — import de perfil por dump (US-11, ADR-0018).
//
// Recebe um texto livre do usuário ({ rawText }), pede à IA que o ESTRUTURE num
// rascunho de ProfileBundle e devolve esse rascunho — para o formulário do /perfil
// MESCLAR e o usuário revisar/salvar. NÃO PERSISTE: quem salva é o PUT /api/profile
// existente, após a revisão humana (a barreira anti-invenção deste fluxo, ADR-0018 §4).
//
// Fluxo:
//   1. Corpo JSON -> 400 INVALID_JSON se não parsear.
//   2. Valida { rawText } (ProfileImportRequestSchema) -> 400 VALIDATION_ERROR (Zod).
//   3. extract-profile: rawText -> LLMProvider.extractProfileFromDump -> rascunho
//      ProfileBundle (validado no adapter em variante TOLERANTE — fullName pode vir "").
//   4. 200 com o rascunho. NÃO chama nenhum repo de escrita.
// Erros do LLM (LLMError) -> 502; inesperado -> 500. Envelope padrão do contrato.

import { NextResponse, type NextRequest } from "next/server";
import { ProfileImportRequestSchema } from "@/lib/schemas";
import { errorResponse, validationErrorResponse } from "@/lib/http";
import { extractProfileFromDump } from "@/server/profile/extract-profile";
import { getLLMProvider } from "@/server/llm";
import { LLMError } from "@/server/llm/provider";
import { resolveModel } from "@/server/llm/models";

export async function POST(req: NextRequest) {
  // 1. Corpo JSON.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Corpo da requisição não é um JSON válido.");
  }

  // 2. Validação do contrato ({ rawText } não-vazio).
  const parsed = ProfileImportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  try {
    // 3. Extração via LLM (rascunho NÃO persistido). Resolve o modelo uma vez.
    const modelId = resolveModel().id;
    const provider = getLLMProvider();
    const bundle = await extractProfileFromDump(parsed.data.rawText, provider, modelId);

    // 4. Devolve o rascunho para o formulário mesclar/revisar.
    return NextResponse.json(bundle);
  } catch (err) {
    // Observabilidade: logamos a causa real (kind + cause do LLMError) no servidor —
    // a UI só mostra a mensagem amigável.
    console.error(
      "[/api/profile/import] falha:",
      err instanceof LLMError ? `LLMError(${err.kind})` : err,
      err instanceof LLMError ? err.cause : undefined,
    );
    // Falha da camada de IA (transporte ou validação da saída) -> 502 (ADR-0012/0018).
    if (err instanceof LLMError) {
      return errorResponse(
        502,
        "LLM_ERROR",
        "Falha ao interpretar o texto com o provedor de IA. Tente novamente.",
        process.env.NODE_ENV !== "production" ? String(err.cause ?? err) : undefined,
      );
    }
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Falha ao importar o perfil.",
      process.env.NODE_ENV !== "production" ? String(err) : undefined,
    );
  }
}
