# 0012 — Saída estruturada do LLM via `response_format: json_schema` + validação Zod; timeout/retry no adapter

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

A US-04 define a interface `LLMProvider` e o adapter NIM. O ADR-0007 já exige que o LLM
produza JSON validado por Zod (`ResumeContentSchema`), nunca `.tex` cru. Ficaram em aberto
(pendências da US-04) **como** o adapter força essa saída estruturada e **onde** vivem
timeout/retry. A NVIDIA NIM, no endpoint OpenAI-compatible, suporta `response_format`
com `json_schema` (padrão OpenAI, portável) e também a extensão NIM-específica
`nvext.guided_json` (não-portável). O Zod 4 — já no projeto — tem `z.toJSONSchema()`
nativo, o que permite derivar o JSON Schema do `ResumeContentSchema` sem dependência nova.

## Decisão

- O adapter NIM solicita **`response_format: { type: "json_schema", json_schema: <derivado de ResumeContentSchema via z.toJSONSchema> }`** — padrão OpenAI, portável (coerente com ADR-0003), **não** a extensão `nvext` da NVIDIA.
- A saída do modelo é **sempre revalidada com `ResumeContentSchema.parse`** após o parse do JSON. A validação Zod é a garantia real (cinto e suspensório); `json_schema` é restrição de geração, não substitui a validação.
- O catálogo `models.ts` carrega um flag **`supportsJsonSchema`** por modelo. Se o modelo selecionado não suportar, o adapter faz **fallback** para `response_format: { type: "json_object" }` + instrução de schema no prompt + a mesma validação Zod.
- **Timeout e retry vivem no adapter** (`nim.ts`): timeout padrão **60s**; **até 2 retries** em falha transitória (rede/HTTP 5xx/timeout), com backoff. Falha de parse/validação **não** dá retry no adapter — propaga erro tipado (a regeneração por guardrail é responsabilidade da US-07, no orquestrador).
- Falha terminal do provedor (rede/credencial/timeout esgotado) → erro tipado mapeável para **HTTP 502** por quem consome o adapter.

## Consequências

- Saída estruturada confiável sem acoplar ao `nvext` da NVIDIA: trocar de provedor continua sendo trocar o adapter + env (ADR-0003).
- Sem dependência nova para gerar o JSON Schema (Zod 4 nativo).
- A validação Zod permanece como fronteira única de confiança, independente do provedor honrar o `json_schema`.
- O fallback por flag evita travar o MVP num modelo específico, ao custo de um caminho extra a manter em `nim.ts`.
- Timeout/retry centralizados no adapter mantêm o orquestrador (US-05) simples; a fronteira de erro (502) fica clara.

## Alternativas consideradas

- **`nvext.guided_json` da NVIDIA:** rejeitado — é específico da NIM e quebraria a portabilidade que o ADR-0003 protege.
- **Só `json_object` (JSON mode) + prompt + Zod:** mantido apenas como fallback; sozinho é menos garantido que o modelo respeite a forma exata.
- **Retry/timeout no orquestrador (US-05) em vez do adapter:** rejeitado para US-04 — vazaria detalhe de transporte do provedor para a camada de orquestração; o adapter é o lugar natural do transporte. A regeneração semântica (guardrail) é que fica no orquestrador (US-07).
