# 0007 — LLM produz JSON validado (Zod); `.tex` por renderer determinístico

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

A saída final é um `.tex` válido para compilar no Overleaf (ADR-0002). Se o LLM emitisse
`.tex` cru, a saída ficaria frágil (LaTeX inválido, comandos desbalanceados) e abriria
espaço para a IA inserir seções/itens fora da base — violando o invariante "a IA nunca
inventa". É preciso separar *o que dizer* (decisão de conteúdo) de *como renderizar*.

## Decisão

O **LLM produz conteúdo estruturado** — um objeto `ResumeContent` **validado por Zod**,
que apenas seleciona/ordena/reescreve a redação de itens reais da base (com `sourceId`
rastreável). O **`.tex` é montado por um renderer determinístico** (`render-latex.ts`)
que mapeia esse objeto nas seções do template faangpath. **O LLM nunca emite `.tex`.**

## Consequências

- LaTeX sempre válido: a estrutura vem do renderer, não do modelo.
- A IA não consegue adicionar seções/itens fora do schema — base do guardrail (ADR-0008).
- O renderer é lógica pura testável (cobertura obrigatória em testes).
- A saída do LLM precisa passar pela validação Zod; respostas malformadas são rejeitadas/regeneradas.
- O template do `.tex` é responsabilidade do renderer, não do prompt.

## Alternativas consideradas

- **LLM emite `.tex` cru:** rejeitado por fragilidade (LaTeX inválido) e por risco de
  alucinação (seções/itens inventados, difíceis de rastrear).
- **LLM emite texto livre e o app faz parsing:** parsing frágil e ambíguo; JSON validado
  por Zod é um contrato muito mais forte.
