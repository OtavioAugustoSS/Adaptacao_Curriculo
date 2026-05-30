# US-08 — Modo 2 adaptativo à vaga

**Fatia:** 3 — Guardrail + Modo 2
**Dependências:** US-05 (fluxo de geração), US-07 (guardrail reutilizado)

## História

**Como** usuário,
**quero** colar o texto de uma vaga na tela `/gerar` e gerar um currículo adaptado,
**para** que a IA selecione, reordene e reescreva a redação apenas de itens reais da minha base que casam com a vaga — omitindo o que a vaga pede e eu não tenho.

## Descrição

- Implementar a entidade `JobPosting` (`rawText`, `title?`, `company?`, `parsedKeywords?`) e `JobPostingSchema`.
- Implementar o prompt do Modo 2 (`prompts/job-adaptive-cv.ts`): prioriza itens reais que casam com a vaga; **omite** o que o usuário não tem — nunca preenche.
- Estender `POST /api/resumes/generate` para `mode = JOB_ADAPTIVE`:
  1. `GenerateRequestSchema` exige `jobText` quando `mode === "JOB_ADAPTIVE"`.
  2. Salva `JobPosting` a partir do `jobText`.
  3. Chama o LLM com base + vaga → `ResumeContent`.
  4. Render → guardrail (US-07) → persiste `GeneratedResume` com `mode=JOB_ADAPTIVE` + `jobPostingId`.
- Tela `/gerar`: Modo 2 com campo de texto grande para a vaga + botão "Adaptar à vaga", mesmos estados do Modo 1.

## Referências

- **Spec:** §2.2 (Modo 2 — campo da vaga, botão, pré-requisitos); §3 (fluxo Modo 2, passos 1–6); §4 (regra inegociável: omitir, nunca inventar).
- **Contrato de API:** `POST /api/resumes/generate` com `GenerateRequestSchema` (`jobText` condicional); `JobPostingSchema`, `GeneratedResumeSchema`.
- **ERD:** `JobPosting` (insumo) e relação `JobPosting ||--o{ GeneratedResume`; `GeneratedResume.jobPostingId`, `mode=JOB_ADAPTIVE`.
- **Código:** `src/app/(dashboard)/gerar/page.tsx`, `src/app/api/resumes/generate/route.ts`, `src/server/resume/select-content.ts`, `src/server/llm/prompts/job-adaptive-cv.ts`, `src/lib/schemas/` (`JobPostingSchema`).
- **Arquitetura:** §1 (Modo 2 adaptativo; invariante "nunca inventa"), ADR-0010.

## Estados envolvidos

- Vaga não colada → botão "Adaptar" desabilitado / validação.
- Gerando (loading).
- Sucesso → `GeneratedResume` (JOB_ADAPTIVE) + `jobPostingId` + preview com avisos.
- Erro do LLM (502) com retry; erro forte de guardrail (422).

## Fora do escopo

- Parsing avançado da vaga (`parsedKeywords` pode ficar nulo/opcional no MVP).
- Histórico / re-download (US-09).
- 3º modo (carta de apresentação — não-objetivo).

## Pendências

- [RESOLVIDO — ver ADR-0016] `parsedKeywords` **não é preenchido no MVP** (fica `null`); o casamento vaga×base acontece dentro do prompt do Modo 2, não por extração prévia.
- [RESOLVIDO — ver ADR-0016] `title`/`company` do `JobPosting` são **opcionais e deixados vazios** no MVP — o usuário cola só o `rawText`; não há campos separados nem extração por IA.
