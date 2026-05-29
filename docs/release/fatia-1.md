# Relatório de progresso — até a Fatia 1

> Documento **committado** (vive no repo) para continuar o projeto em qualquer máquina.
> A memória do Claude e o arquivo de plano ficam fora do repo (`~/.claude/...`) e NÃO
> são clonados — por isso o estado essencial mora aqui. Atualizado: 2026-05-29.

## Estado atual

- ✅ **Fundação documental** (commit `base do projeto`): `ARCHITECTURE.md`, `docs/spec.md`,
  `docs/erd.md`, `docs/api-contract.md` (Zod, congelado), 11 ADRs, 9 user stories, `docs/agent-team.md`.
- ✅ **Fatia 0 — scaffold**: Next.js 15 + React 19 + TS 5 + Prisma 6 (SQLite) + Vitest 4 + Zod 4.
- ✅ **Fatia 1 — núcleo (via Agent Team)**: US-01 renderer, US-02 CRUD do perfil, US-03 itens da base.
  Verificado: `tsc --noEmit` limpo · `npm test` 48/48 · `next build` OK.

## Como retomar numa máquina nova (após `git clone`)

Pré-requisito: **Node.js ≥ 20** instalado (testado com v24).

```bash
npm install
cp .env.example .env          # depois edite o .env (veja abaixo)
npx prisma migrate dev        # aplica migrations + cria dev.db + roda o seed (usuário 'local-user')
npm run dev                   # http://localhost:3000  (/perfil é a tela pronta)
npm test                      # deve dar 48/48 verde
```

**`.env` (não vai no git):** copie do `.env.example` e preencha:
- `LLM_API_KEY` = sua chave da **NVIDIA NIM** (a única que falta; é secreta, por isso não está no repo).
- Os demais (`DATABASE_URL=file:./dev.db`, `LLM_BASE_URL=https://integrate.api.nvidia.com/v1`,
  `MODEL_ID`, `LOCAL_USER_ID=local-user`) podem ficar como no exemplo.

## Decisões-chave da Fatia 1 (para não reabrir)

- **LLM → JSON validado (Zod) → renderer determinístico** monta o `.tex`. O LLM nunca emite `.tex`.
- **`renderResume(content: ResumeContent, header: Profile)` — `header` OBRIGATÓRIO** (decisão do
  architect, registrada no contrato §3): currículo sem nome é inválido por construção. Em testes,
  passa-se um `Profile` mínimo `{ fullName: "Teste" }`.
- **Serialização**: schemas de domínio usam arrays/objetos; a (de)serialização para String-JSON do
  SQLite vive SÓ em `src/server/data/profile-repo.ts` (não nos schemas nem no Prisma).
- **`saveProfileBundle`**: estratégia "replace" transacional (deleteMany + createMany), `order`
  reindexado pela posição no array. Ids dos itens são regenerados a cada save (ninguém referencia
  ids persistidos; o guardrail usa `sourceId` dos itens lidos na hora da geração).
- **`emptyBundle()` não pode rodar `ProfileBundleSchema.parse`** (o `fullName.min(1)` estoura para
  base vazia) — usar literal tipado. `.min(1)` é regra de ESCRITA, não de leitura.
- **Versões fixadas de propósito**: Next 15, Prisma 6, ESLint 9, TS 5. O `@latest` puxa
  Next 16/Prisma 7/ESLint 10/TS 6, que quebram entre si. Cuidado ao bumpar.

## Pendências conhecidas

- ESLint flat config (`eslint.config.mjs`) ainda não criado; `next.config.ts` usa
  `eslint.ignoreDuringBuilds: true` por ora.
- Aviso de deprecação `package.json#prisma` → migrar para `prisma.config.ts` (opcional no Prisma 6).
- Testes de integração marcados `[BLOQUEIO]` pelo QA para uma fatia futura: round-trip real
  save→read e teste do envelope de erro do Route Handler.

## Próximo passo — Fatia 2 (camada LLM + geração Modo 1)

- **US-04**: interface `LLMProvider` + adapter NVIDIA NIM (SDK OpenAI apontado para `LLM_BASE_URL`),
  modelo por env. Arquivos previstos: `src/server/llm/{provider,nim,models}.ts` + `prompts/standard-cv.ts`.
- **US-05**: fluxo de geração Modo 1 (base → LLM → `ResumeContent` → `renderResume(content, profile)`
  → persistir `GeneratedResume`). Rota `POST /api/resumes/generate`, tela `/gerar`.
- **US-06**: download do `.tex` + preview.

Coordenação do Agent Team na Fatia 2 (lições da Fatia 1): o **lead coordena por mensagem e NÃO
edita arquivos que os agentes editam**; **decisões de contrato fechadas ANTES de codar**; cada
decisão dividida vira ADR curto na hora. Prompt de criação do time em `docs/agent-team.md`.
