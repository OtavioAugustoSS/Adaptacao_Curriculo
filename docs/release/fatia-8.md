# Relatório de release — Fatia 8 · Currículo padrão + base na geração + adaptação mais rica

> Documento **committável** (vive no repo). Continuação de `docs/release/fatia-7.md`. Atualizado: 2026-05-31.

## Estado atual

- ✅ **Fatia 8**, implementada **direto pelo lead** (a pedido do dono — sem o Agent Team de 5 papéis nesta
  fatia), mantendo o rigor: **ADR-0022 (gate) escrito ANTES do código**, contrato aditivo + nota datada,
  testes por comportamento, e os **dois gates** rodados à mão.
- Nasceu do teste real do dono: o **Modo 2 (adaptar à vaga) cortava demais**. **Diagnóstico (leitura do
  `prisma/dev.db`):** a base estava **rica** (DruSign 5 bullets, Workana 5 bullets, 3 projetos com
  bullets+stack); o Modo 1 saía completo (~6,1 KB de `.tex`), mas o Modo 2 numa vaga PHP saía ~3,4 KB —
  perdia 2 projetos e metade dos bullets. Causa: o prompt do Modo 2 instruía "omita o que não agrega" e
  "currículo mais curto é melhor que inflado".
- **US-17** (currículo padrão + base na geração + destaque), **US-18** (adaptação rica/equilibrada com
  referência de profundidade).
- **Verificado à mão:** `tsc --noEmit` limpo · `npm test` **330/330** (29 arquivos; 305 antes → 330) ·
  `npm run build` OK (**13 rotas**) · migração `20260531030210_resume_is_default` versionada (com backfill).

## Decisões do dono (coletadas antes do plano)
- **Base p/ adaptar = "Referência de profundidade":** a IA continua puxando os FATOS da base (guardrail
  intacto), mas recebe o currículo padrão JUNTO como referência de completude/estrutura — sem 2º rewrite.
- **Estilo de adaptação = "Equilibrado":** mantém tudo minimamente relevante, corta só o claramente fora;
  ~1–2 páginas; bullets com profundidade (condensa só os menos relevantes).

## O que mudou (por área)

| Área | Entrega |
|------|---------|
| **Currículo padrão** | `GeneratedResume.isDefault` (Prisma + `GeneratedResumeSchema`, aditivo, default `false`). Migração com **backfill** (por usuário, marca o STANDARD mais recente como padrão; no banco real "Curriculo teste" virou o padrão). Repo: `setDefaultResume` (marca o alvo; zera os outros; 404 se id alheio sem deixar o usuário sem padrão), `getDefaultResume` (explícito + fallback STANDARD mais recente), e `createGeneratedResume` **auto-default** quando o usuário tem zero currículos. |
| **Base na geração** | `GenerateRequestSchema.baseResumeId?` (Modo 2). `generate/route.ts`: carrega `baseResumeId` (ou `getDefaultResume()`) e injeta o `contentJson` como `baseContent`. `/gerar`: seletor **"Basear no currículo padrão"** (STANDARD; padrão pré-selecionado; destaque "Em uso"); sem STANDARD → hint + fallback (deriva da base). |
| **Adaptação mais rica** | `JOB_ADAPTIVE_CV_SYSTEM_PROMPT` troca o viés de enxugar pela política **Equilibrado** (manter experiências/maioria dos projetos; profundidade problema→ação→impacto→stack; 1–2 páginas; ATS + humano). `buildJobAdaptiveCvPrompts(...baseContent?)` injeta o bloco **"CURRÍCULO PADRÃO DE REFERÊNCIA"** (não é fonte de fatos). Modo 1 ganha reforço leve de profundidade. `select-content.generateJobAdaptiveContent(...baseContent?)`. |
| **PATCH + destaque** | `PATCH /api/resumes/[id]` aceita `{ name?, isDefault?: true }` (aditivo ao rename; refine exige pelo menos um; 404 se alheio). `/curriculos`: badge **"★ Padrão"** + card destacado (`.cv-item.is-default`) + ação **"Definir como padrão"**. |

## Decisão-chave desta fatia
- **ADR-0022** — Currículo padrão (`isDefault`) + adaptação ancorada em **referência de profundidade**.
  Justifica **não** adaptar a partir do CV pronto (evita 2º rewrite/drift); o guardrail, o
  `ResumeContentSchema` e o renderer **não mudam**; invariante anti-alucinação **intacto**. Unicidade do
  padrão garantida **na escrita** (não por constraint de banco — MVP/SQLite).

## Verificação (à mão)
- `node node_modules/typescript/bin/tsc --noEmit` → **No errors** (incl. tests/).
- `npm test` → **330 passed (29 arquivos)** — +25 testes (repo setDefault/getDefault/auto-default; PATCH
  isDefault; prompt baseContent + filosofia; select-content; rota generate baseResumeId; schemas).
- `npm run build` → **OK**, 13 rotas.
- Migração `resume_is_default` aplicada + backfill conferido no banco real (exatamente 1 padrão por usuário).
- **Renderer já suportava** multi-página + projeto com todos os bullets + linha "Stack:" (desde ADR-0020) —
  sem mudança necessária (Parte D do plano: só verificação).

## Pendência manual (dono)
- **Validação e2e com a NIM real** (não rodada nesta sessão — usa a chave/budget do dono): com `next dev`,
  gerar um Modo 1 (vira o padrão), depois Modo 2 selecionando esse padrão + colando a vaga PHP → conferir
  que o `.tex` fica claramente mais rico (≥2 projetos, bullets profundos, linhas "Stack:") que os 3,4 KB de
  antes. Timeout já é 180s no `nim.ts`.
- **Renomear o produto (CV-Adapter):** deferido — sugestões de nome no plano da fatia; troca real é outra fatia.

## Riscos / limites conhecidos (aceitos)
- **`prisma generate` no Windows dá EPERM** enquanto algo segura o `query_engine-*.dll.node` (gotcha
  conhecido); o `.d.ts`/`.js` regeneram (o `tsc` enxergou `isDefault`). Inofensivo.
- **Unicidade do padrão na aplicação** (não no banco). OK no MVP single-user; multiusuário → índice parcial
  único `(userId) WHERE isDefault` no Postgres.
- **`main` segue à frente de `origin/main` sem push** — o dono dá o push. Esta fatia ainda **não foi
  commitada** (lead propõe o commit; não commita sozinho, salvo pedido explícito do dono).
