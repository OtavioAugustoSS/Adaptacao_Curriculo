# Relatório de release — Fatia 10 · Qualidade da adaptação à vaga (estudo) + fix das contagens

> Documento **committável**. Continuação de `docs/release/fatia-9.md`. Atualizado: 2026-05-31.
> Feita na worktree/branch `worktree-fatia-9-multiusuario` (em cima da Fatia 9), iterada **ao vivo
> com o dono** contra a NIM real (vaga **Magalu Cloud**) e validada por um **harness de avaliação**.

## Estado atual
- ✅ **Fatia 10 implementada.** Núcleo de valor (Modo 2 — adaptar à vaga) reescrito e iterado até
  resolver o "não adapta / fica paia". ADRs 0026/0027 (gate) antes do código.
- **Verificado:** `tsc --noEmit` limpo · `npm test` **339/339** (31 arquivos; 339 = 334 da F9 + testes
  da adaptação) · `npm run build` OK. **Harness** confirma: 0 erros de guardrail e 0 bullets encolhidos.

## O problema (evidência do dono)
O Modo 2 **não adaptava**: devolvia a base quase byte a byte (só o objetivo reescrito, e mal). Causa-raiz:
a "referência de profundidade" (ADR-0022) injetava o currículo padrão inteiro como gabarito → com temp
baixa, o modelo **copiava**. E não havia análise da vaga.

## O que mudou
### Part 0 — Fix das contagens da sidebar (ADR-0026)
Regressão da Fatia 9: o middleware redirecionava `/api/*` para `/login` (HTML 307) e o fetch da sidebar
quebrava no `res.json()`. **Fix:** middleware vira função explícita — `/api/*` sem sessão → **401 JSON**
(não redireciona); páginas → redirect. Sidebar re-busca as contagens ao navegar. `middleware.ts`,
`auth.config.ts`, `(dashboard)/layout.tsx`.

### Part B — Adaptação em 2 passos + prompt re-arquitetado (ADR-0027)
- **Pipeline de 2 chamadas:** (1) `analyze-job` extrai requisitos/keywords da vaga (`JobAnalysisSchema`
  interno, novo método `LLMProvider.analyzeJob`); (2) a adaptação recebe essa análise como guia.
  Orquestrado em `select-content.generateJobAdaptiveContent` (resiliente: análise falha → adapta sem ela).
- **Prompt re-arquitetado** (`job-adaptive-cv.ts`): separa **fidelidade** de **adaptação** (ambas fortes);
  **derruba a injeção do currículo-referência** (a fonte do copy-paste do ADR-0022); o anti-encolhimento
  vira **regra sobre a base**.
- **Iterações ao vivo (achados do teste real):**
  1. **Anti-encolher/genericizar/inventar** — regras explícitas.
  2. **Regra VERBATIM** — copiar empresa/cargo/instituição/título de projeto e `sourceId` EXATOS (um
     modelo reescrever isso quebra a rastreabilidade → guardrail bloqueia em 422). Resolveu o 422.
  3. **Checklist de contagem de bullets POR ITEM** — computado da base ("Workana = 5 bullets; DruSign = 5;
     ..."): muito mais obedecido que "mantenha a quantidade". **Matou o encolhimento** (era 5→3, virou 5/5).
  4. **Estilo humano** — proíbe clichês de IA vazios ("robusto", "eficiente", "soluções escaláveis e
     seguras", "de alto desempenho") como enfeite; exige redação concreta.

### Part A — Harness de avaliação (`scripts/eval-adaptation/run.ts`)
Lê a base REAL do banco, roda o Modo 2 contra a vaga em N modelos e imprime um **scorecard**: tempo,
**erros do guardrail**, e **contagem de bullets por item (output vs base)** marcando quem encolheu.
**Opt-in** (NIM real / budget) — NÃO entra no `npm test`. É o portão: todo modelo/prompt passa por ele
**antes** de chegar na tela do usuário.

### Part C — Estudo de modelos (catálogo + harness)
`models.ts` ganhou `nvidia/llama-3.3-nemotron-super-49b-v1` (validado vivo na NIM; os demais candidatos
testados — nemotron-70b, qwen2.5-72b, llama-3.1-405b — deram 404 no catálogo atual). Resultado do harness
(base do dono, vaga Magalu):

| Modelo | Guardrail | Bullets encolhidos | Tempo | Objetivo |
|---|---|---|---|---|
| **`meta/llama-3.3-70b-instruct`** (escolhido) | 0 erros | 0 | ~96s | fiel, **sem inventar** |
| `nvidia/llama-3.3-nemotron-super-49b-v1` | 0 erros | 0 | ~113s | mais focado, **mas crava "microsserviços/CI/CD"** fora da base (invenção leve no objetivo) |

**Decisão:** manter `llama-3.3-70b` como default (fiel + sem invenção + mais rápido). O Nemotron fica como
candidato pendente de **apertar a regra anti-invenção do objetivo** antes de adotar.

## O que NÃO mudou (invariante)
Guardrail (`validate-traceability.ts`), `ResumeContentSchema`, renderer determinístico e o contrato
`GenerateRequest` (a análise da vaga é andaime interno; `baseResumeId` segue aceito, mas deixou de ser
usado como gabarito). Invariante anti-alucinação intacto — o guardrail, aliás, foi quem pegou a invenção
de entidade do Nemotron (422) durante a iteração.

## Pendências / follow-ups (não bloqueiam)
- **Polish do prompt:** reordenar PROJETOS por relevância (hoje as experiências reordenam, os projetos
  nem sempre); objetivo evitar citar stack irrelevante (ex.: React em vaga back-end).
- **Nemotron:** apertar anti-invenção do objetivo → re-rodar harness → adotar se passar limpo.
- **Invenção no objetivo (texto livre):** o guardrail não varre o `objective`; hoje a proteção é o prompt.
  Endurecer o guardrail para o objetivo é um candidato a ADR futuro.
- **Extração robusta (OCR/revisão/layout)** — segue **deferida** (era o "Fatia 10" antigo).

## Estado do código
Tudo na branch `worktree-fatia-9-multiusuario` (em cima da Fatia 9). O lead **propõe**; o dono revisa,
commita e empurra. Servidor de dev rodando local (Neon + GitHub OAuth) para o teste ao vivo.
