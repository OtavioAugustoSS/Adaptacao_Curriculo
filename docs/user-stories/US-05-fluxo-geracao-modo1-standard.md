# US-05 — Fluxo de geração Modo 1 (currículo padrão)

**Fatia:** 2 — Modo 1 (currículo padrão)
**Dependências:** US-01 (render), US-03 (base completa), US-04 (LLMProvider)

## História

**Como** usuário com a base preenchida,
**quero** gerar um currículo padrão a partir da minha base na tela `/gerar`,
**para** obter um `.tex` faangpath "global" montado pela IA usando apenas itens reais da minha base.

## Descrição

- Implementar o prompt do Modo 1 (`prompts/standard-cv.ts`) e `select-content.ts` (base serializada → LLM → `ResumeContent`).
- Orquestração da rota `POST /api/resumes/generate` para `mode = STANDARD`:
  1. Resolve usuário (`getCurrentUserId()`), valida pré-requisito (cabeçalho + ≥1 experiência ou formação).
  2. Serializa a base (`ProfileBundleSchema`) como input do LLM.
  3. Chama o `LLMProvider` (US-04) → `ResumeContent` validado por `ResumeContentSchema`.
  4. `render-latex.ts` (US-01) monta o `.tex`.
  5. Persiste `GeneratedResume` com `mode=STANDARD`, `contentJson`, `texOutput`, `modelId`.
- Request/response conforme `GenerateRequestSchema` / `GeneratedResumeSchema`.
- Tela `/gerar`: Modo 1 com botão "Gerar currículo padrão", validação de pré-requisitos, estado de loading, e exibição do preview (entregue na US-06).

## Referências

- **Spec:** §2.2 (Gerar — Modo 1, pré-requisitos e estados: ocioso, validando, gerando, preview, erro com retry); §3 (fluxo Modo 1, passos 1–6).
- **Contrato de API:** `POST /api/resumes/generate`; `GenerateRequestSchema`, `GeneratedResumeSchema`, `ResumeContentSchema`; status 400/422/502.
- **ERD:** `GeneratedResume` (`mode=STANDARD`, `contentJson`, `texOutput`, `modelId`).
- **Código:** `src/app/(dashboard)/gerar/page.tsx`, `src/app/api/resumes/generate/route.ts`, `src/server/resume/select-content.ts`, `src/server/resume/render-latex.ts`, `src/server/llm/prompts/standard-cv.ts`, `src/server/data/`.
- **Arquitetura:** §1 (Modo 1 obrigatório/primeiro), §5 (regra de ouro: LLM → JSON → renderer), ADR-0007, ADR-0010.

## Estados envolvidos

- Pré-requisito não atendido → bloqueio com mensagem.
- Gerando (loading durante chamada ao LLM).
- Sucesso → `GeneratedResume` persistido + preview.
- Erro do LLM (502) com opção de retry.

## Fora do escopo

- Guardrail de rastreabilidade e regeneração (US-07) — nesta US o relatório pode ser vazio/ausente.
- Preview/download na UI (US-06) — esta US entrega o backend e o disparo.
- Modo 2 / `JobPosting` (US-08).

## Pendências

- [DECISÃO PENDENTE] Sem US-07, o `traceabilityReport` é gravado como vazio ou nulo? Confirmar default de `GeneratedResume.traceabilityReport` antes do guardrail existir.
- [DECISÃO PENDENTE] Onde fica o cabeçalho (Profile) na composição do `.tex` (ver pendência da US-01) — passado direto ao renderer junto do `ResumeContent`?
