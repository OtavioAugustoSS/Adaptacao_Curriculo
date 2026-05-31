// Health check (ADR-0028): PÚBLICO (fora do middleware de auth, via matcher). Para o health
// check do host (Render) e um ping anti-spin-down opcional. Não toca o banco nem a IA —
// resposta instantânea e barata, sem custo/latência.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
