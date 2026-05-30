# Relatório de release — Fatia 5 · Import de perfil por dump (IA) + Formação "em andamento"

> Documento **committável** (vive no repo) para continuar o projeto em qualquer máquina.
> Continuação de `docs/release/fatia-4.md`. Consolidação do lead (template-workflow §6.2).
> Atualizado: 2026-05-30.

## Estado atual

- ✅ **Fatia 5 — duas melhorias funcionais**, via Agent Team de **5 papéis**
  (`cv-adapter-development-team`: lead + product-owner + architect + **fullstack** + qa —
  o padrão das Fatias 1–3, não o split front/back da Fatia 4):
  - **US-11** — **Importar perfil por dump com IA:** painel "Importar com IA" no topo do
    `/perfil`; o usuário cola um texto livre (currículo antigo, LinkedIn, anotações) →
    `POST /api/profile/import` → a IA **estrutura** um rascunho → **MESCLA** no formulário →
    o usuário revisa e usa o **Salvar** existente. O import **não persiste**.
  - **US-12** — **Formação "em andamento":** campo `Education.current` (espelha
    `Experience.current`) + toggle "Cursando (em andamento)" na Formação que desabilita "Fim";
    o `.tex` mostra **"Atual"** no período da formação.
- 🏁 **MVP + UI + Fatia 5 completos:** as 9 US originais (US-01…09) + US-10 (visual) +
  US-11/US-12 (esta fatia).
- **Verificado à mão (lead):** `tsc --noEmit` limpo · `npm test` **211/211** (22 arquivos;
  165 da Fatia 4 intactos + **46 novos**) · `npm run build` OK (**11 rotas**, nova
  `/api/profile/import`) · migração Prisma `20260530210237_education_current` aplicada e
  versionada.

## O que mudou

### US-11 — Importar perfil por dump com IA
| Camada | Entrega |
|--------|---------|
| **Contrato** | `ProfileImportRequestSchema = { rawText: string (min 1) }`; rota nova `POST /api/profile/import` → response `ProfileBundleSchema` (rascunho, **não persistido**). `ImportProfileBundleSchema` (variante **tolerante**: `profile.fullName` pode ser `""`). |
| **LLM** | `LLMProvider.extractProfileFromDump` (extensão **aditiva**; `generateResumeContent` intocado), implementado no `NimProvider` validando contra a variante tolerante. Prompt novo `parse-dump.ts` ("estruture só o texto, NÃO invente, deixe vazio o ausente, saída sem ids, PT-BR"). Módulo `extract-profile.ts` (ponte texto→rascunho, não persiste). |
| **Rota** | `import/route.ts`: 400 (Zod), 502 (`LLMError`), 200 (rascunho). **Não chama repo de escrita.** |
| **UI** | Painel colapsável no topo do `/perfil` (textarea + "Preencher com IA"; estados ocioso/enviando/erro). Sucesso → `mergeDraft`: **acrescenta** itens às 6 listas (nada apagado) e preenche o cabeçalho **só onde estiver vazio** (não sobrescreve). Depois o usuário revisa e usa o **Salvar** (`PUT /api/profile`). |

### US-12 — Formação "em andamento"
| Camada | Entrega |
|--------|---------|
| **Schema/DB** | `current: z.boolean().default(false)` no `EducationSchema`; `current Boolean @default(false)` no model Prisma `Education` (migração com `DEFAULT false`, sem backfill). `profile-repo` faz o round-trip de `current`. |
| **UI** | Toggle "Cursando (em andamento)" na Formação (espelha "Emprego atual"); `disabledWhen` desabilita "Fim" quando ligado; `summarize` usa `e.current` no período do card. |
| **.tex** | "Atual" sai do **LLM formatando o `period`** (igual a `Experience`) — instrução adicionada aos dois prompts de CV (`standard-cv.ts`, `job-adaptive-cv.ts`). **`ResumeContentSchema` e `render-latex.ts` intocados.** Cursos não mudam. |

## Trabalho do time nesta fatia

- **architect-agent** — **ADR-0018** (gate, escrito ANTES do código): as 3 mudanças aditivas
  ao contrato congelado (campo `Education.current`; rota `POST /api/profile/import`; método
  `extractProfileFromDump`), o invariante **EXTRAÇÃO ≠ GERAÇÃO** (o guardrail de
  rastreabilidade não se aplica ao import — proteção = prompt restritivo + revisão humana), a
  decisão de manter **`ResumeContentSchema` congelado** (§6) e o **edge case do `fullName`**
  (variante tolerante no import × `PUT` estrito, §5). Estendeu a interface `LLMProvider`,
  adicionou a nota datada ao `docs/api-contract.md` (+ linha na §2) e a entrada no índice de
  ADRs. **Passada final de aderência ao contrato: aprovada, zero divergências.**
- **product-owner-agent** — **US-11** e **US-12** (PT-BR, formato das US-08/US-10), critérios
  de aceite por estado, invariantes explícitos, fora-de-escopo. As `[DECISÃO PENDENTE]` finas
  (estado inicial do painel; rótulo "Atual"; feedback do merge) ficaram com defaults sensatos.
- **fullstack-agent** — implementou tudo após o gate: schema + migração → LLM
  (provider/nim/parse-dump/extract) + rota import → UI (painel + merge + toggle) + instrução
  "Atual" nos prompts. `tsc` limpo; manteve os 165 verdes. Desvio bem sinalizado: 4 fixtures
  de teste pré-existentes ganharam `current: false` (mecânico — `current` virou campo presente
  no tipo de saída do Zod, como já era em Experience).
- **qa-agent** — **46 testes novos** (total **211**), sem regressão e sem dep nova: schema
  `current` (default/true), `ProfileImportRequestSchema`, tolerante×estrito (prova ADR §5),
  rota import (400/502/500/200 + **assert que não persiste**), `extract-profile`, travas do
  prompt `parse-dump`, render "Atual" (passthrough), round-trip de `current` no repo, e o novo
  método do `nim`. **Nenhum bug de produção.**
- **lead** — coordenou por mensagem; verificou **à mão** o gate (provider + ADR), a
  implementação (todos os arquivos-núcleo lidos), e rodou `tsc`/`npm test`/`build` + conferiu a
  migração versionada; consolidou este relatório. Não absorveu PO/architect/fullstack/qa.

## Decisão-chave desta fatia
- **ADR-0018** — Fatia 5: import por dump + `Education.current`. Três mudanças **aditivas** ao
  contrato congelado; **`ResumeContentSchema` permanece congelado** (o "Atual" vem do `period`,
  como em Experience); **extração ≠ geração** (sem guardrail de rastreabilidade no import,
  protegido por prompt restritivo + revisão humana); `fullName` tolerante no rascunho do import
  e estrito no `PUT`.

## Verificação (lead, à mão — Agent Teams é experimental)
- `npx tsc --noEmit` → **No errors**.
- `npm test` → **211 passed (22 arquivos)**; os 165 da Fatia 4 intactos (zero regressão).
- `npm run build` (`.next`) → **OK**, 11 rotas (nova `/api/profile/import`).
- `prisma/migrations/20260530210237_education_current/migration.sql` → table-redefine do SQLite
  preservando dados, `current BOOLEAN NOT NULL DEFAULT false`, índice recriado.
- Architect validou aderência ao contrato congelado (6 pontos, com linhas) — aprovado.

## Riscos / limites conhecidos (aceitos)
- **Import depende da qualidade da extração do LLM.** A garantia anti-invenção do import é
  **prompt restritivo + revisão humana** (não o guardrail de rastreabilidade, que não se aplica
  — não há base de referência). O usuário **revisa antes de salvar**; o `PUT` continua estrito.
- **Sem dedup automático** na mesclagem: o usuário remove duplicatas na revisão (fora de
  escopo, decisão do dono).
- **Sem testes de componente** (mantido da Fatia 4 — sem lib de render): o painel de import e o
  toggle foram cobertos por testes de **lógica/contrato** (schema, rota, prompt, merge via
  `mergeDraft` puro) e validados manualmente no fluxo. Smoke real com a NIM é opcional (dono).
- **`fullName` tolerante só no rascunho** do import: custo é manter uma 2ª variante de validação
  (`ImportProfileBundleSchema`) no adapter — aceito (ADR-0018 §5).

## Pendências
- **Nenhuma** bloqueante. (Opcionais, decisão do dono: estado inicial do painel aberto quando a
  base está vazia; feedback do merge com contagem por lista; smoke test real do import com a NIM.)

## Versão executiva (stakeholders)
- O CV-Adapter agora tem **onboarding acelerado**: colar um texto e deixar a IA preencher o
  perfil para você revisar — **sem a IA inventar nada** (ela só estrutura o que está no texto, e
  você revisa antes de salvar). E a Formação aceita **"em andamento"**, que aparece como "Atual"
  no `.tex`.
- 211 testes verdes, build OK, **contrato congelado respeitado** (mudanças apenas aditivas; o
  núcleo do guardrail intocado).

## Próximo passo
- **Commitar a Fatia 5** (proposta abaixo) — o dono commita.
- Smoke test real opcional do import (chave NIM `nvapi-`): colar um dump e confirmar que a IA
  estrutura só o que está no texto e deixa o resto vazio.

## Commit proposto (o dono commita)
`feat: Fatia 5 — import de perfil por dump (US-11) + Formação em andamento (US-12), ADR-0018`

**Novos:** `src/lib/schemas/profile-import.ts`, `src/server/llm/prompts/parse-dump.ts`,
`src/server/profile/extract-profile.ts`, `src/app/api/profile/import/route.ts`,
`prisma/migrations/20260530210237_education_current/`, `tests/profile-import-schema.test.ts`,
`tests/profile-import-route.test.ts`, `tests/extract-profile.test.ts`,
`tests/parse-dump-prompt.test.ts`, `tests/education-current.test.ts`,
`docs/adr/0018-import-perfil-dump-education-current.md`,
`docs/user-stories/US-11-importar-perfil-dump-ia.md`,
`docs/user-stories/US-12-formacao-em-andamento.md`, este relatório.

**Modificados:** `src/lib/schemas/profile.ts`, `src/lib/schemas/index.ts`,
`prisma/schema.prisma`, `src/server/data/profile-repo.ts`, `src/server/llm/provider.ts`,
`src/server/llm/nim.ts`, `src/server/llm/prompts/standard-cv.ts`,
`src/server/llm/prompts/job-adaptive-cv.ts`, `src/app/(dashboard)/perfil/page.tsx`,
`docs/api-contract.md`, `docs/adr/README.md`, `docs/user-stories/README.md`,
`tests/profile-repo.test.ts`, `tests/nim-provider.test.ts`, `tests/prerequisite.test.ts`,
`tests/generate-route.test.ts`, `tests/validate-traceability.test.ts`.
