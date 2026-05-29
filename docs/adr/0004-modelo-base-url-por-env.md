# 0004 — Modelo e base-URL por variável de ambiente; catálogo em código

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

O modelo de LLM, o endpoint e a chave precisam variar por ambiente (local, futuro
deploy) e por experimentação, sem recompilar nem editar código. Ao mesmo tempo, o
sistema precisa de uma referência confiável dos modelos suportados e de um padrão.

## Decisão

Configurar **base-URL, chave e modelo por variável de ambiente**
(`LLM_BASE_URL`, `LLM_API_KEY`, `MODEL_ID`). Manter um **catálogo de modelos em código**
(`src/server/llm/models.ts`) com o modelo padrão e os modelos conhecidos. A env
seleciona; o catálogo descreve.

## Consequências

- Trocar de modelo/endpoint é mudar `.env`, sem alterar código.
- Segredos (`LLM_API_KEY`) ficam fora do repositório (`.env.example` documenta sem valores).
- O catálogo em código dá um ponto único de referência e padrão seguro.
- Adicionar um modelo novo ao catálogo ainda exige commit (aceitável no MVP).

## Alternativas consideradas

- **Catálogo de modelos em banco/config externa:** flexível demais para o MVP single-user;
  adiciona estado e UI de gestão sem necessidade.
- **Modelo fixo hardcoded:** rejeitado por impedir experimentação e troca por ambiente.
