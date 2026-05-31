# US-18 — Adaptação à vaga mais rica (equilibrada) com referência de profundidade

**Fatia:** 8 — Currículo padrão + seleção na geração + adaptação mais rica
**Dependências:** US-08 (Modo 2), US-14 (geração completa/fiel, ADR-0020), US-17 (`baseResumeId`/currículo padrão). Depende do **ADR-0022** (virada de filosofia do prompt + referência de profundidade).

## História

**Como** usuário,
**quero** que a adaptação à vaga **mantenha a profundidade** do meu currículo (motivo do projeto, o que resolveu, impacto, justificativa da stack) e não encolha para uma página enxuta,
**para** que o currículo gerado passe na **triagem por IA (ATS)** e também impressione o **RH humano** — sem nunca inventar nada.

## Descrição

### Problema observado
- O Modo 2 cortava demais: numa vaga PHP, a base rica (5+5 bullets, 3 projetos) virou ~3,4 KB de `.tex` (vs. ~6,1 KB do Modo 1), perdendo 2 projetos e metade dos bullets. Causa: o prompt instruía "omita o que não agrega" e "um currículo mais curto é melhor que inflado".

### Mudança (política "Equilibrado" — ADR-0022 §5)
- **Manter** todas as experiências reais e a **maioria** dos projetos; omitir só o **claramente fora** do escopo da vaga.
- **Profundidade dos bullets:** preservar **contexto/problema → o que foi feito → impacto/resultado → justificativa da escolha técnica** (quando existir na base); condensar **só** itens menos relevantes — nunca reduzir um bullet rico a uma frase genérica.
- **Stack:** incluir a linha de `techStack` por experiência/projeto.
- **Tamanho:** 1–2 páginas é normal; não forçar 1 página cortando conteúdo verdadeiro relevante.
- **ATS + humano:** usar palavras-chave reais da vaga **que casam com itens reais** da base.

### Referência de profundidade
- Quando há currículo padrão/base (`baseResumeId` ou `getDefaultResume`), o prompt do Modo 2 recebe um bloco **"CURRÍCULO PADRÃO DE REFERÊNCIA"** (no user prompt) como bar de completude/estrutura — **não** como fonte de fatos. Os fatos seguem vindo da **base**.
- Reforço leve do mesmo padrão de profundidade no **Modo 1** (ele é a base que vira referência).

### O que NÃO muda (invariante)
- A IA **nunca inventa** — só seleciona/omite/reordena/reescreve itens reais da base.
- Guardrail (`validate-traceability.ts`), regeneração ([[0015]]), `ResumeContentSchema` e renderer: **intactos**. O `baseContent` não é entrada do guardrail.

## Referências

- **Código:** `src/server/llm/prompts/job-adaptive-cv.ts` (filosofia + `baseContent`), `src/server/llm/prompts/standard-cv.ts` (reforço), `src/server/resume/select-content.ts` (`baseContent?`), `src/app/api/resumes/generate/route.ts` (injeção).
- **Arquitetura/ADRs:** **ADR-0022** (§4/§5/§6); ADR-0020 (ResumeContent enriquecido — base); ADR-0008/0015 (guardrail — inalterado).
- **Testes:** `job-adaptive-prompt` (bloco de referência quando há `baseContent`; nova filosofia presente; tokens do invariante preservados: "NÃO INVENTE NADA", "OMITA", "nunca preencha", "nem mesmo se a vaga pedir"); `select-content` (`baseContent` repassado ao user prompt); rota generate (carrega base e injeta).

## Critérios de aceite

- **Dado** uma vaga e um currículo padrão completo, **quando** adapto, **então** o resultado mantém as experiências e a maioria dos projetos, com bullets profundos e linha `Stack:` — claramente mais rico que o comportamento antigo.
- **Dado** a adaptação, **então** nenhum fato fora da base aparece (guardrail sem `errors`); itens reescritos podem virar **avisos** no preview (esperado).
- **Dado** que a vaga pede algo que o usuário não tem, **então** o sistema **omite** (não inventa) — invariante intacto.
- **Dado** que não há currículo base, **então** a adaptação ainda funciona (deriva da base) com a mesma filosofia equilibrada.

## Fora do escopo

- Adaptar a partir do `.tex`/conteúdo já reescrito (2º rewrite) — rejeitado no ADR-0022 (drift).
- Mudar o guardrail/`ResumeContentSchema`/renderer.
- Limite rígido de páginas (o tamanho segue o conteúdo verdadeiro relevante).
