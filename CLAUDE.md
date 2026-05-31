# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**Forja de Currículo** (formerly **CV-Adapter** — the old name remains in ADRs/release notes as
historical records) — a web app that uses AI to adapt a user's résumé into the Overleaf
**faangpath-simple-template** LaTeX format. The user maintains one structured **personal
data base** (the source of truth), and the system generates a `.tex` file in two modes:

- **Mode 1 — Standard CV** (mandatory / first): a complete general résumé from the data base.
- **Mode 2 — Job-adaptive CV**: the user pastes a job posting; the AI selects, reorders, and
  rewrites the *wording* of **only real items** from the data base to fit the job.

**Non-negotiable product invariant: the AI never invents information.** It may only select,
omit, reorder, and reword items that already exist in the user's data base. Output is the
`.tex` only — the user compiles it in Overleaf (no LaTeX engine in our system).

The authoritative technical reference is **`ARCHITECTURE.md`** — read it before any technical
decision. This file is the quick operational summary; `ARCHITECTURE.md` and `docs/` are canonical.

## Where we are / how to resume

**Read `docs/release/fatia-8.md` first** — the committed source of truth for current progress
(the `docs/release/fatia-N.md` series chains the history: fatia-1 → … → fatia-8). As of
**2026-05-31, MVP + Fatias 4–8 are done** (4–7 committed on `main`, latest `1cdc99e`; **Fatia 8
implementada mas NÃO commitada** — está só no working tree):
- **MVP (US-01…09)** — base CRUD, Modo 1/2, guardrail anti-alucinação; validado e2e vs NVIDIA NIM real.
- **Fatia 4 (US-10, ADR-0017)** — redesign visual dev-tool em Tailwind.
- **Fatia 5 (US-11/12, ADR-0018)** — importar perfil por **dump de texto** (IA estrutura → mescla no
  `/perfil`, **não persiste**) + Formação "em andamento" (`Education.current`).
- **Fatia 6 (US-13, ADR-0019)** — importar perfil por **arquivo** (PDF/DOCX/TXT) via `unpdf`+`mammoth`
  no servidor → mesmo pipeline de extração.
- **Fatia 7 (US-14/15/16, ADR-0020/0021)** — geração **completa e fiel** (idiomas, cursos, bullets+stack
  de projeto; títulos PT-BR; links azul-marinho, não rosa), gestão de currículos (nome/ver/copiar/editar/
  excluir + "Abrir no Overleaf"), **limpar base** + import "Substituir".
- **Fatia 8 (US-17/18, ADR-0022)** — **currículo padrão** (`isDefault`: marcar/destacar ★, auto-default no
  1º; `PATCH` aceita `isDefault`); **seletor de base no `/gerar`** (Modo 2 escolhe o STANDARD; `baseResumeId`);
  **adaptação mais rica** — o Modo 2 deixa o viés de "enxugar" e vira **Equilibrado** + recebe o currículo
  padrão como **referência de profundidade** (não é fonte de fatos; guardrail/`ResumeContent`/renderer
  **inalterados**). Implementada **direto pelo lead** a pedido do dono (sem o time de 5 papéis), ADR-first.
  **Commitada pelo dono** em `a414eed`.
- **Pós-F8 — rename + ADR-0023 (no working tree, NÃO commitado):** o produto foi **renomeado de `CV-Adapter`
  para `Forja de Currículo`** (strings de UI, `package.json` `forja-de-curriculo`, README/ARCHITECTURE/
  CLAUDE; ADRs/releases ficam com o nome antigo por serem histórico). E o **e2e real com a NIM** (validação
  pedida pelo dono) revelou que o Modo 2 rico estourava o timeout de 60s (retry storm → **182s**, risco de
  502): **ADR-0023** corrige — geração com **timeout 180s + 1 retry + `temperature: 0.3`** e **JSON compacto**
  nos prompts → caiu para **~65s**; e o prompt do Modo 2 ganhou reforço de **tailoring** (objetivo focado na
  vaga) + **preservar todos os itens/bullets**. Resultado e2e final: `.tex` 3.414→**5.932**, 2 exp (5+5
  bullets) + 3 projetos fiéis à base, objetivo PHP, guardrail 0/0, sem inventar.

`tsc` clean · `npm test` **330/330** · `next build` OK (13 rotas). **`main`** tem a Fatia 8 (`a414eed`) e
está **à frente de `origin/main` sem push** (o dono empurra). O **rename + ADR-0023 estão no working tree,
NÃO commitados** (o lead **propõe**; não commita sozinho, salvo pedido do dono — nesta sessão o dono disse
que faria os commits). Últimos commits em `main`: `1cdc99e` (F7), `a414eed` (F8).

**Gotchas / aprendizados (importantes):**
- O **gate do projeto são OS DOIS: `npx tsc --noEmit` E `npm test`** — o vitest transpila sem type-check,
  então passa mesmo com erro de tipo. Sempre rode os dois.
- O **import** (arquivo/texto) precisa de **timeout longo**: a chamada à NIM leva ~50s para um currículo
  completo. O import usa **180s + `json_object`** (não `json_schema`) em `nim.ts` — 60s causava 502.
- A **GERAÇÃO** (Modo 1/2) tem o mesmo risco depois que ficou rica (ADR-0023): use **180s + 1 retry +
  `temperature: 0.3`** em `nim.ts`. O timeout de 60s causava **retry storm** (3×60s ≈ 182s e 502s); a
  temperatura padrão dava **variância alta** (uma geração mantinha tudo, outra cortava metade). Serialize os
  prompts com `JSON.stringify(x)` **compacto** (sem indent) para cortar tokens.
- O schema de rascunho do import (`ImportProfileBundleSchema`) é **tolerante** (campo ausente → "") para um
  currículo incompleto não dar 502; a obrigatoriedade fica no `PUT /api/profile` (estrito).
- **SQLite guarda DateTime como epoch em MILISSEGUNDOS** → migrações com backfill de data precisam
  `"createdAt"/1000` + `strftime(..., 'unixepoch')`.
- **`prisma generate` dá EPERM no Windows** enquanto o `next dev` segura o engine DLL (inofensivo; .d.ts/.js
  regeneram). O `npx prisma` é quebrado pelo proxy `rtk` → usar `node node_modules/prisma/build/index.js`.
- `next build` ENOENT no Windows (`.next` velho) → apagar `.next` e rebuildar. NIM key tem de começar com
  `nvapi-` (senão 401). Em máquina nova, seguir `docs/release/fatia-1.md`.

**Workflow:** cada fatia via Agent Team de **5 papéis** (`TeamCreate`: lead + product-owner + architect +
fullstack + qa), recriado a cada sessão (morre no `/clear` e no resume). Architect escreve o ADR (gate)
ANTES do código; mudanças no contrato congelado são **aditivas** + nota datada em `docs/api-contract.md`.

## Stack (see ARCHITECTURE.md §2)

Next.js 15 (App Router) + TypeScript · Prisma + SQLite (MVP) → Postgres · Zod · Vitest ·
AI via the **OpenAI SDK pointed at NVIDIA NIM** (OpenAI-compatible), behind a swappable
`LLMProvider`. No auth in MVP (a `getCurrentUserId()` seam returns `LOCAL_USER_ID`).

Commands (once scaffolded — do not assume they exist before Slice 0):
`npm run dev` · `npm run build` · `npm test` (Vitest) · `npm test -- <file>` (single test) ·
`npx prisma migrate dev` · `npx prisma db seed`.

## Architecture rules that are easy to get wrong

- **The LLM returns Zod-validated JSON (`ResumeContent`), NEVER raw `.tex`.** A deterministic
  renderer (`src/server/resume/render-latex.ts`) turns that JSON into the faangpath `.tex`.
  This is what makes the no-hallucination guarantee and LaTeX validity hold — do not let the
  model emit LaTeX directly.
- **All user text passes through `escapeLatex()`** before entering the `.tex`. One boundary,
  in `src/server/resume/escape-latex.ts`.
- **No-hallucination guardrail is 3 layers** (architecture → strict prompt → post-generation
  traceability check in `validate-traceability.ts`). A generated entity not present in the
  data base (e.g. a company the user never entered) is a **hard failure → regenerate**; new
  numbers/dates/tech names are surfaced as **warnings** in the preview. See ARCHITECTURE.md §6
  and `docs/spec.md` §4.
- **`userId` is on every domain entity from day one** and data access always goes through
  `getCurrentUserId()`. This is the multi-user migration seam — never hardcode the id elsewhere.
- **AI access only through the `LLMProvider` interface** (`src/server/llm/`). The model and
  base URL come from env (`LLM_BASE_URL`, `LLM_API_KEY`, `MODEL_ID`). The `claude-api` skill
  does **not** apply here — we use the OpenAI-compatible SDK against NIM, not the Anthropic SDK.

## Development workflow (this repo follows `template-claude-workflow.md`)

Document-driven, in order: `ARCHITECTURE.md` → ERD (`docs/erd.md`) → frozen contract
(`docs/api-contract.md`, Zod schemas + route list) → user stories + ADRs in parallel →
implementation in **slices of ~3–5 user stories per session** via the Agent Team
(`cv-adapter-development-team`), `/clear` between slices.

Adaptations from the template for this single Next.js app:
- The Agent Team is **hybrid per slice**: one `fullstack-agent` for Slices 1–3 (backend-heavy,
  little UI), splitting into `frontend-agent` + `backend-agent` for Slice 4 (visual polish),
  with the frozen Zod contract + directory ownership as the boundary. See `docs/agent-team.md`.
- **MUST spawn the FULL team every slice — 5 distinct roles, not just lead+fullstack:**
  `lead` + `product-owner-agent` + `architect-agent` + (`fullstack-agent` | for Slice 4
  `frontend-agent`+`backend-agent`) + `qa-agent`. The **lead ONLY** coordinates by message,
  verifies artifacts by hand, and consolidates the release report — it does **NOT** absorb the
  PO or architect. The **architect** writes/owns the ADRs and validates contract adherence; the
  **PO** resolves `[DECISÃO PENDENTE]` and accepts the stories; the **QA** hardens tests. Recreate
  the team with `TeamCreate` each session — it dies on `/clear` **and on session resume**.
- The "API contract" is **Zod schemas + the route list**, not an OpenAPI/tRPC handoff.
- `docs/spec.md` replaces `design_handoff/` (no visual design exists yet; can be generated
  later with the `frontend-design` / `ui-ux-pro-max` skills).
- **Agent Teams is experimental** — treat the first run as best-effort and verify artifacts by hand.

## Conventions

- **Accepted ADRs are immutable.** Revise a decision with a new ADR (`Supersedes ADR-NNNN`)
  and mark the old one `Superseded by ADR-XXXX`. Any new technical decision becomes an ADR.
- **`docs/api-contract.md` is frozen** after the foundation; changes need architect approval,
  a dated note at the top, and an ADR.
- **Never install a new dependency without prior confirmation.**
- Branches: `feature/<slug>`, `refactor/<slug>`, `fix/<slug>`, `chore/<slug>`.
- Commits: Conventional Commits; each story gets a dedicated commit referencing its number
  (`feat: US-03 ...`). No agent pushes to `main` directly.
- **Tests ship with each story** (Vitest); mandatory coverage for `escapeLatex`,
  `renderResume`, and `validateTraceability`.

## Working language

All generated documentation, UI, and example résumés are in **Brazilian Portuguese (PT-BR)**.
This CLAUDE.md is in English as Claude's operational reference; everything user-facing is PT-BR.
