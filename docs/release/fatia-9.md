# Relatório de release — Fatia 9 · Multiusuário (Auth.js/OAuth) + Postgres + deploy público

> Documento **committável** (vive no repo). Continuação de `docs/release/fatia-8.md`. Atualizado: 2026-05-31.

## Estado atual

- ✅ **Fatia 9 implementada** numa **git worktree isolada** (branch `worktree-fatia-9-multiusuario`),
  para não interromper os testes locais do dono (que rodavam em SQLite no `main`). Implementada
  **direto pelo lead** (a pedido do dono), mantendo o rigor: **ADRs 0024/0025 (gate) escritos ANTES do
  código**, contrato aditivo + nota datada, testes por comportamento, e os **dois gates** à mão.
- Nasceu do objetivo do dono: **compartilhar o produto** com outras pessoas para testarem por si. Exige
  login real, isolamento por usuário e um banco que aguente concorrência na web.
- **US implícitas:** login OAuth (Google/GitHub), isolamento multi-tenant, migração para Postgres,
  deploy na Vercel.
- **Verificado à mão (na worktree):** `tsc --noEmit` **limpo** · `npm test` **334/334** (30 arquivos;
  330 antes → 334, +4 do seam) · `npm run build` **OK** (13 rotas + Middleware Edge 87.6 kB).

## Decisões (ADR-0024 / ADR-0025)
- **Auth.js (NextAuth v5) + OAuth Google/GitHub** — sem senha local nesta fase (atrito/segurança). O
  `@auth/prisma-adapter` provisiona o `User` no 1º login.
- **Sessão por JWT (não database)** — para o **middleware do Edge** ler a sessão sem tocar o Prisma
  (Prisma não roda no Edge). Padrão "split config": `src/auth.config.ts` (Edge-safe) + `src/auth.ts` (Node).
- **Seam assíncrono** — `getCurrentUserId()` lê `auth()`; em produção sem sessão → 401; fora de produção,
  fallback `LOCAL_USER_ID` (preserva dev/testes). Refina o ADR-0006 (mantém o padrão de seam).
- **SQLite → Postgres** — provider trocado; baseline de migração novo (as migrações SQLite não rodam no
  PG); JSON-as-String mantido (YAGNI); unicidade de `isDefault` segue na aplicação.

## O que mudou (por área)

| Área | Entrega |
|------|---------|
| **Auth.js** | `src/auth.config.ts` (Edge-safe: providers Google/GitHub + callback `authorized` + `jwt`/`session` com `user.id` + `session.strategy="jwt"`), `src/auth.ts` (NextAuth + `PrismaAdapter`), `src/app/api/auth/[...nextauth]/route.ts` (handlers), `src/middleware.ts` (protege tudo exceto `api/auth`/assets; `/login` liberado pelo `authorized`), `src/types/next-auth.d.ts` (augmenta `Session.user.id`). |
| **Seam de identidade** | `getCurrentUserId()` agora `async` lendo a sessão; `UnauthenticatedError`; fallback de dev. **~11 call sites** nos repos (`resume` 7×, `profile` 3×, `job` 1×) ganharam `await`. |
| **Schema/DB** | `provider = "postgresql"`; `User` ganha `name/image/emailVerified` + relações `accounts/sessions`; novos modelos `Account`/`Session`/`VerificationToken`. `seed.ts` vira **dev-only** (cria o usuário do fallback; no-op em produção). |
| **UI** | `Providers` (SessionProvider) no root layout; `UserMenu` (nome + "Sair") no rodapé da sidebar; página **`/login`** (entrar com Google/GitHub via server actions). CSS no `globals.css` usando os tokens do DS. |
| **Envs** | `.env.example`: `DATABASE_URL` Postgres; `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_GITHUB_ID/SECRET`; `LOCAL_USER_ID` reetiquetado como fallback de dev. |
| **Dependências** | `next-auth@^5.0.0-beta.31` + `@auth/prisma-adapter@^2.11.2` (aprovadas pelo dono). |

## O que NÃO mudou (invariante)
`ResumeContentSchema`, renderer determinístico, guardrail (`validate-traceability.ts`) e **todas as rotas
de negócio** (`/api/profile`, `/api/resumes*`, `/api/profile/import*`). A geração/import seguem idênticas;
o multi-tenant já existia (`userId` em tudo) — só ganhou login real e um banco concorrente.

## Verificação (à mão, na worktree)
- `node node_modules/typescript/bin/tsc --noEmit` → **No errors** (incl. tests/).
- `npm test` → **334 passed (30 arquivos)** — +4 testes do seam (`tests/get-current-user-id.test.ts`:
  sessão válida / fallback de dev / lança sem fallback / lança em produção).
- `npm run build` → **OK**, 13 rotas + Middleware (87.6 kB). Dois avisos benignos (ver Riscos).
- **Isolamento:** estrutural — toda query já filtra por `userId` (inalterado); a prova e2e com 2 contas
  é o teste de deploy abaixo (não há DB na worktree para um teste de isolamento real).

## Pendência manual (dono) — passos de deploy
1. **Postgres (Neon recomendado):** criar um projeto + uma branch de dev; pegar a `DATABASE_URL`.
2. **Credenciais OAuth:** criar app OAuth no **Google Cloud** e no **GitHub**; configurar o callback
   `https://<app>/api/auth/callback/google` e `.../github` (em dev: `http://localhost:3000/...`).
3. **Segredo:** `npx auth secret` (gera `AUTH_SECRET`).
4. **Migração:** com a `DATABASE_URL` setada, rodar `prisma migrate dev --name init_postgres_auth`
   (cria o baseline no Postgres) — em dev. No deploy, `prisma migrate deploy` no build.
5. **Vercel:** importar o repo; setar envs (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` = URL pública,
   `AUTH_GOOGLE_ID/SECRET`, `AUTH_GITHUB_ID/SECRET`, `LLM_*`, `MODEL_ID`). Build roda `migrate deploy`.
6. **E2E real:** logar com 2 contas diferentes → confirmar que cada uma vê só a própria base/currículos;
   tentar abrir um id alheio → 404.

## Riscos / limites conhecidos (aceitos)
- **Aviso `jose`/Edge (`CompressionStream`/`DecompressionStream`)** no build: conhecido do NextAuth v5 —
  o `jose` empacota o código de compressão JWE, mas o NextAuth **não usa compressão por padrão** (nunca
  executa). Inofensivo; o build passa e o middleware funciona.
- **Aviso de múltiplos lockfiles** no build: artefato da worktree ter o próprio `package-lock.json` (com
  as deps novas). Some ao mesclar na `main`.
- **Unicidade de `isDefault` na aplicação** (não no banco): OK; com Postgres, evolução futura = índice
  parcial único `(userId) WHERE isDefault`.
- **Base de teste antiga do dono** (sob `LOCAL_USER_ID`): não migra para a conta OAuth — re-importar
  (dado descartável).
- **Sessão JWT** (não database): o modelo `Session` do adapter fica ocioso (sessão vive no token) —
  mantido por completude do adapter; inofensivo.

## Estado do código
Tudo na **worktree** `worktree-fatia-9-multiusuario` (não mesclado na `main`, que segue intacta em SQLite
para os testes do dono). O lead **propõe**; o dono revisa, commita e empurra (workflow do repo).
