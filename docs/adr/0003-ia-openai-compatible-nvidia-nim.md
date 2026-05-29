# 0003 — IA via cliente OpenAI-compatible → NVIDIA NIM, atrás de `LLMProvider`

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

A geração de conteúdo do currículo depende de um LLM. O time quer baixo custo no MVP,
sem se prender a um único fornecedor de modelo. O endpoint da **NVIDIA NIM** é
compatível com a API da OpenAI, o que permite reusar o SDK `openai` apenas mudando a
base-URL. Trocar de provedor depois (inclusive Claude) não deve exigir mexer no código
que chama o modelo.

## Decisão

Acessar o LLM pelo **SDK `openai`** apontado para o endpoint **OpenAI-compatible da
NVIDIA NIM** (`LLM_BASE_URL`). Todo acesso passa por uma interface **`LLMProvider`
trocável**; o adapter NIM (`nim.ts`) é uma implementação dessa interface. Os call sites
dependem da interface, nunca do SDK concreto.

## Consequências

- Custo baixo no MVP usando NIM, com SDK maduro e bem documentado (OpenAI).
- Trocar de provedor = trocar o adapter + variáveis de ambiente; os call sites não mudam.
- A interface impõe uma fronteira clara para testes (mockar `LLMProvider`).
- Pequena camada de indireção adicional a manter.

## Alternativas consideradas

- **SDK da Anthropic (Claude) direto no MVP:** descartado por custo no MVP; permanece
  viável depois justamente porque entra como mais um adapter atrás de `LLMProvider`.
- **Acoplar o SDK `openai` diretamente aos call sites (sem interface):** rejeitado por
  travar o sistema a um provedor e dificultar testes e troca futura.
