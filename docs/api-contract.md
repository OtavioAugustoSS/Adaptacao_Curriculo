# Contrato de API — CV-Adapter

> **Status:** Congelado na fase 4.3 (fundação). Fonte da verdade do acordo entre
> `architect-agent` e `fullstack-agent`. Mudanças só via proposta aprovada pelo architect,
> registradas como nota abaixo + ADR.
>
> Última alteração: 2026-05-30 — **Fatia 6 (ADR-0019)** — nova rota
> **`POST /api/profile/import/file`** (`multipart/form-data`, campo `file`); response
> **`ProfileBundleSchema`** (mesmo rascunho **tolerante** da Fatia 5, **NÃO persistido**;
> reusa `ImportProfileBundleSchema` — **sem mudança de schema**). Extração de texto **no
> servidor** (`unpdf` p/ PDF + `mammoth` p/ DOCX + TXT nativo) → reusa o **EXISTENTE**
> `extractProfileFromDump`. Validação por whitelist de tipo + limite de tamanho (corpo é
> binário, sem schema Zod). **Sem OCR**: PDF digitalizado/imagem → **422** orientando a colar
> o texto. A rota `/api/profile/import` (texto) e o `ResumeContentSchema` **NÃO mudam**;
> invariante extração ≠ geração mantido (ADR-0018).
>
> 2026-05-30 — **Fatia 5 (ADR-0018)** — três mudanças **aditivas**, o
> contrato segue governado pelo gate do architect: (1) campo novo `current: boolean`
> (`z.boolean().default(false)`) em `EducationSchema` — espelha `Experience.current`, sem
> backfill; (2) rota nova **`POST /api/profile/import`** — request `{ rawText: string }`
> (`min 1`), response **`ProfileBundleSchema`** (rascunho **NÃO persistido**, devolvido ao
> formulário; reusa o schema existente, com variante tolerante de validação no adapter — o
> `fullName` pode vir vazio no rascunho, mas o `PUT /api/profile` segue **estrito**); (3) extensão
> **ADITIVA** do `LLMProvider` com `extractProfileFromDump(params): Promise<ProfileBundle>`
> (não toca `generateResumeContent`). O `ResumeContentSchema` **permanece congelado** — "Atual" na
> Formação sai do LLM formatando `period` (igual a `Experience`), sem novo campo no schema do
> guardrail. O `validate-traceability.ts` **não se aplica** ao import (extração ≠ geração).
> 2026-05-30 — §2: o status **422** passa a cobrir também
> "pré-requisito de base não atendido" (`code: PREREQUISITE_NOT_MET`) na rota
> `POST /api/resumes/generate`, além de falha de guardrail/regeneração (ADR-0014).
> Ampliação de semântica de status; **nenhum schema muda** — contrato segue congelado.
> 2026-05-29 — nota em §3: o renderer recebe o cabeçalho (`Profile`)
> como parâmetro separado do `ResumeContent` (detalhe de implementação, coerente com ADR-0007;
> contrato permanece congelado, sem mudança de schema).
> 2026-05-29 — versão inicial (congelamento).

Como o app é um único processo Next.js, o "contrato" são os **schemas Zod compartilhados**
(`src/lib/schemas/`) + a lista de **Route Handlers**. Os schemas são a única definição de
tipos de request/response; UI e Route Handlers importam dos mesmos schemas.

## 1. Schemas Zod (definição canônica — `src/lib/schemas/`)

Esboço (campos detalhados seguem o ERD em `docs/erd.md`):

- `ProfileSchema` — cabeçalho + resumo.
- `ExperienceSchema`, `EducationSchema`, `SkillSchema`, `ProjectSchema`,
  `LanguageSchema`, `CourseSchema` — itens da base (cada um com `order`).
- `ProfileBundleSchema` — `Profile` + todas as listas acima (a base de dados completa
  serializada; é o input do LLM).
- `JobPostingSchema` — `{ rawText, title?, company? }`.
- `ProfileImportRequestSchema` — `{ rawText: string }` (`min 1`); request do import por dump
  (ADR-0018). A resposta reusa `ProfileBundleSchema` (rascunho não persistido).
- `ResumeContentSchema` — **saída estruturada do LLM** (ver §3).
- `GenerateRequestSchema` — `{ mode: "STANDARD" | "JOB_ADAPTIVE", jobText?: string }`
  (`jobText` obrigatório quando `mode === "JOB_ADAPTIVE"`).
- `TraceabilityReportSchema` — `{ errors: Issue[], warnings: Issue[] }`, onde
  `Issue = { field, value, reason }`.
- `GeneratedResumeSchema` — registro persistido (ver ERD).

## 2. Route Handlers

| Método | Rota | Request | Response | Descrição |
|---|---|---|---|---|
| GET | `/api/profile` | — | `ProfileBundleSchema` | Lê a base de dados completa do usuário atual. |
| PUT | `/api/profile` | `ProfileBundleSchema` | `ProfileBundleSchema` | Cria/atualiza a base completa (upsert). |
| POST | `/api/profile/import` | `ProfileImportRequestSchema` (`{ rawText }`) | `ProfileBundleSchema` | Estrutura um dump de texto livre em um **rascunho** da base (LLM extrai, **não persiste**) para o usuário revisar. Variante tolerante no adapter (`fullName` pode vir vazio); `502` em `LLMError`. ADR-0018. |
| POST | `/api/profile/import/file` | `multipart/form-data` (campo `file`) | `ProfileBundleSchema` | Extrai o texto de um arquivo (PDF/DOCX/TXT) **no servidor** e reusa o **mesmo** pipeline da `/import` → rascunho tolerante **não persistido**. Sem schema Zod (corpo binário): whitelist de tipo + limite de tamanho. `400` (sem arquivo), `415` (tipo), `413` (tamanho), `422` (texto vazio — PDF imagem, sem OCR), `502` (`LLMError`). ADR-0019. |
| POST | `/api/resumes/generate` | `GenerateRequestSchema` | `GeneratedResumeSchema` | Gera currículo (Modo 1 ou 2): LLM → render → guardrail → persiste. |
| GET | `/api/resumes` | — | `GeneratedResumeSchema[]` | Lista o histórico de currículos gerados. |
| GET | `/api/resumes/[id]/download` | — | `text/plain` (`.tex`) | Baixa o `.tex` cacheado (`Content-Disposition: attachment`). |

**Convenções:**
- Todo handler resolve o usuário via `getCurrentUserId()` — sem `userId` no request.
- Erros retornam envelope `{ error: { code, message, details? } }` com status HTTP adequado
  (400 validação Zod, 404 não encontrado, 422 falha de guardrail/regeneração **ou pré-requisito
  de base não atendido** — `PREREQUISITE_NOT_MET` (ADR-0014), 502 erro do LLM).
- Sem paginação no MVP (volume baixo, single-user).

## 3. `ResumeContentSchema` — saída estruturada do LLM (núcleo do guardrail)

O LLM **não** emite `.tex`. Emite um objeto que **referencia/seleciona** itens reais da base
e pode reescrever apenas a *redação*:

```
ResumeContent = {
  objective: string,                 // reescrita do resumo (sem fatos novos)
  education:   EducationItem[],       // selecionados/ordenados da base
  skills:      { category, items: string[] }[],
  experience:  { sourceId, role, company, location?, period, bullets: string[] }[],
  projects:    { sourceId?, title, description, url? }[],
  extras?:     string[],              // extra-curricular
  leadership?: string[],
}
```

- Cada item de `experience`/`projects` traz `sourceId` apontando para o item real da base
  → o renderer e o guardrail conseguem rastrear.
- O renderer (`render-latex.ts`) mapeia esse objeto nas seções do template faangpath
  (`OBJECTIVE`, `Education`, `SKILLS`, `EXPERIENCE`, `PROJECTS`, `Extra-Curricular`,
  `Leadership`), aplicando `escapeLatex()` em todo texto.

> **Nota (2026-05-29) — cabeçalho separado do `ResumeContent`.** O `ResumeContentSchema`
> NÃO contém bloco de cabeçalho (nome/contato). O cabeçalho do `.tex` (`\name{...}` e
> `\address{...}`) vem **verbatim do `Profile`** (nome + linhas de contato: location, phone,
> email, linkedin, github, website — todos opcionais, omitindo vazios), também escapado por
> `escapeLatex()`. Por isso a assinatura do renderer é
> `renderResume(content: ResumeContent, header: Profile): string`. Razão: contato é dado
> factual do `Profile`, não conteúdo gerado/selecionado pelo LLM — fica fora do `ResumeContent`
> para não duplicar dados nem abrir espaço para o modelo divergir do cabeçalho real. Coerente
> com o invariante anti-alucinação e com ADR-0007; não altera schema (contrato congelado).
