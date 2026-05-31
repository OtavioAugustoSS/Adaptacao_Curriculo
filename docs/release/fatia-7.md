# Relatório de release — Fatia 7 · Geração completa/fiel + gestão de currículos + limpeza da base

> Documento **committável** (vive no repo). Continuação de `docs/release/fatia-6.md`.
> Consolidação do lead (template-workflow §6.2). Atualizado: 2026-05-31.

## Estado atual

- ✅ **Fatia 7**, via Agent Team de **5 papéis** (lead + product-owner + architect + fullstack + qa).
  Nasceu do teste real do dono com o próprio currículo: a geração saía incompleta e faltavam
  funcionalidades de gestão. **Diagnóstico do lead** (código + PDF original + leitura do banco): a base
  estava completa; a perda era **estrutural no `ResumeContentSchema`** (sem idiomas/cursos; projeto sem
  bullets/stack) + títulos em inglês + links rosa + ausência de ver/copiar/nomear/editar/excluir.
- **US-14** (geração completa e fiel + PT-BR + links discretos), **US-15** (gestão dos currículos),
  **US-16** (limpar base + import substituindo).
- **Verificado à mão (lead):** `tsc --noEmit` limpo · `npm test` **305/305** (29 arquivos; 245 antes →
  305) · `npm run build` OK (**13 rotas**, nova `/api/resumes/[id]`) · migração
  `20260531005650_resume_name` versionada.

## O que mudou (por workstream)

| WS | Entrega |
|----|---------|
| **1. Geração fiel** | `ResumeContentSchema` enriquecido (`languages`, `courses`, e `ProjectItem` ganha `bullets`+`techStack`, todos `.default([])`). `render-latex`: títulos **PT-BR** (OBJETIVO/FORMAÇÃO/HABILIDADES/EXPERIÊNCIA/PROJETOS/IDIOMAS/CURSOS E CERTIFICAÇÕES/ATIVIDADES EXTRACURRICULARES/LIDERANÇA), projeto com **bullets (itemize) + linha "Stack:"**, seções **IDIOMAS** e **CURSOS** (omitidas se vazias). Preâmbulo: `\definecolor{cvlink}{HTML}{1F3A5F}` + `\hypersetup` (links **azul-marinho discreto**, não rosa). Prompts: Modo 1 **COMPLETO** (não omite), Modo 2 emite os campos novos, parse-dump reforça completude. Guardrail estendido **sem afrouxar** (ADR-0020 §3): `checkNumbers` varre bullets de projeto; `techStack`/idioma/curso fora da base → **aviso** (nenhum erro forte novo). |
| **2. Overleaf** | `src/lib/overleaf.ts` (`OVERLEAF_PROJECT_URL`); botão **"Abrir no Overleaf"** no preview do `/gerar` e nos cards do `/curriculos`. |
| **3. Ver/copiar** | `/curriculos`: botão **"Ver / copiar"** por item → expande `<TexCode>` + Copiar (sem nova chamada; `texOutput` já vem no `GET /api/resumes`). |
| **4. Gestão** | `GeneratedResume.name` (Prisma + schema + migração com **backfill**); `GenerateRequest.name?`; repo `rename`/`delete` + `name` no create (default = rótulo do modo + data); rota nova `PATCH/DELETE /api/resumes/[id]` (200/204/400/404); `/gerar` campo "Nome do currículo"; `/curriculos` nome como título + Renomear + Excluir. |
| **5. Limpar/substituir** | `DELETE /api/profile` → `clearProfile()` (apaga Profile; cascade nas 6 listas; **idempotente 204**; histórico de currículos **preservado** — referencia User, não Profile). `/perfil` botão **"Limpar base"** (confirmação). Painel import: toggle **Mesclar / Substituir** (Substituir → `setBundle(draft)` nos dois fluxos, texto e arquivo). |

## Decisão-chave desta fatia
- **ADR-0020** — `ResumeContent` enriquecido (geração completa e fiel): campos novos **aditivos**; Modo 1
  completo; regra exata de rastreabilidade dos novos campos (idioma/curso/techStack → **aviso**, não erro
  forte; número em bullet de projeto → aviso). Invariante anti-alucinação **intacto** nos dois modos.
- **ADR-0021** — Gestão de currículos + limpar base: `GeneratedResume.name` editável (supersede em parte o
  ADR-0016 — "título = rótulo do modo"; o `name` **não** é a vaga); 3 rotas novas. Limpar base **preserva**
  os currículos gerados.

## Trabalho do time
- **architect** — ADR-0020 + ADR-0021 + nota datada no contrato (§1/§2/§3) + índice (ADR-0016 marcado
  parcialmente Superseded). Fixou a regra do guardrail para os campos novos. Tudo aditivo.
- **product-owner** — US-14/15/16 (PT-BR), critérios por estado; cor dos links e cascade (preserva currículos)
  travados em texto.
- **fullstack** — 5 workstreams; source `tsc` limpo. Resolveu o **backfill da migração** (`name` NOT NULL em 4
  registros antigos; gotcha real: o SQLite guarda DateTime como epoch **ms** → `strftime(... "createdAt"/1000,
  'unixepoch')`). Deixou os testes do contrato antigo para o qa (correto).
- **qa** — **305 testes** (245→266 consertando o contrato aditivo → 305 com cobertura nova): render PT-BR +
  projeto bullets/stack + IDIOMAS/CURSOS + hypersetup; guardrail (avisos novos, nenhum erro forte novo); schemas;
  rotas PATCH/DELETE resumes/[id] + DELETE profile; prompts; `defaultResumeName`. **Zero bug de produção.**
- **lead** — diagnóstico inicial (leitura do banco + PDF), coordenação, verificação à mão de cada gate;
  pegou a **segurança LaTeX** do título com `&` (corrigido p/ "CURSOS E CERTIFICAÇÕES") e confirmou que o
  cascade preserva os currículos; consolidou este relatório.

## Verificação (lead, à mão — Agent Teams é experimental)
- `npx tsc --noEmit` → **No errors** (incl. tests/).
- `npm test` → **305 passed (29 arquivos)**.
- `npm run build` → **OK**, 13 rotas (nova `/api/resumes/[id]`).
- Migração `resume_name` versionada; backfill confere (registros antigos com nome por modo+data).
- ADR-0020/0021, nota do contrato e os pontos sensíveis do source (títulos PT-BR, guardrail novo) lidos.

## Riscos / limites conhecidos (aceitos)
- **`prisma generate` no Windows dá EPERM** enquanto o `next dev` segura o `query_engine-*.dll.node`. Os
  `.d.ts/.js` foram regenerados (tsc/build provam); só o binário version-idêntico não trocou — **inofensivo**.
  Para um generate 100% limpo: parar o `npm run dev` e rodar `node node_modules/prisma/build/index.js generate`
  (o proxy `rtk` quebra `npx prisma`).
- **Idioma/curso fora da base → aviso (não bloqueia)** — trade-off consciente do ADR-0020 (strings curtas/
  ruidosas dariam falso positivo que bloquearia+regeneraria). Endurecer p/ erro forte seria um ADR futuro.
- Sem testes de componente (mantido): UI validada por lógica/rota + manualmente.

## Pendências
- **Nenhuma** bloqueante. (Cosmético: a grafia do título nas US-14 diz "&"; o código usa "E" — seguro.)

## Versão executiva (stakeholders)
- O **Currículo padrão** agora sai **completo e fiel**: projetos com seus bullets e stack, **Idiomas** e
  **Cursos/Certificações**, títulos em **português** e links discretos (não mais rosa). O usuário pode
  **nomear, ver/copiar, renomear e excluir** seus currículos, **abrir no Overleaf** por um clique, e
  **limpar a base** ou **importar substituindo**. A IA continua **sem inventar nada** (guardrail estendido,
  invariante intacto).
- 305 testes verdes, build OK, contrato congelado respeitado (mudanças apenas aditivas).

## Próximo passo
- **Commitar a Fatia 7** (proposta abaixo).
- Smoke real opcional do Modo 1 com a NIM (chave `nvapi-`) p/ confirmar a completude no `.tex`.

## Commit proposto
`feat: Fatia 7 — geração completa/fiel (US-14) + gestão de currículos (US-15) + limpar base (US-16), ADR-0020/0021`

**Novos:** `src/lib/overleaf.ts`, `src/app/api/resumes/[id]/route.ts`,
`prisma/migrations/20260531005650_resume_name/`, `docs/adr/0020-*`, `docs/adr/0021-*`,
`docs/user-stories/US-14..16-*`, `docs/release/fatia-7.md`, e os testes novos
(`tests/resume-schemas.test.ts`, `tests/resume-id-route.test.ts`, `tests/profile-delete-route.test.ts`,
`tests/standard-cv-prompt.test.ts`).
**Modificados:** `src/lib/schemas/{resume-content,generate}.ts`, `src/server/resume/{render-latex,validate-traceability}.ts`,
`templates/faangpath/skeleton.ts`, `src/server/llm/prompts/{standard-cv,job-adaptive-cv,parse-dump}.ts`,
`src/server/data/{resume-repo,profile-repo}.ts`, `src/app/api/resumes/generate/route.ts`,
`src/app/api/profile/route.ts`, `prisma/schema.prisma`, `src/lib/presentation/resume-meta.ts`,
`src/app/(dashboard)/{gerar,curriculos,perfil}/page.tsx`, `docs/api-contract.md`, `docs/adr/README.md`,
`docs/user-stories/README.md`, e os testes ajustados ao contrato aditivo.
