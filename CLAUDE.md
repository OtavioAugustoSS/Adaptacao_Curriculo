# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**CV-Adapter** — a web app that uses AI to adapt a user's résumé into the Overleaf
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

**Read `docs/release/fatia-3.md` first** — the committed source of truth for current progress
(the `docs/release/fatia-N.md` series chains the history: fatia-1 → fatia-2 → fatia-3). As of
2026-05-30 the **MVP is functionally complete**: all 9 user stories (US-01…US-09) done and
verified, committed on `main` (latest `a38d617` — Fatia 3). `tsc` clean · `npm test` **147/147** ·
`next build` OK. **Both Mode 1 and Mode 2 are validated end-to-end against real NVIDIA NIM** —
Mode 2 smoke test passed 2026-05-30 (see `docs/release/fatia-3.md` → "Smoke test real do Modo 2"):
guardrail clean (`errors: []`, `warnings: []`), no invented company/skill. **The MVP is therefore
functionally closed.** **Fatia 4 — visual polish** (split `fullstack-agent` into `frontend-agent` +
`backend-agent`, use the design skills; UI today is functional inline-styles) **is deferred to the
LAST step, on the owner's explicit request** — do NOT spawn the extended team or run design skills
proactively until asked. On a freshly cloned machine, follow the setup in `docs/release/fatia-1.md`
(supply your own NIM `LLM_API_KEY` — it **must start with `nvapi-`**, else 401). Windows gotcha:
if `next build` fails with a missing-manifest ENOENT, delete `.next` and rebuild (stale cache, not
a code bug). The project owner makes the git commits — propose them, don't commit yourself.

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
