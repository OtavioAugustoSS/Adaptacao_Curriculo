# 0027 — Adaptação à vaga em 2 passos (análise → adaptação) + prompt re-arquitetado

- **Status:** Accepted
- **Data:** 2026-05-31
- **Supersede (parcial):** [[0022-curriculo-padrao-adaptacao-referencia-profundidade]] — **apenas** o
  mecanismo de "adaptação ancorada em referência de profundidade". O **currículo padrão (`isDefault`)**
  do ADR-0022 continua valendo.
- **Refina:** [[0023-geracao-rica-timeout-prompts-tailoring]] (tailoring do Modo 2; timeouts seguem)

## Contexto

O **núcleo de valor** do produto é o Modo 2 — adaptar o currículo a UMA vaga. O teste real do dono
(vaga **Magalu Cloud**, back-end Python/cloud/microsserviços/CI-CD/Docker) mostrou que **ele não
adapta**: a saída foi **a base quase byte a byte**, só com o "objetivo" reescrito (e mal — manteve
"estágio", citou React/front, irrelevante para a vaga). Habilidades, experiências, projetos, idiomas e
cursos vieram **idênticos**; **zero reordenação por relevância**, **zero reescrita** alinhada à vaga,
nenhuma priorização de keywords. Fiel (não inventou — o guardrail garante), mas inútil como adaptação.

**Causa-raiz (no código):**
1. A **"referência de profundidade"** ([[0022-curriculo-padrao-adaptacao-referencia-profundidade]])
   injeta o **currículo padrão inteiro** no prompt e exige "MESMO conjunto, mesma quantidade de bullets,
   mesma profundidade". Com `temperature: 0.3` ([[0023-geracao-rica-timeout-prompts-tailoring]], baixa
   para fidelidade), a conformidade mais barata é **copiar a referência** → o "adapte redação/ordem" se
   perde. O mecanismo anti-encolhimento virou a causa do **não-adaptar**.
2. **Não há análise da vaga:** uma única chamada recebe a vaga crua + a base e tem que fazer tudo de uma
   vez, em JSON — sem um passo que force **identificar os requisitos da vaga e mapeá-los nos itens reais**.
3. Modelo único (`llama-3.3-70b`) sem comparação medida.

Decisão do dono: **estudo dirigido por avaliação** (harness mede a qualidade da adaptação) e **pipeline
de 2 chamadas** (analisa a vaga → adapta).

## Decisão

### 1. Pipeline de 2 passos (análise → adaptação)
- **Passo 1 — Análise da vaga (nova chamada ao LLM):** `analyze-job.ts` lê a vaga e devolve um JSON
  estruturado (papel/senioridade, área/domínio, **requisitos must-have**, **keywords técnicas**,
  nice-to-have), validado por um **`JobAnalysisSchema` interno** (Zod). Chamada pequena/rápida
  (`json_object`, temp baixa, timeout curto).
- **Passo 2 — Adaptação:** a geração do `ResumeContent` recebe **a análise** como insumo extra, o que dá
  ao modelo um mapa explícito do que priorizar e reescrever. Orquestrado em
  `select-content.generateJobAdaptiveContent` (1 → 2); a rota `generate` não muda.

### 2. Prompt da adaptação re-arquitetado
- **Separa FIDELIDADE de ADAPTAÇÃO.** A regra anti-invenção e o anti-encolhimento continuam, mas o
  prompt agora **exige adaptar**: reordenar experiências/projetos/skills por **relevância à vaga**
  (mais aderente primeiro), reescrever os bullets na linguagem da vaga, e priorizar keywords reais.
- **Objetivo concreto e obrigatório:** nomeia o papel/área da vaga + 2–3 tecnologias **reais** do
  candidato que casam; proíbe objetivo genérico ou cópia da referência; não inventa senioridade; para
  vaga de desenvolvedor, posiciona como desenvolvedor (sem mentir sobre o que o candidato é/quer).
- **Keywords/ATS:** destaca de forma natural os termos reais da base que casam com a análise da vaga.

### 3. Reformula a "referência de profundidade"
Como a **BASE já carrega todos os bullets de cada item**, **derruba-se a injeção do currículo-padrão
inteiro** (a fonte do copy-paste). O **anti-encolhimento** passa a ser **regra sobre a BASE**: "mantenha
TODA experiência e TODO projeto da base; preserve a riqueza de bullets de cada item da base; mas você
DEVE reordenar e reescrever para a vaga". Assim garante-se completude **sem** dar ao modelo um gabarito
para copiar.

### 4. Estudo dirigido por avaliação
As mudanças de prompt/modelo são validadas por um **harness** (`scripts/eval-adaptation/`) que roda o
Modo 2 contra um conjunto de vagas reais e mede: não-inventou (guardrail = 0 erros), manteve todos os
itens, **reordenou**, **cobertura de keywords**, **objetivo focado**, **bullets reescritos**. Opcional:
juiz-LLM (nota 1–5). Comparação de **modelos** ([[0004-modelo-base-url-por-env]]: env + catálogo) usa o
mesmo harness. O harness é **opt-in** (NIM real / budget) — não entra no `npm test`.

### O que NÃO muda
- **Invariante anti-alucinação** e o **guardrail** (`validate-traceability.ts`) — a análise da vaga é
  **andaime interno**, NÃO fonte de fatos; todo fato continua vindo da BASE e o guardrail valida contra
  a BASE (não contra a análise).
- **`ResumeContentSchema`**, **renderer determinístico** e o contrato **`GenerateRequest`** (a análise é
  interna; não há campo novo no request/response). Timeouts da geração/import do [[0023]] seguem.

## Consequências
- A adaptação passa a **adaptar de verdade** (objetivo focado, ordem por relevância, redação alinhada,
  keywords) **sem** abrir mão da fidelidade nem do anti-encolhimento.
- **+1 chamada ao LLM por geração** (~10–15s) → latência maior (esperado ~80s no total) e +custo.
  **Risco de duração serverless** na Vercel (limite por plano) — tratar no deploy (`maxDuration`/Pro ou
  background); espelha a nota do [[0023]]. Local: ok.
- "Melhor" deixa de ser subjetivo: o harness dá um **scorecard** para iterar com método.
- Some o gabarito de copiar (referência-CV inteira); ganha-se um schema interno novo (`JobAnalysisSchema`).

## Alternativas consideradas
- **Só reescrever o prompt (1 chamada):** ganho real, porém menor — sem a análise explícita, o modelo
  continua tendo que inferir os requisitos no mesmo passo da montagem. Rejeitado como solução final
  (mantido como fallback se a 2ª chamada custar/atrasar demais).
- **Manter a injeção do currículo-padrão inteiro:** é a causa do copy-paste; rejeitado. O `isDefault`
  do ADR-0022 segue útil para o **Modo 1/seleção de base**, só não como gabarito de adaptação.
- **Campo de "raciocínio" no JSON de saída:** arriscado (mexe na forma validada/renderizada); a 2ª
  chamada separada é mais limpa e testável.
- **Subir a temperatura para "soltar" a reescrita:** rejeitado — reintroduz a variância que o [[0023]]
  resolveu; o gargalo é a **estrutura do prompt** (gabarito + falta de análise), não a temperatura.
