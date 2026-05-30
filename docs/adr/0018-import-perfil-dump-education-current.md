# 0018 — Fatia 5: import de perfil por dump + `Education.current`

- **Status:** Accepted
- **Data:** 2026-05-30

## Contexto

O MVP (US-01…US-09) e o redesign visual ([[0017-tailwind-css-mapeamento-tokens-fatia-4]])
estão prontos. O dono pediu duas melhorias funcionais que formam a **Fatia 5** (plano aprovado
em `~/.claude/plans/tem-algumas-mudan-as-melhorias-que-velvet-finch.md`):

1. **Dump → IA preenche o perfil.** Hoje o `/perfil` é 100% manual (cabeçalho + 6 listas). O dono
   quer **colar um texto livre** (currículo antigo, perfil do LinkedIn, anotações) e a IA
   **estruturar isso na base** para ele revisar e salvar — acelera o onboarding. Decisão travada:
   o resultado **mescla** com o que já está no formulário (nada é perdido); o painel "Importar com
   IA" fica **no topo do `/perfil`** e preenche o próprio formulário (sem passar estado entre páginas).
2. **Formação "em andamento".** O `EducationSchema` (`src/lib/schemas/profile.ts:30`) **não tem**
   o campo `current` — ao contrário de `ExperienceSchema` (`:23`, que tem). Logo, não dá para marcar
   uma formação **ainda em curso**. A seção **Cursos** segue para cursos concluídos; o gap é só o
   indicador "cursando" na **Formação**, que deve renderizar "Atual" no `.tex`.

Ambas as features tocam o **contrato congelado** (`docs/api-contract.md`,
[[0011-contrato-api-zod-congelado]]) → exigem gate do architect: ADR + nota datada no contrato.

A força central a equilibrar: o invariante anti-alucinação ([[0008-guardrail-anti-alucinacao-3-camadas]],
[[0007-llm-json-validado-renderer-deterministico]]) proíbe a IA de inventar fatos. Mas o **import por
dump não é geração de currículo** — é o usuário estruturando o **próprio texto** na **própria base**.
É preciso decidir como acomodar isso sem enfraquecer o guardrail da geração, e como expor "Atual" na
Formação **sem mexer no `ResumeContentSchema`**, que é o núcleo do guardrail e está congelado.

## Decisão

### 1. Campo novo `current: boolean` em `EducationSchema` (e no Prisma)

Adicionamos `current: z.boolean().default(false)` ao `EducationSchema`, **espelhando**
`ExperienceSchema.current` (`profile.ts:23`). O modelo Prisma `Education` ganha
`current Boolean @default(false)` (migração `prisma migrate dev`). O `default(false)` mantém os
registros existentes válidos sem backfill. Como todos os campos do bundle já fluem na base
serializada do prompt, o `current` da Formação chega ao LLM automaticamente.

### 2. Rota nova `POST /api/profile/import` — devolve rascunho NÃO persistido

Adicionamos um Route Handler:

- **Request:** `{ rawText: string }` (`min(1)`) — novo `ProfileImportRequestSchema`.
- **Response:** `ProfileBundleSchema` (reusa o schema existente; todos os `id` já são opcionais, então
  o rascunho sem ids valida). É um **rascunho**, devolvido ao formulário para o usuário revisar.
- **Não persiste.** O endpoint só estrutura e responde; quem salva é o `PUT /api/profile` existente,
  após a revisão humana. Erros: `400` (Zod no request) e `502` (`LLMError`), envelope padrão
  `{ error: { code, message, details? } }`.

### 3. Extensão ADITIVA do `LLMProvider` — `extractProfileFromDump`

Estendemos a **interface** `LLMProvider` (`src/server/llm/provider.ts`) com um método novo,
**sem tocar** em `generateResumeContent` (que já está validado em produção):

```ts
extractProfileFromDump(params: GenerateProfileParams): Promise<ProfileBundle>;
```

`GenerateProfileParams` tem o **mesmo formato** de `GenerateResumeParams` (`{ system, user, modelId? }`)
— os prompts são montados fora da camada e entram como strings. O adapter valida a saída do modelo
contra `ProfileBundleSchema` (variante tolerante — ver item 5); saída não-conforme → `LLMError("validation")`
→ 502, sem retry (mesma política da geração, [[0012-saida-estruturada-json-schema-llmprovider]]).

### 4. Invariante: EXTRAÇÃO ≠ GERAÇÃO — o guardrail de rastreabilidade NÃO se aplica ao import

A geração de currículo é `base → .tex` e é guardada em 3 camadas
([[0008-guardrail-anti-alucinacao-3-camadas]]), sendo a 3ª o `validate-traceability.ts`, que compara a
**saída do LLM × a base** e falha se a IA inventou uma entidade.

O **import por dump é outro fluxo**: `texto do usuário → rascunho da base`. Aqui **não existe base de
referência** contra a qual comparar (a base é justamente o que está sendo populada), então
`validate-traceability.ts` **não se aplica** — rodá-lo seria comparar a saída contra o vazio.

A proteção do import é dupla e suficiente para o caso:

1. **Prompt restritivo:** o system instrui "ESTRUTURE apenas o que está no texto do próprio usuário;
   NÃO invente nem infira; deixe vazio o que não aparecer; saída JSON no formato `ProfileBundle` sem
   ids; PT-BR". É o mesmo espírito anti-alucinação, aplicado à extração.
2. **Revisão humana antes de persistir:** o endpoint **não salva** — devolve rascunho ao formulário; o
   usuário revisa, corrige e só então usa o `PUT /api/profile` existente. O humano é a barreira final.

O invariante de produto ("a IA nunca inventa informação") **continua íntegro**: no import o usuário
fornece o próprio texto e revisa o resultado, então nada é inventado *para dentro* da base sem o aval
dele. A geração de currículo, o guardrail e o invariante **não mudam**.

### 5. Edge case do `fullName` — adapter valida o rascunho com variante tolerante

`ProfileSchema.fullName` é `.min(1)` (`profile.ts:102`). Um dump **sem nome** (anotações soltas, lista
de skills) faria `ProfileBundleSchema.parse` falhar no adapter → `LLMError("validation")` → **502
espúrio**, embora a extração tenha sido perfeitamente legítima.

**Decisão:** o adapter valida o rascunho do import com uma **variante tolerante** do bundle —
`ProfileBundleSchema` com o `profile` aceitando `fullName` **vazio/ausente** (ex.: um
`ImportProfileBundleSchema` cujo `profile` deriva de `ProfileSchema` com
`.extend({ fullName: z.string().default("") })` ou equivalente). Assim:

- O import **nunca** retorna 502 só porque o dump não trazia nome.
- A resposta da rota continua **estruturalmente** um `ProfileBundle` (campos extra ausentes, `fullName`
  possivelmente `""`), compatível com o formulário do `/perfil`.
- A barreira do `fullName` obrigatório **permanece** onde importa: no **`PUT /api/profile`**, que segue
  validando `ProfileBundleSchema` estrito. O usuário preenche o nome na revisão; salvar sem nome continua
  bloqueado. Movemos a obrigatoriedade do nome do *rascunho* para a *persistência*, sem afrouxar a base.

A regra para o fullstack é inequívoca: **a rota `/api/profile/import` valida com a variante tolerante;
o `PUT /api/profile` continua estrito.** A resposta do import é tipada como `ProfileBundle` (o `fullName`
pode vir `""`); o prompt deve, quando o nome aparecer no texto, preenchê-lo.

### 6. "Atual" na Formação sai do LLM formatando `period` — `ResumeContentSchema` SEGUE CONGELADO

O `ResumeContentSchema` (`src/lib/schemas/resume-content.ts`) é o núcleo do guardrail e está congelado.
**Não o alteramos.** O "Atual" da Formação no `.tex` segue o **mesmo mecanismo já usado por
`Experience`**: o LLM emite o intervalo **já formatado** na string `period`, e o renderer o imprime
verbatim.

Comprovação no código atual:
- `ResumeEducationItemSchema.period` já é `z.string().optional()` (`resume-content.ts:24`) e o renderer
  imprime `edu.period` escapado, sem interpretá-lo (`render-latex.ts:87`).
- É exatamente o que `Experience` faz: `ResumeExperienceItemSchema.period` é uma string pré-formatada
  (o próprio comentário em `resume-content.ts:32` exemplifica `"Jan 2020 — Atual"`), impressa verbatim
  em `render-latex.ts:138`.

Fluxo: o novo `Education.current` flui na **base serializada do prompt** (item 1); uma **instrução de
prompt** manda formatar o `period` como `"… – Atual"` quando `current` for verdadeiro (espelhando a
instrução que já existe para `Experience`). O `render-latex.ts` **não muda estruturalmente**.

**Por que NÃO adicionar `current`/datas ao `ResumeEducationItemSchema`:** seria divergir do padrão de
`Experience` (cujo `period` já é a string canônica do intervalo, sem `current` no item de saída),
introduzir lógica de formatação de data no renderer determinístico (hoje ele só imprime `period`), e —
o mais grave — **mexer no contrato congelado §3**, o schema do guardrail, por algo que o `period` já
resolve. Manter o `ResumeContentSchema` intocado preserva o gate mais sensível do projeto.

## Consequências

- **Onboarding muito mais rápido:** colar um texto e revisar, em vez de digitar 6 listas à mão.
- O contrato muda de forma **mínima e aditiva**: um campo booleano com default, uma rota nova que reusa
  um schema existente, e um método novo na interface do provider. Nada existente quebra; sem backfill.
- O **núcleo do guardrail (`ResumeContentSchema`) permanece congelado** — o gate mais sensível não é
  tocado. A geração de currículo, o `validate-traceability.ts` e o invariante anti-alucinação seguem
  idênticos.
- A distinção **extração ≠ geração** fica documentada: futuros fluxos de "popular a base a partir do
  próprio material do usuário" reusam esta racional (prompt restritivo + revisão humana, sem
  traceability), sem confundir com a geração guardrailada.
- O `fullName` deixa de ser obrigatório **no rascunho** do import (variante tolerante), mas continua
  obrigatório **na persistência** (`PUT` estrito) — sem 502 espúrio e sem afrouxar a base salva. O custo
  é manter uma segunda variante de validação só para o import (pequena superfície extra no adapter).
- O LLM passa a ter **dois contratos de saída** (`ResumeContent` na geração, `ProfileBundle` no import).
  São validados separadamente; o `LLMError` é o mesmo mecanismo. Pequeno aumento de superfície da camada
  de IA, isolado atrás da interface.
- "Em andamento" fica **só na Formação**; Cursos seguem com `date` string livre (que já aceita "Em
  andamento"). Decisão de escopo coerente com o plano — não generalizamos o booleano para Cursos.

## Alternativas consideradas

- **Persistir o dump direto (sem rascunho/revisão):** rejeitado — violaria a revisão humana, que é
  metade da proteção anti-alucinação do import; e sobrescreveria a base sem o aval do usuário.
- **Rodar `validate-traceability.ts` também no import:** rejeitado — não há base de referência no import
  (ela está sendo populada); comparar a saída contra o vazio falharia tudo ou seria no-op. A proteção
  correta aqui é prompt restritivo + revisão humana, não rastreabilidade.
- **Sobrecarregar `generateResumeContent` (um método para gerar e extrair):** rejeitado — acoplaria dois
  contratos de saída distintos (`ResumeContent` × `ProfileBundle`) num método já validado em produção,
  com risco de regressão. A extensão **aditiva** isola o novo fluxo.
- **Manter `fullName` `.min(1)` também no rascunho do import:** rejeitado — geraria 502 espúrio para
  dumps legítimos sem nome (anotações, lista de skills). A variante tolerante no rascunho + estrito no
  `PUT` resolve sem afrouxar a base salva.
- **Adicionar `current: boolean` (ou datas) ao `ResumeEducationItemSchema`:** rejeitado — mexeria no
  contrato congelado §3 (núcleo do guardrail), divergiria do padrão de `Experience` (que resolve "Atual"
  pela string `period`) e exigiria lógica de data no renderer. O `period` já cobre o caso.
- **Endpoint de import por GET/SSE com streaming:** rejeitado — overkill para o MVP; o volume é um texto
  por vez, single-user. POST síncrono devolvendo o rascunho é suficiente.
- **"Em andamento" também em Cursos:** rejeitado (fora de escopo do plano) — o campo `date` livre de
  Curso já aceita "Em andamento" textualmente; não há gap a fechar lá.
