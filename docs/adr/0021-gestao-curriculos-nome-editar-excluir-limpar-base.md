# 0021 — Gestão de currículos (nome/editar/excluir) e limpar a base

- **Status:** Accepted
- **Data:** 2026-05-30

## Contexto

No histórico (`/curriculos`) hoje só é possível baixar o `.tex`: não há nome, não dá para ver/copiar
o texto, renomear nem excluir. O dono também quer **limpar a base** e **reimportar substituindo**.
O escopo do MVP ([[0016-modo2-historico-escopo-mvp]]) deliberadamente não previa exclusão e fixava
o **título do histórico = rótulo do modo** (sem nome editável). Com o uso real, isso passou a
faltar. Esta decisão adiciona a gestão de currículos e a limpeza da base, com mudanças **aditivas**
ao contrato congelado ([[0011-contrato-api-zod-congelado]]).

A limpeza da base apaga **dados do usuário**: precisa ser explícita e bem definida (o que cai junto).

## Decisão

### 1. `GeneratedResume.name` (nome editável do usuário)

- **Prisma:** `GeneratedResume.name String` (migração; sem default no banco — o app sempre fornece).
- **`GeneratedResumeSchema`:** ganha `name: z.string()`.
- **Default na criação:** rótulo do modo + data — ex.: `"Currículo padrão — 30/05/2026"` (Modo 1) ou
  `"Adaptado à vaga — 30/05/2026"` (Modo 2). Definido no servidor quando o request não traz `name`.
- **Editável** pelo usuário via `PATCH` (abaixo).

**Supersede a parte do [[0016-modo2-historico-escopo-mvp]] que fixava "título do histórico = rótulo
do modo".** Aquela decisão é alterada **somente neste ponto**: agora existe um **nome editável do
usuário**, e o rótulo do modo vira apenas o **default** desse nome.

**O invariante anti-alucinação NÃO muda.** O `name` é um rótulo do usuário sobre o currículo — **não
é o texto da vaga** e **não** alimenta a geração nem o `ResumeContent`. A decisão de [[0016]] de não
exibir/denormalizar o texto da vaga no histórico permanece de pé; o `name` é independente disso.

### 2. `GenerateRequestSchema` ganha `name?: string` (aditivo)

`GenerateRequest = { mode, jobText?, name? }`. Quando ausente, o servidor aplica o default do item 1.
A `refine` existente de `jobText` (obrigatório no Modo 2) é preservada.

### 3. Rotas novas (envelope padrão `@/lib/http`, usuário via `getCurrentUserId()`)

| Método | Rota | Request | Sucesso | Erros |
|---|---|---|---|---|
| PATCH | `/api/resumes/[id]` | `{ name: string }` | **200** + `GeneratedResumeSchema` | **400** (Zod: `name` ausente/vazio) · **404** (id inexistente OU não pertence ao usuário) |
| DELETE | `/api/resumes/[id]` | — | **204** (sem corpo) | **404** (idem) |
| DELETE | `/api/profile` | — | **204** (sem corpo) | — (idempotente: base já vazia → 204) |

- **PATCH** valida `{ name }` com Zod (string não-vazia); renomeia só se o currículo for do usuário
  atual (senão **404**, não 403 — não revelamos existência de recurso alheio, coerente com o resto).
- **DELETE `/api/resumes/[id]`** exclui o currículo do usuário atual; id inexistente/alheio → **404**.
- **DELETE `/api/profile`** apaga o `Profile` do usuário; o **cascade** do Prisma apaga as **6 listas**
  (experiences, educations, skills, projects, languages, courses) e os `JobPosting`/`GeneratedResume`
  seguem a regra de cascade já existente do schema. Depois, `getProfileBundle` volta a devolver
  `emptyBundle()`. **Idempotente**: sem `Profile` → ainda **204**.

### 4. O que NÃO muda

- **Geração** (`POST /api/resumes/generate`): pipeline LLM → render → guardrail → persiste, igual.
- **Guardrail core** (`validate-traceability.ts`) e a **política de regeneração** ([[0015]]): intactos.
- **Invariante anti-alucinação** ([[0008-guardrail-anti-alucinacao-3-camadas]]): intacto — `name` é
  rótulo do usuário, não entra na geração.
- **`ResumeContentSchema`**: não muda **aqui** (é alterado, aditivamente, no [[0020-resume-content-enriquecido-geracao-completa]]).
- **`GET /api/resumes`** segue devolvendo `GeneratedResumeSchema[]` — agora com o campo `name`.
- **Identidade**: tudo via `getCurrentUserId()` ([[0006-identidade-seam-getcurrentuserid]]); sem
  `userId` no request.

## Consequências

- O usuário passa a nomear, ver/copiar, renomear e excluir currículos, e a limpar a base — gestão
  que faltava para o uso real.
- Mudanças **aditivas**: `name` com default no servidor não quebra geração existente; o histórico já
  persistido (sem `name`) recebe valor pela migração — a migração deve **backfill** os registros
  antigos com o rótulo do modo + `createdAt` (coluna `NOT NULL` sem default no banco exige isso).
- `DELETE /api/profile` é **destrutivo**: exige confirmação na UI; o cascade tem que estar correto no
  schema do Prisma (validar que as 6 listas e os filhos caem junto) — risco a verificar na migração.
- 404 (não 403) para recurso alheio mantém a convenção de não vazar existência; aceitável no MVP
  single-user.
- A semântica de status nas rotas novas (200/204/400/404) fica explícita para o fullstack implementar
  literalmente, sem reabrir o contrato.

## Alternativas consideradas

- **Manter "título = rótulo do modo" (sem nome editável):** rejeitado — o dono pediu nomear/renomear;
  o rótulo fixo não distingue currículos do mesmo modo gerados no mesmo dia.
- **Derivar o nome do texto da vaga (Modo 2):** rejeitado — reintroduziria o texto da vaga no histórico
  (que [[0016]] decidiu não exibir) e arranharia o invariante. O `name` é do usuário, independente da vaga.
- **DELETE retornando o recurso (200 + corpo):** rejeitado — **204 sem corpo** é o idiomático para
  exclusão; o cliente já recarrega a lista.
- **403 para currículo alheio:** rejeitado — vazaria a existência do id; **404** é coerente com o resto.
- **"Limpar base" apagando só as listas e mantendo o `Profile` vazio:** rejeitado — apagar o `Profile`
  e deixar `getProfileBundle` voltar a `emptyBundle()` é o estado "zerado" mais simples e previsível;
  o cascade cuida das listas.
- **Soft-delete (flag `deletedAt`):** rejeitado no MVP — sem requisito de auditoria/lixeira; exclusão
  física é mais simples e o volume single-user não justifica a complexidade.
