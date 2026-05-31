# 0023 — Geração rica: timeout, prompts compactos e tailoring (achados do e2e real)

- **Status:** Accepted (tailoring do Modo 2 refinado por [[0027-adaptacao-vaga-2-passos-prompt-rearquitetado]])
- **Data:** 2026-05-31

> **Nota (2026-05-31):** os **timeouts/temperatura/prompts compactos** seguem válidos. O **reforço de
> tailoring** do Modo 2 aqui mostrou-se insuficiente (o Modo 2 ainda copiava a base); o
> [[0027-adaptacao-vaga-2-passos-prompt-rearquitetado]] o **refina** com pipeline de 2 passos
> (análise da vaga → adaptação) e re-arquitetura do prompt.

## Contexto

Validação **e2e real contra a NVIDIA NIM** (após a Fatia 8 / ADR-0022) com a vaga PHP do dono e o
currículo padrão como base. Resultado da **qualidade: ótimo** — o `.tex` do Modo 2 saltou de **3.414 →
6.122 chars**, manteve **as 2 experiências (5+5 bullets)** e **os 3 projetos** (com stack), guardrail
**0 erros / 0 avisos**, e **não inventou** Laravel/Redis (a vaga pedia, a base não tem). Mas o e2e expôs
**três problemas de funcionamento**:

1. **Latência/robustez (crítico):** a chamada levou **182s**. A geração usa `timeout: 60s` + `maxRetries: 2`
   (ADR-0012). Com o output agora mais rico, **uma** geração passa de ~60s → o SDK aborta e **re-tenta** →
   ~3×60s = 182s (e, quando as 3 tentativas estouram, vira **502**). É o **mesmo** problema que o import já
   resolveu (180s — ADR-0019/nim.ts), só que na geração.
2. **Tokens desperdiçados:** os prompts serializam a base **e** o currículo de referência com
   `JSON.stringify(x, null, 2)` (pretty-print). O whitespace infla os tokens de entrada (a referência
   praticamente duplica a base) → mais lento, sem ganho.
3. **Adaptação "completa demais" (qualidade):** o resultado ficou quase idêntico ao currículo padrão — o
   **objetivo saiu genérico** (copiado da referência, não focado na vaga PHP) e a **ordem** não mudou. A
   referência de profundidade (ADR-0022) ancorou demais o "não mexer".

## Decisão

### 1. Timeout da geração alinhado ao import (supersede o "60s" do [[0012-saida-estruturada-json-schema-llmprovider]])
- `generateResumeContent` passa a usar **override por requisição** `{ timeout: 180s, maxRetries: 1 }` (espelha
  o `extractProfileFromDump`). Assim **uma** tentativa completa sem o corte de 60s → some o "retry storm"
  (esperado: 182s → ~60–80s numa tentativa só) e cai o risco de 502.
- **Mantém `json_schema`** (a forma garantida na geração; ADR-0012). A lentidão observada era o **corte de
  60s**, não o constrained decoding em si — por isso a correção é o timeout, não trocar o `response_format`.
  Se um dia a geração exceder 180s de forma consistente, o próximo passo documentado é avaliar `json_object`
  (como o import), aceitando o trade-off de validação (sem retry em erro de validação).
- **`maxRetries: 1`** na geração: uma chamada de até 180s não deve ser re-tentada 2× (evita esperas de
  centenas de segundos). O retry do **guardrail** (regenera 1×; [[0015]]) é independente e permanece.

### 1b. Temperatura baixa na geração
- A geração passa a usar **`temperature: 0.3`**. Gerar currículo é tarefa **fiel** (selecionar/
  reordenar/reescrever itens reais), não criativa. O e2e mostrou **variância alta** com a temperatura
  padrão: três rodadas do MESMO input deram resultados bem diferentes (uma manteve tudo rico, outra cortou
  metade, outra manteve o conjunto mas afinou os bullets). Temperatura baixa reduz a variância e melhora a
  aderência às instruções (manter o conjunto + a profundidade/quantidade de bullets).

### 2. Prompts compactos
- A serialização da base e do `baseContent` nos prompts passa a usar `JSON.stringify(x)` **sem indentação**.
  Mesma informação, menos tokens. Não muda a semântica nem o invariante (são os mesmos dados).

### 3. Reforço de tailoring no Modo 2 (prompt)
- O bloco "CURRÍCULO PADRÃO DE REFERÊNCIA" e a TAREFA passam a deixar explícito: a referência é só para
  **profundidade/completude**; o modelo **DEVE adaptar** — reescrever o **objetivo focado na vaga** (não
  copiar o genérico da referência) e **reordenar os itens por relevância** à vaga, **mantendo** a riqueza.

### O que NÃO muda
- Invariante anti-alucinação, guardrail (`validate-traceability.ts`), `ResumeContentSchema`, renderer e o
  contrato de API: **intactos**. Estes são ajustes de **transporte (timeout)**, **eficiência de prompt** e
  **redação do prompt** — não tocam schemas nem rotas.

## Consequências
- Geração do Modo 2/Modo 1 **mais rápida e confiável** (uma tentativa, sem retry storm), mantendo a riqueza.
- Pior caso de tempo de uma requisição com **regeneração do guardrail**: ~2×180s (raro — guardrail erra
  pouco com o prompt forte; o e2e teve 0 erros). Aceitável no MVP local; numa migração serverless, observar
  limites de duração da plataforma.
- Adaptação volta a **adaptar** (objetivo e ordem focados na vaga) sem perder profundidade.

## Alternativas consideradas
- **Trocar geração para `json_object` (como o import):** adiado — a evidência aponta o **timeout de 60s**
  como causa do retry storm, não o constrained decoding; `json_object` reintroduz risco de JSON fora do
  schema (a geração **não** re-tenta em erro de validação). Fica documentado como próximo passo se o timeout
  maior não bastar.
- **Manter 60s e aceitar 502 ocasional:** rejeitado — é o bug que o dono pediu para aprimorar.
- **Não injetar a referência de profundidade (resolver tailoring assim):** rejeitado — a referência é o que
  garante a riqueza (ADR-0022); o ajuste correto é instruir o modelo a **adaptar** a partir dela, não removê-la.
