// POST /api/profile/import/file — import de perfil por ARQUIVO (US-13, ADR-0019).
//
// Irmã da /api/profile/import (texto): em vez de { rawText } JSON, recebe um
// multipart/form-data com o campo `file` (PDF/DOCX/TXT). O servidor extrai o TEXTO do
// arquivo (extract-text, fronteira única) e o alimenta no MESMO pipeline da Fatia 5
// (extractProfileFromDump) — devolvendo o mesmo rascunho de ProfileBundle para o
// formulário do /perfil MESCLAR e o usuário revisar/salvar. NÃO PERSISTE: quem salva é o
// PUT /api/profile, após a revisão humana (barreira anti-invenção, ADR-0018/0019 §6).
//
// runtime "nodejs": a extração usa APIs de Node (Buffer/streams das libs de parsing) e
// não roda no edge runtime (ADR-0019 §1).
//
// Validação SEM Zod no corpo (é binário, ADR-0019 §3): whitelist de tipo + limite de
// tamanho (fonte única em @/lib/import-file). Mapa de status (ADR-0019 §3):
//   sem `file` -> 400 INVALID_REQUEST · tipo fora da whitelist -> 415 UNSUPPORTED_MEDIA_TYPE
//   acima do limite -> 413 PAYLOAD_TOO_LARGE · texto extraído vazio (PDF imagem) -> 422
//   EMPTY_EXTRACTION · LLMError -> 502 LLM_ERROR · inesperado -> 500 INTERNAL_ERROR.

import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { getCurrentUserId } from "@/server/auth/getCurrentUserId";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  isAcceptedImportFile,
  MAX_IMPORT_FILE_BYTES,
} from "@/lib/import-file";
import { extractTextFromFile, UnsupportedFileTypeError } from "@/server/profile/extract-text";
import { extractProfileFromDump } from "@/server/profile/extract-profile";
import { getLLMProvider } from "@/server/llm";
import { LLMError } from "@/server/llm/provider";
import { resolveModel } from "@/server/llm/models";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Rate limit por usuário (ADR-0028): mesmo bucket "import" do texto. Protege cota/custo/carga da NIM.
  let rlUserId: string;
  try {
    rlUserId = await getCurrentUserId();
  } catch {
    return errorResponse(401, "UNAUTHENTICATED", "Não autenticado.");
  }
  const rl = checkRateLimit(`import:${rlUserId}`, 10, 5 * 60_000);
  if (!rl.ok) {
    return errorResponse(
      429,
      "TOO_MANY_REQUESTS",
      `Muitas importações em pouco tempo. Tente novamente em ~${rl.retryAfterSec}s.`,
    );
  }

  // 1. Lê o multipart e pega o campo `file`.
  let file: File;
  try {
    const form = await req.formData();
    const field = form.get("file");
    if (!(field instanceof File)) {
      return errorResponse(400, "INVALID_REQUEST", "Envie um arquivo no campo \"file\".");
    }
    file = field;
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "Requisição multipart inválida.");
  }

  // 2. Valida tamanho (antes de ler os bytes em memória) e tipo (MIME ou extensão).
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return errorResponse(413, "PAYLOAD_TOO_LARGE", "Arquivo muito grande (limite de 8 MB).");
  }
  if (!isAcceptedImportFile(file.name, file.type)) {
    return errorResponse(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Tipo de arquivo não suportado. Envie um PDF, DOCX ou TXT.",
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Defesa extra: `file.size` pode mentir; confere o tamanho real lido.
  if (bytes.length > MAX_IMPORT_FILE_BYTES) {
    return errorResponse(413, "PAYLOAD_TOO_LARGE", "Arquivo muito grande (limite de 8 MB).");
  }

  try {
    // 3. Arquivo -> texto (fronteira única). Sem camada de texto (PDF imagem) -> vazio.
    const text = await extractTextFromFile({
      bytes,
      mimeType: file.type,
      fileName: file.name,
    });

    if (text.trim().length === 0) {
      return errorResponse(
        422,
        "EMPTY_EXTRACTION",
        "Não foi possível extrair texto do arquivo — pode ser um PDF digitalizado/imagem. " +
          "Cole o texto manualmente.",
      );
    }

    // 4. Mesmo pipeline da Fatia 5: texto -> rascunho NÃO persistido. Resolve o modelo 1x.
    const modelId = resolveModel().id;
    const provider = getLLMProvider();
    const bundle = await extractProfileFromDump(text, provider, modelId);

    // 5. Devolve o rascunho para o formulário mesclar/revisar.
    return NextResponse.json(bundle);
  } catch (err) {
    // Observabilidade: o 502/500 some na UI (mensagem amigável); logamos a causa real
    // (kind + cause do LLMError, ou o erro cru) no servidor para diagnóstico.
    console.error(
      "[/api/profile/import/file] falha:",
      err instanceof LLMError ? `LLMError(${err.kind})` : err,
      err instanceof LLMError ? err.cause : undefined,
    );
    // Tipo fora da whitelist (defesa redundante à checagem acima) -> 415.
    if (err instanceof UnsupportedFileTypeError) {
      return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", err.message);
    }
    // Falha da camada de IA (transporte ou validação da saída) -> 502 (ADR-0012/0018).
    if (err instanceof LLMError) {
      return errorResponse(
        502,
        "LLM_ERROR",
        "Falha ao interpretar o arquivo com o provedor de IA. Tente novamente.",
        process.env.NODE_ENV !== "production" ? String(err.cause ?? err) : undefined,
      );
    }
    // Arquivo corrompido/ilegível pela lib de parsing, ou erro inesperado -> 500.
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Falha ao importar o arquivo.",
      process.env.NODE_ENV !== "production" ? String(err) : undefined,
    );
  }
}
