# 0015 — Guardrail de rastreabilidade (US-07): classificação erro×aviso e política de regeneração

- **Status:** Accepted
- **Data:** 2026-05-30

## Contexto

A US-07 implementa a 3ª camada do guardrail anti-alucinação (ADR-0008): `validateTraceability`
compara o `ResumeContent` gerado contra o `ProfileBundle` (a base, fonte da verdade) e produz um
`TraceabilityReport` (`{ errors, warnings }`). Duas pendências da US-07 precisavam de decisão
antes de codar: (1) quantas regenerações antes de 422; (2) a heurística — testável e
determinística — para distinguir "erro forte" (entidade inexistente → regenera) de "aviso"
(número/data/tecnologia nova → revisável). O ADR-0014 hoje grava `traceabilityReport=null`;
a US-07 passa a gravar o relatório real.

## Decisão

### Política de regeneração
- Erro forte (`errors.length > 0`) → **regenerar** (nova chamada ao LLM). **Máximo 1 re-tentativa**
  (2 tentativas totais). Persistindo o erro na 2ª → **HTTP 422** `GUARDRAIL_FAILED`, com o
  relatório em `details`. Uma geração que falha o guardrail **não é persistida** (não é um
  currículo válido).
- Só `warnings` (sem `errors`) → **persiste normalmente** com o `traceabilityReport` preenchido;
  os avisos são exibidos no preview (não bloqueiam).
- 100% rastreável → relatório `{ errors: [], warnings: [] }`, persiste.

### Normalização comum
`normalize(s)` = minúsculas + remoção de diacríticos (NFD) + colapso de espaços. Reusa a mesma
ideia do `slugify` (US-06) mas preservando palavras (sem trocar por `-`).

### Erros fortes (`errors[]`) — rastreabilidade de ENTIDADE
- **experience:** todo item DEVE ter `sourceId` que exista nos ids das experiências da base; e a
  `company` (normalizada) DEVE casar com a do item da base referenciado por esse `sourceId`.
  `sourceId` ausente/inexistente, ou `company` divergente da do item real → erro.
- **education:** toda formação DEVE casar `institution` (normalizada) com alguma formação da base
  (via `sourceId` quando presente; senão por igualdade normalizada de `institution`). Sem match → erro.
- **projects:** todo projeto DEVE casar `title` (normalizado) com algum projeto da base (via
  `sourceId` quando presente; senão por `title`). Sem match → erro.
- `Issue = { field, value, reason }` descreve cada ocorrência (ex.: `field="experience[1].company"`,
  `value="Empresa X"`, `reason="empresa não encontrada na base"`).

### Avisos (`warnings[]`) — conteúdo revisável (comparação literal normalizada)
Contra o **corpus da base** = `normalize` da concatenação de TODO texto da base (summary,
company/role/bullets de cada experiência, instituições/graus, skills, projetos/techStack, etc.):
- **Números:** tokens numéricos (regex aprox. `\d+([.,]\d+)?%?`, cobre anos e percentuais) que
  aparecem em `bullets`/`objective` da saída e **não** existem como substring no corpus da base →
  aviso ("número possivelmente novo").
- **Skills:** `skills[].items` cujo nome normalizado **não** está no conjunto de skills da base → aviso.
- `objective` entra na checagem de números; checagem semântica mais profunda do objective fica
  fora de escopo (não é rastreável a um `sourceId` — limite aceito, documentado).

Critério **conservador para avisos** (preferir surfar a esconder) e **estrito para erros de
entidade** (bloquear o que claramente não vem da base).

## Consequências
- Fecha o invariante "a IA não inventa" com defesa em profundidade real (não só prompt): entidade
  fabricada é barrada e regenerada; conteúdo suspeito é exposto ao usuário.
- `validateTraceability` é função pura → cobertura de teste obrigatória (ARCHITECTURE §8).
- Custo: até 2 chamadas ao LLM por geração no pior caso; latência extra aceitável no MVP.
- Avisos por comparação literal podem ter falsos positivos (ex.: número reescrito por extenso) —
  aceito por ora; são revisáveis, não bloqueiam. Refinável numa US futura.
- 422 não persiste → o histórico (US-09) só contém currículos que passaram no guardrail.

## Alternativas consideradas
- **Regenerar N>1 vezes:** rejeitado no MVP — custo/latência crescentes com retorno decrescente;
  1 re-tentativa cobre saídas ruins transitórias.
- **Detecção semântica de número/tech via LLM:** rejeitado — não-determinístico, não testável, e
  reintroduz o próprio risco que o guardrail combate. Comparação literal normalizada é auditável.
- **Persistir a geração que falhou o guardrail (para auditoria):** rejeitado no MVP — polui o
  histórico com currículos inválidos; o 422 já devolve o relatório para diagnóstico.
