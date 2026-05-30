# 0013 — Modelo padrão do MVP: `meta/llama-3.3-70b-instruct`

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

O ADR-0004 estabeleceu que o modelo vem por env (`MODEL_ID`) com um catálogo em código
(`models.ts`) descrevendo o padrão. Restava escolher o **valor padrão** concreto para a
Fatia 2. O `.env.example` trazia provisoriamente `meta/llama-3.1-70b-instruct`. A decisão
ADR-0012 adota `response_format: json_schema`, então o padrão deve ser um modelo com bom
suporte a structured output na NVIDIA NIM. A documentação da NVIDIA cita suporte
**explícito** a structured output no `meta/llama-3.3-70b-instruct`.

## Decisão

Fixar o **modelo padrão** do MVP em **`meta/llama-3.3-70b-instruct`** — atualizar
`MODEL_ID` no `.env.example` e o default no catálogo `models.ts` (com
`supportsJsonSchema: true`). O `meta/llama-3.1-70b-instruct` permanece **no catálogo** como
modelo conhecido/alternativo. A env continua selecionando; o catálogo descreve (ADR-0004).

## Consequências

- Casa com o ADR-0012: o padrão suporta `json_schema`, reduzindo o uso do caminho de fallback.
- Trocar de modelo segue sendo só mudar `MODEL_ID` no `.env` (sem código).
- Não supersede o ADR-0004 (que continua válido: modelo por env + catálogo); apenas concretiza o valor padrão.
- O catálogo mantém o 3.1-70b para experimentação/comparação.

## Alternativas consideradas

- **Manter `meta/llama-3.1-70b-instruct` como padrão:** rejeitado — suporte a `json_schema` menos garantido que no 3.3, aumentando a chance de cair no fallback.
- **Deixar sem padrão (exigir `MODEL_ID` sempre):** rejeitado — o ADR-0004 pede um padrão seguro no catálogo; ausência de default piora a experiência de primeira execução.
