# US-09 — Histórico de currículos

**Fatia:** 3 — Guardrail + Modo 2
**Dependências:** US-05 (geração que produz `GeneratedResume`), US-06 (download do `.tex`)

## História

**Como** usuário,
**quero** ver na tela `/curriculos` o histórico dos currículos que gerei e rebaixar o `.tex` cacheado,
**para** reutilizar currículos anteriores sem gastar uma nova chamada ao LLM e revisar o relatório de rastreabilidade.

## Descrição

- Rota `GET /api/resumes` — lista o histórico de `GeneratedResume` do usuário atual (response `GeneratedResumeSchema[]`), sem paginação no MVP.
- Tela `/curriculos`: lista com modo (`STANDARD`/`JOB_ADAPTIVE`), data, vaga associada (se Modo 2). Cada item permite:
  - Rebaixar o `.tex` cacheado via `GET /api/resumes/[id]/download` (US-06) — **sem nova chamada ao LLM**.
  - Ver o relatório de rastreabilidade (`traceabilityReport`).
- Estados: vazio, populado.

## Referências

- **Spec:** §2.3 (Currículos — histórico; rebaixar `.tex` cacheado; ver relatório; estados vazio/populado).
- **Contrato de API:** `GET /api/resumes` (`GeneratedResumeSchema[]`); reuso de `GET /api/resumes/[id]/download`.
- **ERD:** `GeneratedResume` (`mode`, `createdAt`, `jobPostingId?`, `texOutput` cacheado, `traceabilityReport`).
- **Código:** `src/app/(dashboard)/curriculos/page.tsx`, `src/app/api/resumes/route.ts`, `src/server/data/`.
- **Arquitetura:** §4 (`texOutput` cacheado — rebaixar não refaz LLM).

## Estados envolvidos

- Vazio (nenhum currículo gerado) → mensagem/CTA para `/gerar`.
- Populado (lista de currículos).
- Re-download a partir de item do histórico.
- Visualização do relatório de rastreabilidade por item.

## Fora do escopo

- Geração de novos currículos (US-05/US-08).
- Exclusão/edição de currículos do histórico (não previsto na spec do MVP).
- Paginação (volume baixo, single-user).

## Pendências

- [RESOLVIDO — ver ADR-0016] **Sem exclusão** de itens do histórico no MVP — a spec não prevê deletar currículo.
- [RESOLVIDO — ver ADR-0016] `GET /api/resumes` devolve `GeneratedResumeSchema[]` **sem join** com `JobPosting`; o título/texto da vaga **não é exibido** no histórico no MVP (denormalizar exigiria mudar o contrato congelado — fica como melhoria futura).
