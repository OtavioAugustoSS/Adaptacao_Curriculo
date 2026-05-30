# Relatório de progresso — Fatia 2 (+ US-07)

> Documento **committável** (vive no repo) para continuar o projeto em qualquer máquina.
> Continuação de `docs/release/fatia-1.md`. Atualizado: 2026-05-30.

## Estado atual

- ✅ **Fatia 2 — Modo 1 (currículo padrão)**, via Agent Team (`cv-adapter-development-team`):
  - **US-04** — camada de IA: interface `LLMProvider` + adapter NVIDIA NIM (SDK `openai`).
  - **US-05** — fluxo de geração Modo 1: rota `POST /api/resumes/generate`, prompt, repo.
  - **US-06** — download do `.tex` (`GET /api/resumes/[id]/download`) + tela `/gerar`.
- ✅ **US-07 — guardrail de rastreabilidade** (início da Fatia 3; 3ª camada anti-alucinação).
- **Verificado à mão (lead):** `tsc --noEmit` limpo · `npm test` **119/119** · `next build` OK.
- **Smoke test REAL contra a NVIDIA NIM:** a cadeia inteira funciona de ponta a ponta
  (PUT base → POST generate → render → persist → download). A geração de sucesso está
  **bloqueada só pela credencial**: a `LLM_API_KEY` atual retorna **401** (não começa com
  `nvapi-`, logo não é uma chave válida da NIM). O código está provado correto — falta a chave.

## ⚠️ Pendência do usuário (única para destravar a geração)

Trocar a `LLM_API_KEY` no `.env` por uma chave **válida** da NVIDIA NIM:
1. `build.nvidia.com` → modelo `meta/llama-3.3-70b-instruct` → **"Get API Key"** (tier grátis).
2. A chave vem como **`nvapi-...`**. Cole em `.env`: `LLM_API_KEY="nvapi-..."`.
3. Refazer o smoke test (subir `npm run dev`, popular a base em `/perfil`, gerar em `/gerar`).

## Dependência adicionada

- **`openai@6.39.1`** (cliente OpenAI-compatible apontado para a NIM via `LLM_BASE_URL`).
  **Não** usamos a API da OpenAI — só a biblioteca cliente; o destino é a NVIDIA (ADR-0003).

## Decisões-chave desta fatia (ADRs novos — não reabrir)

- **ADR-0012** — saída estruturada via `response_format: json_schema` (derivado de
  `ResumeContentSchema` com `z.toJSONSchema` do Zod 4) + **revalidação Zod** obrigatória;
  fallback `json_object`; **timeout 60s + 2 retries** nativos do SDK no adapter.
- **ADR-0013** — modelo padrão `meta/llama-3.3-70b-instruct` (suporte explícito a structured
  output); `meta/llama-3.1-70b-instruct` fica no catálogo como alternativo.
- **ADR-0014** — Modo 1: pré-requisito (fullName + ≥1 experiência OU formação → senão **422
  PREREQUISITE_NOT_MET**); `traceabilityReport=null` pré-US-07; nome do arquivo
  `curriculo-<slug>-<AAAA-MM-DD>.tex`. (Nota datada no `api-contract.md`: 422 ampliado.)
- **ADR-0015** — guardrail: classificação **erro de entidade** (regenera; persistente → **422
  GUARDRAIL_FAILED**, não persiste) × **aviso** (número/skill nova → preview); **máx. 1
  regeneração**; normalização e heurísticas literais determinísticas e testáveis.

## Arquitetura entregue (mapa rápido)

- `src/server/llm/` — `provider.ts` (interface `LLMProvider` + `LLMError` transport/validation),
  `nim.ts` (`NimProvider`), `models.ts` (catálogo + `resolveModel`), `index.ts`
  (`getLLMProvider`), `prompts/standard-cv.ts` (prompt Modo 1).
- `src/server/resume/` — `select-content.ts` (`generateStandardContent`), `prerequisite.ts`,
  `filename.ts` (`buildTexFilename`/`slugify`), `validate-traceability.ts`
  (`validateTraceability` + `normalize`), e o já existente `render-latex.ts`/`escape-latex.ts`.
- `src/server/data/resume-repo.ts` — `createGeneratedResume` / `getGeneratedResumeById` /
  `listGeneratedResumes` (serialização JSON só aqui — ADR-0005).
- `src/app/api/resumes/generate/route.ts` (POST, com `generateWithGuardrail`),
  `src/app/api/resumes/[id]/download/route.ts` (GET; Next 15 `params` é Promise → `await`).
- `src/app/(dashboard)/gerar/page.tsx` — geração + preview + Copiar/Baixar + avisos de
  rastreabilidade.
- Tabelas `GeneratedResume`/`JobPosting` já existiam na migration `init` — **nenhuma migration
  nova foi necessária** na Fatia 2.

## Limites conhecidos do guardrail (aceitos no ADR-0015 — candidatos a US futura)

- Aviso de número por **substring**: base "300" e saída "30" não gera aviso (substring). Conservador.
- `checkNumbers` cobre `objective`/`experience.bullets`/`projects.description` — **não**
  varre `education.details` nem `period`.
- `objective` é checado só por número, não por procedência semântica (não rastreável a `sourceId`).
- `sourceId` forjado cujo `institution`/`title` casa por nome **passa** (fallback por nome do ADR).

## Próximo passo — Fatia 3 (continuação)

- **US-08 — Modo 2 (adaptativo à vaga):** `JobPostingSchema`, prompt `job-adaptive-cv.ts`,
  `mode=JOB_ADAPTIVE` na rota generate (hoje retorna 422 `MODE_NOT_IMPLEMENTED`). O guardrail
  (`validateTraceability`) **já é reutilizável** lá sem mudanças.
- **US-09 — histórico (`/curriculos`):** `GET /api/resumes` (já há `listGeneratedResumes` no
  repo) + re-download do `.tex` cacheado + relatório de rastreabilidade.

## Commits propostos (o dono do repo commita — não commitados ainda)

Sugestão por story (Conventional Commits), com os ADRs/contratos junto da story que os introduz:
1. `feat: US-04 — camada de IA (LLMProvider + adapter NIM)` — `src/server/llm/**`,
   `tests/nim-provider.test.ts`, `tests/llm-models.test.ts`, ADR-0012/0013, `.env.example`,
   `package.json`/`package-lock.json` (openai).
2. `feat: US-05 — geração Modo 1 (rota generate + prompt + repo)` — `select-content.ts`,
   `prerequisite.ts`, `resume-repo.ts`, `prompts/standard-cv.ts`, `api/resumes/generate/route.ts`,
   ADR-0014, nota no `api-contract.md`, testes correspondentes.
3. `feat: US-06 — download do .tex + preview na /gerar` — `filename.ts`,
   `api/resumes/[id]/download/route.ts`, `(dashboard)/gerar/page.tsx`, testes.
4. `feat: US-07 — guardrail de rastreabilidade (validateTraceability)` — `validate-traceability.ts`,
   integração na rota generate, painel de avisos na `/gerar`, ADR-0015,
   `tests/validate-traceability.test.ts` + testes de guardrail na rota.
5. `docs: relatório da Fatia 2 (+US-07)` — este arquivo + índice de ADRs.

(Alternativa: um único `feat:` da Fatia 2 + um da US-07, se preferir granularidade menor.)
