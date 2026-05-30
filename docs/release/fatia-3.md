# Relatório de release — Fatia 3 (Modo 2 + Histórico) · MVP completo

> Documento **committável** (vive no repo) para continuar o projeto em qualquer máquina.
> Continuação de `docs/release/fatia-2.md`. Consolidação do lead (template-workflow §6.2).
> Atualizado: 2026-05-30.

## Estado atual

- ✅ **Fatia 3 — Guardrail + Modo 2**, via Agent Team completo (`cv-adapter-development-team`:
  lead + product-owner + architect + fullstack + qa):
  - **US-08** — Modo 2 (currículo adaptativo à vaga): `JobPostingSchema`, prompt
    `job-adaptive-cv.ts`, `mode=JOB_ADAPTIVE` na rota generate, persistência do `JobPosting`,
    Modo 2 na tela `/gerar`.
  - **US-09** — histórico (`/curriculos`): `GET /api/resumes`, tela de histórico com
    re-download do `.tex` cacheado + relatório de rastreabilidade.
- 🏁 **MVP COMPLETO:** todas as **9 user stories** (US-01…US-09) implementadas. Fatias 0/1/2/3
  + US-07 entregues e verificadas.
- **Verificado à mão (lead):** `tsc --noEmit` limpo · `npm test` **147/147** · `next build` OK.
- A geração real (Modo 1) já foi validada de ponta a ponta contra a NVIDIA NIM nesta máquina
  (chave `nvapi-` válida no `.env`). O **Modo 2 também foi validado real** em 2026-05-30 (ver
  abaixo "Smoke test real do Modo 2").

## Smoke test real do Modo 2 (2026-05-30) — ✅ PASSOU

Validação manual de ponta a ponta pela UI `/gerar` (Adaptar à vaga) contra a NVIDIA NIM
(`meta/llama-3.3-70b-instruct`), com a base de exemplo semeada (Mariana Costa). Vaga de teste:
backend fintech pedindo Go/PostgreSQL/sistemas distribuídos (que ela **tem**) **misturados** com
Kubernetes, AWS, Python, Kafka, React, GraphQL (que ela **não tem**) — sonda direta do invariante
anti-alucinação.

- `POST /api/resumes/generate` → **200**, `.tex` renderizado + download funcionando, persistido
  como `JOB_ADAPTIVE` com `jobPostingId`.
- **Guardrail:** `traceabilityReport` = `{ errors: [], warnings: [] }` (passou na 1ª tentativa,
  sem regeneração).
- **Invariante respeitado:** nenhuma empresa/skill inventada. As tecnologias da vaga que ela não
  possui (Kubernetes/AWS/Python/Kafka/React/GraphQL) foram **omitidas** — não adicionadas. Skills
  reordenadas para priorizar a vaga (Go antes de TypeScript); só itens reais (Go, TypeScript,
  PostgreSQL). Bullets reescritos sem fato novo (22% preservado). LaTeX faangpath válido, escape
  aplicado (`22\%`, `\textbar`, `\href`).
- Observações menores (não-bugs): o `objective` foi reescrito adicionando "liderança técnica"
  (ancorado na experiência real de liderar time) e omitindo "6 anos"; o bullet perdeu o "4" de
  "time de 4 engenheiros" → "time de engenheiros" (omissão permitida). `objective` não tem
  checagem semântica (limite conhecido do ADR-0015).

## Funcionalidades implementadas (US — status)

| US | Descrição | Status |
|----|-----------|--------|
| US-01..03 | Renderer `.tex`, CRUD perfil, itens da base | ✅ (Fatia 1) |
| US-04..06 | Camada LLM, geração Modo 1, download/preview | ✅ (Fatia 2) |
| US-07 | Guardrail de rastreabilidade | ✅ |
| US-08 | Modo 2 adaptativo à vaga | ✅ (Fatia 3) |
| US-09 | Histórico de currículos | ✅ (Fatia 3) |

## Trabalho do time nesta fatia

- **fullstack-agent** — implementou US-08 (`job-repo.ts`, `prompts/job-adaptive-cv.ts`,
  `select-content.generateJobAdaptiveContent`, ramo JOB_ADAPTIVE na rota generate, Modo 2 na
  `/gerar`) e US-09 (`api/resumes/route.ts`, `(dashboard)/curriculos/page.tsx`). Generalizou
  `generateWithGuardrail(bundle, generate)` para receber a função geradora — guardrail único
  para os dois modos, sem duplicação.
- **architect-agent** — veredito **ADERENTE, zero desvios**: contrato Zod congelado intacto
  (nenhum schema mudou), invariante anti-alucinação preservado no prompt do Modo 2, guardrail
  reusado corretamente (mode-agnóstico → 422 GUARDRAIL_FAILED), ADR-0016 completo. **Nenhum ADR
  novo necessário.**
- **product-owner-agent** — **US-08 e US-09 ATENDEM** (comportamento + estados vs. spec
  §2.2/§2.3). Fechou as 4 `[DECISÃO PENDENTE]` das stories → `[RESOLVIDO — ver ADR-0016]`.
- **qa-agent** — +6 testes de borda (141→**147**), sem regressão, **nenhum bug real**.
  Destaques: regeneração do guardrail também no Modo 2 (recuperação na 2ª tentativa, JobPosting
  criado 1x); guarda contra "ligar o prompt errado no Modo 2" (a vaga chega ao LLM); vaga com
  caracteres especiais embutida verbatim; vaga em bloco separado da base (não vaza como fato).

## Dúvidas funcionais / técnicas levantadas
- Funcionais: as 4 pendências das US-08/09 — **resolvidas** pelo PO via ADR-0016.
- Técnicas: nenhuma nova não documentada (architect). Decisões da fatia cobertas por ADR-0016.

## Decisão-chave desta fatia
- **ADR-0016** — Modo 2 e histórico, escopo MVP: `parsedKeywords` null; `JobPosting.title/company`
  vazios; pré-requisito do Modo 2 = base (igual Modo 1) + `jobText`; guardrail reusado sem mudança;
  `GET /api/resumes` sem join (contrato congelado); sem exclusão no histórico.

## Riscos / limites conhecidos (aceitos)
- Limites do guardrail do ADR-0015 seguem valendo (número por substring; `education.details`/
  `period` não varridos; `objective` sem checagem semântica; `sourceId` forjado que casa por nome).
- Histórico não mostra o título/texto da vaga (sem join — ADR-0016); candidato a melhoria futura
  (exigiria extensão do contrato congelado).
- ~~Modo 2 ainda não teve smoke test real~~ — **feito em 2026-05-30, passou** (ver seção acima).

## Pendências
- **Nenhuma** no backlog do MVP (US-01…09 completas).

## Versão executiva (stakeholders)
- O CV-Adapter está **funcionalmente completo** para o MVP: o usuário mantém sua base, gera um
  currículo padrão **ou** adaptado a uma vaga, vê avisos de rastreabilidade, baixa o `.tex` para o
  Overleaf e consulta o histórico — tudo com a garantia de que **a IA não inventa** (3 camadas).
- 147 testes verdes, build OK, contrato congelado respeitado em todas as fatias.

## Próximo passo
- **Fatia 4 — polimento visual** (opcional, `agent-team.md`): trocar o `fullstack-agent` por
  `frontend-agent` + `backend-agent`, usar skills `frontend-design`/`ui-ux-pro-max`/`impeccable`
  para elevar a UI (hoje funcional/inline-styles). O contrato Zod congelado é a fronteira do split.
- Antes disso: **commitar a Fatia 3** + `/clear`. Smoke test real do Modo 2 quando quiser.

## Commit proposto (o dono commita)
`feat: Fatia 3 — Modo 2 adaptativo à vaga (US-08) + histórico (US-09)`
Inclui: `src/server/data/job-repo.ts`, `src/server/llm/prompts/job-adaptive-cv.ts`,
`select-content.ts` (Modo 2), `api/resumes/generate/route.ts` (ramo JOB_ADAPTIVE + guardrail
generalizado), `api/resumes/route.ts`, `(dashboard)/curriculos/page.tsx`, `(dashboard)/gerar/page.tsx`
(Modo 2), ADR-0016 + índice, US-08/09 (pendências resolvidas), os testes novos e este relatório.
