# 0016 — Modo 2 (US-08) e histórico (US-09): decisões de escopo do MVP

- **Status:** Accepted (a decisão "título do histórico = rótulo do modo" e "sem exclusão" são Superseded by ADR-0021)
- **Data:** 2026-05-30

## Contexto

A Fatia 3 entrega o Modo 2 (adaptativo à vaga, US-08) e o histórico de currículos (US-09).
As duas stories tinham pendências de escopo que precisam estar fechadas antes de codar
(workflow: contrato antes de código). O contrato (`api-contract.md`) está congelado; os
schemas (`JobPostingSchema`, `GeneratedResumeSchema`) não mudam — aqui só comportamento/escopo.
O guardrail (US-07/[[ADR-0015]]) e o fluxo de geração (US-05) são reutilizados.

## Decisão

### US-08 — Modo 2
- **`JobPosting.parsedKeywords`:** **não preenchido no MVP** (fica `null`/ausente). O casamento
  vaga×base acontece **dentro do prompt** do LLM (`job-adaptive-cv.ts`), não por extração prévia.
- **`JobPosting.title`/`company`:** **opcionais, deixados vazios** no MVP. O usuário cola só o
  `rawText` da vaga; não pedimos campos separados nem extraímos com IA (evita UI extra e mais
  uma chamada ao modelo).
- **Pré-requisito do Modo 2:** o mesmo do Modo 1 ([[ADR-0014]]: `fullName` + ≥1 experiência OU
  formação) **mais** `jobText` não-vazio (o `GenerateRequestSchema` já exige). **Não** exige um
  currículo Modo 1 prévio (a spec diz "idealmente", não "obrigatoriamente").
- **Prompt do Modo 2:** mesma regra anti-alucinação do Modo 1 + **omitir** o que a vaga pede e o
  usuário não tem (nunca preencher); priorizar/reordenar/reescrever só itens reais que casam.
- **Guardrail:** `validateTraceability` é **reutilizado sem mudança** (confere conteúdo×base,
  independente do modo). Erro forte → regenera 1x → 422 `GUARDRAIL_FAILED`.
- **Persistência:** salvar `JobPosting` (rawText) → `GeneratedResume` com `mode=JOB_ADAPTIVE` +
  `jobPostingId`. O repo já aceita `jobPostingId` (`NewGeneratedResume`).

### US-09 — Histórico
- **`GET /api/resumes`** devolve `GeneratedResumeSchema[]` (contrato congelado) — **sem join**
  com `JobPosting`. Reusa `listGeneratedResumes` (já existe no `resume-repo`).
- **`/curriculos`** mostra por item: modo (`STANDARD`/`JOB_ADAPTIVE`), data, resumo do guardrail
  (nº de avisos), **rebaixar** o `.tex` cacheado (reusa `GET /api/resumes/[id]/download`, sem novo
  LLM) e ver o `traceabilityReport`. Item Modo 2 é rotulado "Adaptado à vaga".
- **Título/texto da vaga NÃO é exibido no histórico no MVP** — exigiria denormalizar `jobTitle`
  no response (mudança de contrato) ou um endpoint de `JobPosting`. Fica como melhoria futura.
- **Sem exclusão** de itens do histórico (a spec do MVP não prevê).

## Consequências
- Modo 2 reaproveita ~tudo do Modo 1 + guardrail; só muda o prompt e a persistência do `JobPosting`.
- Contrato permanece **congelado** (nenhum schema novo, nenhuma rota nova além das já listadas).
- Histórico simples e útil para o volume single-user do MVP; a falta do título da vaga é o
  trade-off aceito para não tocar o contrato agora.
- `parsedKeywords`/`title`/`company` ficam no schema como **pontos de extensão** já preparados.

## Alternativas consideradas
- **Extrair `parsedKeywords`/título da vaga com IA:** rejeitado no MVP — mais uma chamada ao
  modelo, não-determinístico, sem ganho claro para o casamento (que o prompt já faz).
- **Denormalizar o título da vaga em `GET /api/resumes`:** rejeitado agora — mudaria o contrato
  congelado; melhor adiar até haver necessidade real de distinguir muitas vagas no histórico.
- **Exigir Modo 1 antes do Modo 2:** rejeitado — a spec trata como recomendação, não requisito.
