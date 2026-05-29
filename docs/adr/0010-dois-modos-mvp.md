# 0010 — Dois modos no MVP (Standard, Job-adaptive); 3º modo é não-objetivo

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

O produto pode evoluir para vários formatos de saída (ex.: carta de apresentação). Mas o
MVP precisa de escopo fechado para entregar valor rápido. Os dois fluxos centrais —
currículo "global" e currículo adaptado a uma vaga — partilham o mesmo pipeline
(LLM → render → guardrail → persiste).

## Decisão

Entregar **dois modos no MVP**:

- **Modo 1 — Standard (`STANDARD`):** monta um currículo global completo a partir da base.
- **Modo 2 — Job-adaptive (`JOB_ADAPTIVE`):** o usuário cola a vaga; a IA seleciona,
  reordena e reescreve a redação de itens reais que casam com a vaga; o que falta é omitido.

Um **3º modo (ex.: carta de apresentação) é não-objetivo do MVP** — formato de saída
diferente, fica como futuro.

## Consequências

- Escopo fechado e entregável; os dois modos reusam o mesmo pipeline e schema.
- `GeneratedResume.mode` é um enum de dois valores (`STANDARD` | `JOB_ADAPTIVE`).
- Carta de apresentação e outros formatos exigirão novo trabalho (saída distinta do `.tex` de CV).
- Estilo/template é parâmetro, não modo (faangpath único no MVP).

## Alternativas consideradas

- **Incluir um 3º modo (carta de apresentação) já no MVP:** rejeitado — saída de formato
  diferente, amplia escopo e atrasa a entrega central.
- **Apenas um modo (só o padrão):** entregaria menos valor; a adaptação à vaga é
  diferencial central do produto.
