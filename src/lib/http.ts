// Helpers de resposta HTTP das rotas. Envelope de erro padronizado do contrato
// (docs/api-contract.md §2): { error: { code, message, details? } }.

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Resposta de erro no envelope do contrato, com o status HTTP indicado. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ErrorEnvelope> {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status },
  );
}

/** 400 de validação Zod: expõe os issues em `details` (ADR-0011 / contrato §2). */
export function validationErrorResponse(error: ZodError): NextResponse<ErrorEnvelope> {
  return errorResponse(
    400,
    "VALIDATION_ERROR",
    "Dados inválidos. Verifique os campos destacados.",
    error.issues,
  );
}
