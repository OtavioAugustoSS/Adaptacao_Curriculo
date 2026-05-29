# 0008 — Guardrail anti-alucinação em 3 camadas

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

O invariante de produto inegociável é: **a IA nunca inventa informação**. Ela só pode
selecionar, omitir, reordenar e reescrever a redação de itens que já existem na base.
Confiar apenas no prompt não basta — LLMs alucinam. É preciso defesa em profundidade.

## Decisão

Aplicar um **guardrail anti-alucinação em 3 camadas**:

1. **Arquitetura:** o LLM só emite `ResumeContent` estruturado e validado (ADR-0007); não
   há como inserir seções fora do schema, e itens reais trazem `sourceId`.
2. **Prompt restritivo:** os system prompts (Modo 1 e Modo 2) proíbem fatos novos — o que
   a vaga pede e o usuário não tem é **omitido, nunca preenchido**.
3. **Validação de rastreabilidade pós-geração:** `validate-traceability.ts` confere o
   conteúdo gerado contra a base. Entidade inexistente é **erro forte** → dispara
   regeneração; números/datas/tecnologias novas viram **aviso** revisável pelo usuário.

## Consequências

- Defesa em profundidade: falha de uma camada é apanhada pela seguinte.
- O relatório de rastreabilidade é sempre exposto na UI (transparência ao usuário).
- `validateTraceability` é lógica pura crítica com cobertura de teste obrigatória.
- Custo extra: passo de validação e possível regeneração (status 422) em cada geração.

## Alternativas consideradas

- **Confiar só no prompt:** insuficiente — LLMs alucinam mesmo sob instrução estrita.
- **Só validação pós-geração, sem restrição arquitetural:** mais frágil; a saída
  estruturada (ADR-0007) já elimina classes inteiras de alucinação na origem.
