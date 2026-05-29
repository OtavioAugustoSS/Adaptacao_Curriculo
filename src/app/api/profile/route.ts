// Rotas da base de dados pessoal (contrato §2):
//   GET  /api/profile -> ProfileBundleSchema  (lê a base completa do usuário atual)
//   PUT  /api/profile <- ProfileBundleSchema -> ProfileBundleSchema  (upsert)
//
// Identidade via getCurrentUserId() no repositório — sem userId no request.
// Nesta US (US-02) o PUT persiste o cabeçalho/Profile; as listas da base entram
// na US-03 estendendo o mesmo handler.

import { NextResponse, type NextRequest } from "next/server";
import { ProfileBundleSchema } from "@/lib/schemas";
import { getProfileBundle, saveProfileBundle } from "@/server/data/profile-repo";
import { errorResponse, validationErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    const bundle = await getProfileBundle();
    return NextResponse.json(bundle);
  } catch (err) {
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Falha ao ler a base de dados.",
      process.env.NODE_ENV !== "production" ? String(err) : undefined,
    );
  }
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Corpo da requisição não é um JSON válido.");
  }

  const parsed = ProfileBundleSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  try {
    const bundle = await saveProfileBundle(parsed.data);
    return NextResponse.json(bundle);
  } catch (err) {
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Falha ao salvar a base de dados.",
      process.env.NODE_ENV !== "production" ? String(err) : undefined,
    );
  }
}
