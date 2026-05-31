# Arquitetura — Forja de Currículo (adaptação de currículo com IA; ex-CV-Adapter)

> Este arquivo é o **ponto de verdade** do projeto. Todo agente lê antes de tomar
> qualquer decisão técnica. Decisões registradas aqui também viram ADRs em `docs/adr/`.

## 1. Visão geral

Aplicação **web** que automatiza a adaptação de currículos usando IA, tendo como saída
um arquivo `.tex` no template LaTeX **faangpath-simple-template** do Overleaf.

O usuário mantém uma **base de dados pessoal** estruturada (resumo, formação, stacks,
projetos, habilidades, experiência profissional, idiomas, cursos/certificações) — essa
base é a **única fonte da verdade** sobre a pessoa. A partir dela, o sistema gera o
currículo em dois modos:

- **Modo 1 — Currículo padrão (obrigatório/primeiro):** monta um currículo "global"
  completo a partir da base de dados.
- **Modo 2 — Adaptativo à vaga:** o usuário cola o texto de uma vaga; a IA seleciona,
  reordena e reescreve a redação **apenas de itens reais** da base para aderir à vaga.

**Invariante de produto inegociável:** a IA **nunca inventa informação**. Ela só pode
selecionar, omitir, reordenar e reescrever a *redação* de itens que já existem na base.

A saída é **somente o `.tex`** — a compilação para PDF é feita pelo usuário no Overleaf.

## 2. Stack

- **Frontend + Backend:** Next.js 15 (App Router) + TypeScript estrito. Um único codebase
  (UI + Route Handlers / Server Actions).
- **Banco de dados:** Prisma ORM com **SQLite** (MVP/local) → **Postgres** (multiusuário).
  Migrar é trocar o `provider` do datasource + `DATABASE_URL`, sem reescrever queries.
- **Hospedagem:** local no MVP; futuro Vercel + Neon (Postgres).
- **Autenticação:** **nenhuma no MVP**. Existe o seam `getCurrentUserId()` (retorna
  `LOCAL_USER_ID`) para encaixar Auth.js depois sem mexer no acesso a dados.
- **IA:** SDK da OpenAI (`openai`) apontado para o endpoint **OpenAI-compatible da NVIDIA
  NIM** (`LLM_BASE_URL`), atrás de uma interface `LLMProvider` trocável. Modelo por env.
- **Validação/contrato:** **Zod** — schemas compartilhados servem como tipos e como
  contrato das rotas.

## 3. Estrutura de pastas

```
Adaptacao_Curriculo/
├── ARCHITECTURE.md
├── CLAUDE.md
├── README.md
├── template-claude-workflow.md      ← doc de processo (mantido como está)
├── .env.example
├── package.json
├── next.config.ts
├── tsconfig.json
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                      ← cria LOCAL_USER_ID + base de exemplo
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── perfil/page.tsx          ← editar a base de dados pessoal
│   │   │   ├── curriculos/page.tsx      ← histórico de currículos gerados
│   │   │   └── gerar/page.tsx           ← UI do gerador (Modo 1 / Modo 2)
│   │   ├── api/
│   │   │   ├── profile/route.ts
│   │   │   ├── resumes/route.ts
│   │   │   ├── resumes/generate/route.ts
│   │   │   └── resumes/[id]/download/route.ts   ← serve o .tex
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── server/
│   │   ├── db.ts                        ← singleton do Prisma
│   │   ├── auth/getCurrentUserId.ts     ← seam multiusuário
│   │   ├── llm/
│   │   │   ├── provider.ts              ← interface LLMProvider
│   │   │   ├── nim.ts                   ← adapter OpenAI-compatible → NIM
│   │   │   ├── models.ts                ← catálogo de modelos + padrão
│   │   │   └── prompts/
│   │   │       ├── standard-cv.ts       ← system prompt do Modo 1
│   │   │       └── job-adaptive-cv.ts   ← system prompt do Modo 2
│   │   ├── resume/
│   │   │   ├── select-content.ts        ← chamada LLM → ResumeContent (JSON)
│   │   │   ├── render-latex.ts          ← ResumeContent → .tex (faangpath)
│   │   │   ├── escape-latex.ts          ← escape único de texto do usuário
│   │   │   └── validate-traceability.ts ← guardrail anti-alucinação
│   │   └── data/                        ← repositório (profile/resume)
│   ├── lib/
│   │   ├── schemas/                     ← Zod: ProfileSchema, ResumeContentSchema, ...
│   │   └── types.ts
│   └── components/                      ← formulários, gerador, preview
├── templates/
│   └── faangpath/
│       ├── resume.cls.txt               ← cópia de referência da classe (read-only)
│       └── skeleton.ts                  ← template literal do .tex + builders de seção
├── tests/
│   ├── render-latex.test.ts
│   ├── escape-latex.test.ts
│   └── validate-traceability.test.ts
└── docs/
    ├── spec.md                          ← spec funcional (substitui design handoff)
    ├── erd.md
    ├── erd.mmd
    ├── api-contract.md
    ├── user-stories/
    ├── adr/
    └── release/
```

## 4. Modelo de dados

Resumo das entidades (detalhe completo em `docs/erd.md`). **Toda entidade "de domínio"
carrega `userId`** desde o início — é a garantia de migração para multiusuário sem retrabalho.

- **User** — identidade. No MVP, um único registro semeado (`LOCAL_USER_ID`).
- **Profile** — dados de cabeçalho + resumo/objetivo (1:1 com User no MVP).
- **Experience, Education, Skill, Project, Language, Course** — itens da base de dados
  pessoal, todos ligados a `Profile`/`userId`, com campo `order` para ordenação manual.
- **JobPosting** — texto bruto de uma vaga colada (insumo do Modo 2).
- **GeneratedResume** — currículo gerado: `mode` (`STANDARD` | `JOB_ADAPTIVE`),
  `contentJson` (o `ResumeContent` validado), `texOutput` (o `.tex` renderizado, cacheado),
  `traceabilityReport` (achados do guardrail), `modelId`, `jobPostingId?`.

Campos de array/lista (ex.: `bullets`, `techStack`) são armazenados como JSON —
mesma forma em SQLite e Postgres.

## 5. Padrões e convenções

- **Linguagem:** TypeScript estrito (sem `any` exceto justificado em comentário).
- **Lint/format:** ESLint + Prettier (config padrão do Next.js como base).
- **Idioma:** todo conteúdo gerado (docs, UI, currículos de exemplo) em **PT-BR**.
- **Regra de ouro da geração:** o **LLM retorna JSON validado por Zod**, **nunca `.tex`
  cru**. Um **renderer determinístico** (`render-latex.ts`) monta o `.tex`. Isso garante
  LaTeX sempre válido e impede a IA de adicionar seções/itens fora da base.
- **Escape LaTeX:** **todo** texto vindo do usuário passa por `escapeLatex()` antes de
  entrar no `.tex` (caracteres `& % $ # _ { } ~ ^ \`). Fronteira única e confiável.
- **Camada de IA abstraída:** todo acesso ao modelo passa pela interface `LLMProvider`.
  Trocar NIM por outro provedor (incl. Claude) é trocar o adapter + envs, não o call site.
- **Identidade:** acesso a dados sempre via `getCurrentUserId()` — nunca hardcode de id
  espalhado pelo código.
- **Branches:** `feature/<slug>`, `refactor/<slug>`, `fix/<slug>`, `chore/<slug>`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
  Cada US implementada gera commit dedicado referenciando o número (`feat: US-03 ...`).

## 6. Restrições e não-objetivos

**Fora do escopo do MVP:**
- Compilação LaTeX/geração de PDF dentro do sistema (compila no Overleaf).
- Autenticação e multi-tenant (mas o schema e o seam já estão preparados).
- 3º modo (ex.: carta de apresentação) — formato de saída diferente; fica como futuro.
- Múltiplos templates além do faangpath (estilo é parâmetro, não modo).
- Internacionalização (i18n).

**Decisões já tomadas (cada uma vira um ADR):**
1. Aplicação web fullstack em Next.js 15 + TypeScript. *(ADR-0001)*
2. Saída somente `.tex`; compilação no Overleaf. *(ADR-0002)*
3. IA via cliente OpenAI-compatible → NVIDIA NIM, atrás de `LLMProvider`. *(ADR-0003)*
4. Modelo e base-URL por variável de ambiente; catálogo em código. *(ADR-0004)*
5. Dados local-first (SQLite/Prisma) migráveis para Postgres; `userId` em tudo. *(ADR-0005)*
6. Identidade via seam `getCurrentUserId()`; auth real adiada. *(ADR-0006)*
7. LLM produz JSON validado (Zod); `.tex` por renderer determinístico. *(ADR-0007)*
8. Guardrail anti-alucinação em 3 camadas. *(ADR-0008)*
9. Escape LaTeX centralizado. *(ADR-0009)*
10. Dois modos no MVP; 3º modo é não-objetivo. *(ADR-0010)*
11. Contrato de API como schemas Zod compartilhados, congelado. *(ADR-0011)*

## 7. Contrato de API

- **Formato:** **schemas Zod compartilhados** (em `src/lib/schemas/`) + tabela de Route
  Handlers documentada em `docs/api-contract.md`.
- **Localização:** `docs/api-contract.md`.
- **Regra:** congelado na fase 4.3, ANTES da implementação. Como o app é um único processo
  Next.js (sem handoff backend↔frontend separado), o contrato é o **acordo entre o
  architect-agent e o fullstack-agent**. Mudanças só via proposta aprovada pelo architect
  e registradas como nota no topo do arquivo + ADR.

## 8. Testes

- **Stack:** Vitest.
- **Cobertura obrigatória (lógica pura crítica):** `escapeLatex`, `renderResume`
  (`render-latex.ts`) e `validateTraceability` — são o coração da corretude e do guardrail.
- **UI:** testes mínimos em componentes críticos.
- **E2E:** fora do escopo do MVP.
- **Regra:** uma US sem testes não é marcada como concluída (salvo dispensa explícita aqui).

## 9. Variáveis de ambiente

Lista mínima (sem valores reais — ver `.env.example`):

```
DATABASE_URL=         # ex.: file:./dev.db (SQLite no MVP)
LLM_BASE_URL=         # ex.: https://integrate.api.nvidia.com/v1 (NVIDIA NIM)
LLM_API_KEY=          # chave da NVIDIA NIM
MODEL_ID=             # ex.: meta/llama-3.1-70b-instruct (ajustável)
LOCAL_USER_ID=        # id do usuário único semeado no MVP
```
