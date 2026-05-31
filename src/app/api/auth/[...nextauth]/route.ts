// Handler do fluxo OAuth do Auth.js (ADR-0024). Reexporta os handlers da instância
// completa (Node). Esta rota é PÚBLICA (excluída do middleware) — é o próprio login.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
