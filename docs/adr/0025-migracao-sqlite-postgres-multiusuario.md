# 0025 — Migração SQLite → Postgres para deploy multiusuário

- **Status:** Accepted
- **Data:** 2026-05-31
- **Relaciona:** [[0005-dados-local-first-sqlite-prisma]] (decisão original local-first, já previa esta
  migração), [[0024-autenticacao-real-authjs-oauth-seam-async]] (auth exige persistir contas/sessões)

## Contexto

O MVP usa **SQLite** num arquivo (`dev.db`), escolhido como denominador comum local-first e
**explicitamente migrável para Postgres** trocando o `provider` + `DATABASE_URL`, sem reescrever
queries ([[0005-dados-local-first-sqlite-prisma]]). Chegou a hora prevista: o deploy é **público na
Vercel** (serverless) e **multiusuário** ([[0024-autenticacao-real-authjs-oauth-seam-async]]).

Por que SQLite não serve agora:
- **Serverless sem filesystem persistente/compartilhado:** funções da Vercel não compartilham um
  arquivo `dev.db`; escritas concorrentes de vários usuários não têm onde viver.
- **Auth.js precisa persistir** `Account`/`Session`/`VerificationToken` (adapter) — estado
  compartilhado entre requisições/instâncias.

Gotcha conhecido do SQLite no projeto: **DateTime é gravado como epoch em milissegundos**, o que
forçou SQL especial em migrações com backfill de data. O Postgres usa `timestamp` nativo — o gotcha
desaparece, mas **as migrações SQLite existentes não rodam no Postgres**.

## Decisão

### 1. Trocar o provider para Postgres
`datasource db { provider = "postgresql" }` e `DATABASE_URL` apontando um **Postgres gerenciado**
(recomendado **Neon** — serverless/free tier; Supabase/Vercel Postgres são equivalentes). Nenhuma
query dos repositórios muda (era a promessa do [[0005-dados-local-first-sqlite-prisma]]).

### 2. Baseline de migração novo (não reaproveitar as migrações SQLite)
As migrações em `prisma/migrations/` são **SQLite-específicas** (inclusive o backfill com
`/1000`+`unixepoch`). Para Postgres, **recriar o baseline**: arquivar/remover o histórico SQLite e
gerar uma migração inicial limpa para Postgres já com o schema completo (domínio + modelos do
adapter). O `dev.db` e os dados de teste são **descartáveis** — não há dado de produção a preservar.

### 3. Modelos do adapter (aditivo ao schema)
Adicionar `Account`, `Session`, `VerificationToken` (forma exigida pelo `@auth/prisma-adapter`) e
estender `User` com `name String?`, `image String?`, `emailVerified DateTime?` + relações
`accounts`/`sessions`. As entidades de domínio e o `userId` em tudo **permanecem**.

### 4. JSON-as-String mantido (YAGNI)
Os campos de lista (`bullets`, `techStack`, `parsedKeywords`, `*Json`) continuam **`String` com JSON
serializado**, como no SQLite. **Não** migrar para `jsonb` agora: tocaria schemas/serialização sem
necessidade imediata e o renderer/`ResumeContent` ficam intactos. Fica documentado como evolução
futura possível (consultas/índices sobre JSON, se um dia precisarmos).

### 5. Unicidade do currículo padrão (`isDefault`) na aplicação
Continua garantida **na escrita** (`setDefaultResume` zera os demais), como no MVP
([[0022-curriculo-padrao-adaptacao-referencia-profundidade]]). Com Postgres abre-se a porta para um
**índice parcial único** `(userId) WHERE isDefault` — registrado como melhoria futura, **não** feito
nesta fatia (a garantia na aplicação basta e evita risco de migração agora).

### O que NÃO muda
- Queries dos repositórios, `ResumeContentSchema`, renderer determinístico, guardrail e contratos.
- O modelo multi-tenant (`userId` em toda entidade) — só ganha um banco que aguenta concorrência.

## Consequências

- Banco aguenta **múltiplos usuários concorrentes** num ambiente serverless.
- **Setup local muda:** desenvolver passa a exigir um Postgres (local via Docker **ou** uma branch
  Neon de dev) — documentado em `docs/release/fatia-9.md`. Some o atrito do `dev.db`, mas entra o de
  subir um Postgres.
- O gotcha do **epoch-ms** deixa de existir (datas nativas no Postgres).
- **Migração de teste é destrutiva e intencional:** baseline novo, dados de teste recriados.
- Deploy na Vercel roda `prisma migrate deploy` no build; `DATABASE_URL` e segredos OAuth como envs
  da plataforma.

## Alternativas consideradas

- **Manter SQLite (ex.: Turso/libSQL):** permitiria SQLite "na nuvem", mas reintroduz limites de
  concorrência e foge do alvo Postgres já previsto no [[0005-dados-local-first-sqlite-prisma]]; sem
  ganho frente a um Postgres gerenciado com free tier.
- **Migrar listas para `jsonb` junto:** rejeitado por YAGNI — mais superfície de mudança (schemas,
  (de)serialização, testes) sem necessidade atual.
- **Tentar converter as migrações SQLite para Postgres:** rejeitado — frágil e sem valor, já que não
  há dado de produção; baseline limpo é mais simples e seguro.
- **Índice único parcial de `isDefault` agora:** adiado — a garantia na aplicação já funciona; somar
  constraint de banco no mesmo passo da migração aumenta risco sem necessidade imediata.
