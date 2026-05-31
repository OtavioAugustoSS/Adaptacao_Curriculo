# Relatório de release — Fatia 11 · Endurecimento de produção + deploy (Render + Neon)

> Documento **committável**. Continuação de `docs/release/fatia-10.md`. Atualizado: 2026-05-31.
> Objetivo: hospedar para **teste fechado (<20 pessoas)** — sem erro, seguro, sem pesar o servidor,
> cada um vê só os próprios currículos. ADR-first: **ADR-0028**. Guia prático: **`DEPLOY.md`**.

## Estado atual
- ✅ **Fatia 11 implementada.** App pronto para deploy num host persistente.
- **Verificado:** `tsc --noEmit` limpo · `npm test` **342/342** (32 arquivos; +3 do rate-limit) ·
  `npm run build` OK (14 rotas, inclui `/api/health`).

## Decisões (ADR-0028)
- **Host persistente (Render free), não serverless** — a geração de ~80-150s roda **sem o limite de
  timeout** do serverless (a maior fonte potencial de erro some). Banco: **Neon free** (não expira).
- **Geração síncrona** (sem fila) para <20 — YAGNI; async fica para quando escalar.

## O que mudou (código)
| Área | Entrega |
|------|---------|
| **Pooling Postgres** | `schema.prisma`: `directUrl = env("DIRECT_URL")` — app usa a URL **pooled** (PgBouncer/Neon); migrações usam a **direct**. Evita esgotar conexões ("pesar o servidor"). |
| **Build/migração** | `package.json`: `postinstall: prisma generate`. Deploy roda `prisma migrate deploy` (no Build Command do Render). |
| **Rate limit por usuário** | `src/lib/rate-limit.ts` (janela deslizante em memória; 1 instância persistente). Aplicado em `generate` (5/5min) e `import` texto+arquivo (10/5min) → **429** no envelope padrão. Protege cota/custo/carga da NIM (chave compartilhada). |
| **Segurança** | `next.config.ts`: headers (HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`). `auth.config.ts`: `trustHost: true` (OAuth atrás do proxy). Segredos só em env (rotacionados no deploy). |
| **Health check** | `GET /api/health` → 200 (público; fora do middleware via matcher). Health check do Render + ping anti-spin-down. |

## O que NÃO mudou (invariante)
Domínio inteiro intacto: guardrail, `ResumeContent`, renderer, **isolamento por `userId`** (já garantido
desde a F9 — cada usuário vê só os seus). Geração/import idênticos (só ganharam o portão de rate limit).

## Verificação
- **Gates:** `node node_modules/typescript/bin/tsc --noEmit` limpo · `npm test` **342 passed** ·
  `npm run build` OK (14 rotas).
- **Rate limit:** teste de unidade (`tests/rate-limit.test.ts`) cobre limite/janela/isolamento por chave.
- **Pós-deploy (em `DEPLOY.md` §5):** login com 2 contas → isolamento; geração e2e sem timeout; `/api/health`;
  headers via `curl -I`; 429 ao exceder.

## Pendências / follow-ups (não bloqueiam)
- **Cold start** do Render free (dorme após ~15min) — ping em `/api/health` se incomodar, ou tier pago.
- **Geração assíncrona (fila + polling)** — só se crescer/abrir ao público (ADR futuro).
- **Rate limit em Redis/Upstash** — só se for multi-instância.
- **Extração robusta (OCR)** e **adoção do Nemotron** seguem deferidas.

## Estado do código
Branch `worktree-fatia-9-multiusuario` (= `main`). O dono revisa/commita/empurra. `DEPLOY.md` na raiz tem
o passo a passo do Render + Neon + rotação de segredos.
