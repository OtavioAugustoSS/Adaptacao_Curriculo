# US-07 — Guardrail de rastreabilidade (anti-alucinação)

**Fatia:** 3 — Guardrail + Modo 2
**Dependências:** US-05 (fluxo de geração com `ResumeContent` e base disponíveis)

## História

**Como** usuário,
**quero** que o sistema valide o conteúdo gerado contra a minha base e me mostre os avisos,
**para** garantir que a IA não inventou nada — entidade fora da base é erro forte que dispara regeneração; número/data/tecnologia nova vira aviso revisável.

## Descrição

- Implementar `validate-traceability.ts` (`validateTraceability`): compara o `ResumeContent` contra o `ProfileBundle` (base).
  - **Erro forte** (`errors`): entidade que não existe na base (ex.: empresa/projeto sem `sourceId` correspondente) → dispara **regeneração**; falha persistente → status 422.
  - **Aviso** (`warnings`): número, data ou tecnologia nova não rastreável a um item → revisável pelo usuário, não bloqueia.
- Saída conforme `TraceabilityReportSchema` (`{ errors: Issue[], warnings: Issue[] }`, `Issue = { field, value, reason }`).
- Integrar no `POST /api/resumes/generate` (após render, antes de persistir): erro → regenera (limite de tentativas), depois persiste `traceabilityReport` em `GeneratedResume`.
- Exibir a lista de **avisos de rastreabilidade** no preview da tela `/gerar` (e do histórico — US-09).

## Referências

- **Spec:** §3 (passo 5 — guardrail confere conteúdo contra a base); §4 (regra inegociável: erro forte regenera, número/data/tech vira aviso; preview sempre expõe avisos).
- **Contrato de API:** `POST /api/resumes/generate` (status 422 falha de guardrail/regeneração); `TraceabilityReportSchema`.
- **ERD:** `GeneratedResume.traceabilityReport` (achados persistidos).
- **Código:** `src/server/resume/validate-traceability.ts`, `src/app/api/resumes/generate/route.ts`, `src/app/(dashboard)/gerar/page.tsx`, `src/lib/schemas/` (`TraceabilityReportSchema`).
- **Arquitetura:** §5 (guardrail anti-alucinação), §8 (cobertura obrigatória de `validateTraceability`), ADR-0008.
- **Testes:** `tests/validate-traceability.test.ts` (obrigatório).

## Estados envolvidos

- Conteúdo 100% rastreável → relatório vazio, sem avisos.
- Avisos (número/data/tech nova) → preview lista os avisos, currículo persiste normalmente.
- Erro forte → regeneração automática.
- Erro forte persistente após N tentativas → 422.

## Fora do escopo

- Modo 2 / `JobPosting` (US-08) — o guardrail é reutilizado lá, mas a entrega do Modo 2 é separada.
- Edição manual do conteúdo pelo usuário a partir dos avisos.

## Pendências

- [DECISÃO PENDENTE] Número máximo de tentativas de regeneração antes de retornar 422.
- [DECISÃO PENDENTE] Heurística de detecção de "número/data/tecnologia nova" — comparação literal contra `bullets`/`techStack` da base, ou normalização (lowercase/sinônimos)? Definir critério testável.
