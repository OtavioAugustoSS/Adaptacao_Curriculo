# Contrato de API — CV-Adapter

> **Status:** Congelado na fase 4.3 (fundação). Fonte da verdade do acordo entre
> `architect-agent` e `fullstack-agent`. Mudanças só via proposta aprovada pelo architect,
> registradas como nota abaixo + ADR.
>
> Última alteração: 2026-06-03 — **ADR-0029 + ADR-0030** — mudanças **aditivas**; domínio e invariante inalterados.
> **ADR-0029 (link Overleaf):** ajuste de UI/config apenas — "Abrir no Overleaf" passa a apontar para o
> **template público** faangpath (env `NEXT_PUBLIC_OVERLEAF_TEMPLATE_URL`, com fallback), não mais um projeto
> privado (que dava erro de permissão a outros usuários). Sem mudança de rota/schema/domínio.
> **ADR-0030 (edição manual de currículo):** rota nova **`GET /api/resumes/[id]`** → **`GeneratedResumeSchema`**
> (404 se inexistente/alheio). **`PATCH /api/resumes/[id]`** passa a aceitar **`contentJson?: ResumeContent`**
> (além de `name?`/`isDefault?`; o `refine` exige **≥1** dos três): a rota re-renderiza o `.tex` pelo renderer
> **puro** (sem IA) e **zera** o `traceabilityReport`. O **guardrail NÃO roda** na edição manual (é o dono dos
> dados editando, não a IA — invariante anti-alucinação intacto). `ResumeContentSchema`, renderer, geração e a
> adaptação à vaga (que lê a base `/perfil`, ADR-0027) **inalterados**; `GET /api/resumes` segue igual.
>
> 2026-05-31 — **Fatia 11 (ADR-0028)** — produção; mudanças **aditivas**, domínio inalterado.
> **ADR-0028:** rota nova pública **`GET /api/health`** → `{ ok: true }` (fora do middleware). As rotas caras
> **`POST /api/resumes/generate`** e **`POST /api/profile/import*`** ganham **rate limit por usuário** →
> **`429 TOO_MANY_REQUESTS`** (envelope padrão) ao exceder. Nenhum schema/rota de domínio muda.
>
> 2026-05-31 — **Fatia 10 (ADR-0026/ADR-0027)** — mudanças **aditivas/comportamentais**, contrato de domínio **inalterado**.
> **ADR-0026:** rotas **`/api/*`** sem sessão passam a responder **`401` com envelope JSON** `{ error: { code:
> "UNAUTHENTICATED", ... } }` (antes redirecionavam para `/login` em HTML) — refina o middleware da F9.
> **ADR-0027 (adaptação à vaga):** o Modo 2 vira pipeline de **2 passos** (análise da vaga → adaptação); a
> análise é **andaime interno** (não há campo novo no request/response). **`GenerateRequest` inalterado** —
> `baseResumeId` segue **aceito**, mas deixou de ser usado como "referência de profundidade" (supersede essa
> parte do ADR-0022). `ResumeContentSchema`, renderer e guardrail **intactos**; invariante anti-alucinação intacto.
>
> 2026-05-31 — **Fatia 9 (ADR-0024/ADR-0025)** — mudanças **aditivas** (autenticação/infra).
> **ADR-0024/0025 (multiusuário):** o domínio (schemas Zod + rotas de negócio) **não muda**. Adições de
> infraestrutura: rota **`/api/auth/[...nextauth]`** (Auth.js — login OAuth Google/GitHub) e a página
> **`/login`**; o seam `getCurrentUserId()` passa a ler a **sessão real** (assíncrono; 401 sem sessão) e o
> banco migra **SQLite → Postgres** (`User` ganha os campos do adapter + modelos `Account`/`Session`/
> `VerificationToken`). `ResumeContentSchema`/renderer/guardrail e todas as rotas `/api/profile`,
> `/api/resumes*` e `/api/profile/import*` **inalterados**; invariante anti-alucinação intacto.
>
> 2026-05-31 — **Fatia 8 (ADR-0022)** — mudanças **aditivas**.
> **ADR-0022:** `GeneratedResume` ganha **`isDefault: boolean`** (`z.boolean().default(false)`; resposta de
> `GET /api/resumes` e `PATCH`) — currículo padrão do usuário (no máx. 1, garantido na escrita). **`PATCH
> /api/resumes/[id]`** passa a aceitar **`{ name?, isDefault?: true }`** (aditivo ao rename do ADR-0021; com
> `isDefault: true` marca como padrão, 404 se alheio/inexistente). **`GenerateRequestSchema`** ganha
> **`baseResumeId?: string`** (Modo 2): a rota carrega o conteúdo desse currículo — ou do padrão
> (`getDefaultResume`) na ausência — e o injeta no prompt do Modo 2 como **referência de profundidade**
> (bloco "CURRÍCULO PADRÃO DE REFERÊNCIA" no user prompt; **não** é fonte de fatos — o guardrail segue
> validando contra a base). O prompt do Modo 2 troca o viés de "enxugar" pela política **Equilibrado**
> (mantém experiências/maioria dos projetos, preserva profundidade dos bullets, 1–2 páginas). `ResumeContentSchema`,
> renderer e guardrail **inalterados**; invariante anti-alucinação intacto.
>
> 2026-05-30 — **Fatia 7 (ADR-0020/ADR-0021)** — mudanças **aditivas**.
> **ADR-0020:** o `ResumeContentSchema` ganha `languages` (`{ name, proficiency, sourceId? }[]`) e
> `courses` (`{ title, issuer, date, url?, sourceId? }[]`); o item de projeto ganha `bullets: string[]`
> e `techStack: string[]`. Modo 1 passa a ser **completo** (inclui tudo da base, não omite); Modo 2
> segue selecionando para a vaga. O guardrail (`validate-traceability.ts`) é **estendido sem
> afrouxar** o invariante: `checkNumbers` passa a varrer também os **bullets de projeto**;
> `project.techStack`, `languages[].name` e `courses[].title` viram **avisos** quando fora da base
> (idioma/curso por nome/título normalizado — **aviso, não erro forte**). Nenhum erro forte novo.
> **ADR-0021:** `GeneratedResume` ganha **`name` (string, editável)** — supersede a parte do ADR-0016
> que fixava "título do histórico = rótulo do modo" (default = rótulo do modo + data; **não** é o
> texto da vaga, invariante intacto); `GenerateRequestSchema` ganha **`name?: string`**. Três rotas
> novas: **`PATCH /api/resumes/[id]`** (renomeia), **`DELETE /api/resumes/[id]`** (exclui),
> **`DELETE /api/profile`** (limpa a base — apaga o `Profile`; cascade nas 6 listas). Invariante
> anti-alucinação e guardrail core **inalterados**.
>
> 2026-05-30 — **Fatia 6 (ADR-0019)** — nova rota
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
- `ResumeContentSchema` — **saída estruturada do LLM** (ver §3). **Fatia 7 (ADR-0020):** ganha
  `languages` (`{ name, proficiency, sourceId? }[]`) e `courses` (`{ title, issuer, date, url?,
  sourceId? }[]`); o item de projeto ganha `bullets: string[]` e `techStack: string[]`.
- `GenerateRequestSchema` — `{ mode: "STANDARD" | "JOB_ADAPTIVE", jobText?: string, name?: string }`
  (`jobText` obrigatório quando `mode === "JOB_ADAPTIVE"`; `name?` é o nome do currículo — ADR-0021,
  default no servidor = rótulo do modo + data).
- `TraceabilityReportSchema` — `{ errors: Issue[], warnings: Issue[] }`, onde
  `Issue = { field, value, reason }`.
- `GeneratedResumeSchema` — registro persistido (ver ERD). **Fatia 7 (ADR-0021):** ganha
  `name: string` (editável; default = rótulo do modo + data).

## 2. Route Handlers

| Método | Rota | Request | Response | Descrição |
|---|---|---|---|---|
| GET | `/api/profile` | — | `ProfileBundleSchema` | Lê a base de dados completa do usuário atual. |
| PUT | `/api/profile` | `ProfileBundleSchema` | `ProfileBundleSchema` | Cria/atualiza a base completa (upsert). |
| POST | `/api/profile/import` | `ProfileImportRequestSchema` (`{ rawText }`) | `ProfileBundleSchema` | Estrutura um dump de texto livre em um **rascunho** da base (LLM extrai, **não persiste**) para o usuário revisar. Variante tolerante no adapter (`fullName` pode vir vazio); `502` em `LLMError`. ADR-0018. |
| POST | `/api/profile/import/file` | `multipart/form-data` (campo `file`) | `ProfileBundleSchema` | Extrai o texto de um arquivo (PDF/DOCX/TXT) **no servidor** e reusa o **mesmo** pipeline da `/import` → rascunho tolerante **não persistido**. Sem schema Zod (corpo binário): whitelist de tipo + limite de tamanho. `400` (sem arquivo), `415` (tipo), `413` (tamanho), `422` (texto vazio — PDF imagem, sem OCR), `502` (`LLMError`). ADR-0019. |
| POST | `/api/resumes/generate` | `GenerateRequestSchema` | `GeneratedResumeSchema` | Gera currículo (Modo 1 ou 2): LLM → render → guardrail → persiste. `name?` opcional (default servidor). |
| GET | `/api/resumes` | — | `GeneratedResumeSchema[]` | Lista o histórico de currículos gerados (inclui `name`). |
| GET | `/api/resumes/[id]` | — | `GeneratedResumeSchema` | Carrega um currículo do usuário (tela de edição). **404** (id inexistente/alheio). ADR-0030. |
| PATCH | `/api/resumes/[id]` | `{ name?, isDefault?: true, contentJson? }` | `GeneratedResumeSchema` | Renomeia / define padrão / **edita o conteúdo** (≥1). Com `contentJson` (`ResumeContent`): re-renderiza o `.tex` (renderer puro, **sem IA**, **sem guardrail** — edição manual) e zera o `traceabilityReport`. **200**; **400** (Zod); **404** (id inexistente/alheio). ADR-0021/0022/0030. |
| DELETE | `/api/resumes/[id]` | — | — (**204** sem corpo) | Exclui o currículo do usuário. **404** (id inexistente/alheio). ADR-0021. |
| GET | `/api/resumes/[id]/download` | — | `text/plain` (`.tex`) | Baixa o `.tex` cacheado (`Content-Disposition: attachment`). |
| DELETE | `/api/profile` | — | — (**204** sem corpo) | Limpa a base: apaga o `Profile` (cascade nas 6 listas); `getProfileBundle` volta a `emptyBundle()`. Idempotente. ADR-0021. |

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
  projects:    { sourceId?, title, description, url?, bullets: string[], techStack: string[] }[],
  languages:   { name, proficiency, sourceId? }[],        // ADR-0020
  courses:     { title, issuer, date, url?, sourceId? }[], // ADR-0020
  extras?:     string[],              // extra-curricular
  leadership?: string[],
}
```

- Cada item de `experience`/`projects` traz `sourceId` apontando para o item real da base
  → o renderer e o guardrail conseguem rastrear. `languages`/`courses` têm `sourceId` opcional.
- **Fatia 7 (ADR-0020):** `projects[]` ganha `bullets`/`techStack`; há novas seções `languages` e
  `courses`. Guardrail: `checkNumbers` varre também `projects[].bullets[]`; `techStack`,
  `languages[].name` e `courses[].title` fora da base viram **avisos** (não erro forte). Modo 1
  passa a incluir **tudo** da base; Modo 2 segue selecionando para a vaga.
- O renderer (`render-latex.ts`) mapeia esse objeto nas seções do template faangpath
  (`OBJECTIVE`, `Education`, `SKILLS`, `EXPERIENCE`, `PROJECTS`, **`LANGUAGES`**, **`COURSES`**,
  `Extra-Curricular`, `Leadership`), aplicando `escapeLatex()` em todo texto. (Os rótulos em PT-BR
  e a cor do link são detalhes do renderer/preâmbulo — Workstream 1, fora do contrato.)

> **Nota (2026-05-29) — cabeçalho separado do `ResumeContent`.** O `ResumeContentSchema`
> NÃO contém bloco de cabeçalho (nome/contato). O cabeçalho do `.tex` (`\name{...}` e
> `\address{...}`) vem **verbatim do `Profile`** (nome + linhas de contato: location, phone,
> email, linkedin, github, website — todos opcionais, omitindo vazios), também escapado por
> `escapeLatex()`. Por isso a assinatura do renderer é
> `renderResume(content: ResumeContent, header: Profile): string`. Razão: contato é dado
> factual do `Profile`, não conteúdo gerado/selecionado pelo LLM — fica fora do `ResumeContent`
> para não duplicar dados nem abrir espaço para o modelo divergir do cabeçalho real. Coerente
> com o invariante anti-alucinação e com ADR-0007; não altera schema (contrato congelado).
