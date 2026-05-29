# Contrato de API — CV-Adapter

> **Status:** Congelado na fase 4.3 (fundação). Fonte da verdade do acordo entre
> `architect-agent` e `fullstack-agent`. Mudanças só via proposta aprovada pelo architect,
> registradas como nota abaixo + ADR.
>
> Última alteração: 2026-05-29 — versão inicial (congelamento).

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
| POST | `/api/resumes/generate` | `GenerateRequestSchema` | `GeneratedResumeSchema` | Gera currículo (Modo 1 ou 2): LLM → render → guardrail → persiste. |
| GET | `/api/resumes` | — | `GeneratedResumeSchema[]` | Lista o histórico de currículos gerados. |
| GET | `/api/resumes/[id]/download` | — | `text/plain` (`.tex`) | Baixa o `.tex` cacheado (`Content-Disposition: attachment`). |

**Convenções:**
- Todo handler resolve o usuário via `getCurrentUserId()` — sem `userId` no request.
- Erros retornam envelope `{ error: { code, message, details? } }` com status HTTP adequado
  (400 validação Zod, 404 não encontrado, 422 falha de guardrail/regeneração, 502 erro do LLM).
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
