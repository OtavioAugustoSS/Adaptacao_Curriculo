# Agent Team — `cv-adapter-development-team`

> **⚠️ Recurso experimental.** Agent Teams roda atrás da flag
> `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (já em `.claude/settings.json`). A orquestração
> (comunicação entre agentes, checkpoints, resolução de conflito) pode não funcionar tão bem
> quanto o protocolo abaixo assume. Trate a primeira execução como **best-effort**: acompanhe
> de perto e **verifique os artefatos manualmente** — não confie cegamente que os agentes
> conversaram entre si.

Especificação do time usado na **fase de implementação** (rodando em fatias — ver
`template-claude-workflow.md` §6.8). Adaptação para um único app Next.js: **time híbrido
por fatia**.

- **Composição base (Fatias 1–3):** `lead`, `product-owner`, `architect`, **`fullstack-agent`**, `qa`.
  As fatias iniciais são pesadas de backend (renderer, dados, LLM, guardrail) com pouca UI —
  um único agente de implementação evita handoff artificial num codebase Next.js único.
- **Composição estendida (Fatia 4 — polimento visual):** o `fullstack-agent` dá lugar a
  **`frontend-agent`** + **`backend-agent`**, para um agente dedicado carregar a qualidade de
  design. O contrato Zod congelado é a fronteira que permite os dois trabalharem em paralelo
  sem um esperar o outro.

## Agentes

### `lead-agent` (Opus) — Lead
- **Ferramentas:** Read, Glob, Grep, Write
- **Output:** relatório consolidado em `docs/release/<versão>.md`
- Coordena os agentes; confirma que `docs/api-contract.md` está congelado antes de liberar a
  implementação; emite checkpoint a cada US concluída; escala bloqueios; consolida o release.

### `product-owner-agent` (Sonnet) — Product Owner
- **Ferramentas:** Read, Glob, Grep, Write, Edit
- **Output:** `docs/user-stories/*.md`
- Autoridade funcional final; resolve `[DECISÃO PENDENTE]`; responde dúvidas de requisito.

### `architect-agent` (Opus) — Architect
- **Ferramentas:** Read, Glob, Grep, Write, Edit
- **Base de decisões:** `ARCHITECTURE.md` + `docs/adr/`
- **Output:** novos ADRs em `docs/adr/`; é o **dono do contrato Zod** (`docs/api-contract.md`).
- Autoridade técnica final; aprova/rejeita mudanças no contrato; valida aderência à arquitetura.

### `fullstack-agent` (Opus) — Fullstack Developer  *(Fatias 1–3)*
- **Ferramentas:** Read, Write, Edit, Glob, Grep, Bash
- **Output:** código em `src/`, `prisma/`, `templates/`, `tests/`
- Lê `ARCHITECTURE.md`, `docs/api-contract.md`, `docs/user-stories/`, `docs/adr/`, `docs/spec.md`.
- Implementa UI + Route Handlers + lógica de servidor juntos, cumprindo o contrato Zod
  (não inventa contrato; mudança via proposta ao architect).
- Respeita a regra **LLM→JSON→renderer** e o guardrail anti-alucinação.
- Dúvida funcional → `product-owner-agent`; dúvida técnica → `architect-agent`.
- Trabalha em branch dedicada; cada US gera commit + testes.

### `qa-agent` (Opus) — Quality Engineer
- **Ferramentas:** Read, Write, Edit, Glob, Grep, Bash
- **Output:** testes em `tests/`
- Garante cobertura da lógica pura crítica (`escapeLatex`, `renderResume`, `validateTraceability`).

### `backend-agent` (Opus) — Backend Developer  *(somente Fatia 4)*
- **Ferramentas:** Read, Write, Edit, Glob, Grep, Bash
- **Ownership:** `src/server/`, `src/app/api/`, `prisma/`, `src/lib/schemas/` e Server Actions.
- É o mantenedor do contrato Zod; mudanças só via proposta ao architect.

### `frontend-agent` (Opus) — Frontend Developer  *(somente Fatia 4)*
- **Ferramentas:** Read, Write, Edit, Glob, Grep, Bash
- **Ownership:** `src/components/` e a **apresentação** de `src/app/**/page.tsx`.
- Consome os schemas Zod do contrato **read-only**; pode usar as skills `frontend-design` /
  `ui-ux-pro-max` para a qualidade visual. Dúvida técnica → `architect-agent`.

## Protocolo
- **Composição varia por fatia** (ver topo): `fullstack-agent` nas Fatias 1–3; split
  `backend-agent` + `frontend-agent` na Fatia 4.
- **Fronteira de ownership no split:** backend = `src/server/`, `src/app/api/`, `prisma/`,
  `src/lib/schemas/`, Server Actions; frontend = `src/components/` + apresentação das páginas.
  Isso evita atrito no App Router (onde Server Components/Actions borram a linha front/back).
- **Contrato Zod** (`docs/api-contract.md`) é a fonte da verdade; só o architect aprova mudança.
- Conflito funcional → PO; técnico → Architect; impasse → lead escala para o humano.
- Toda decisão técnica nova vira ADR; toda US implementada inclui testes.
- Rodar em **fatias de 3–5 US por sessão**, menor dependência primeiro; `/clear` entre fatias.

## Prompt de criação (ajuste a fatia e a composição a cada sessão)

**Fatias 1–3** (composição base, 5 agentes):

```
Crie um Agent Team chamado `cv-adapter-development-team` com 5 agentes
(Lead, PO, Architect, Fullstack, QA) seguindo docs/agent-team.md.

Regras inegociáveis:
1. docs/api-contract.md (schemas Zod) já existe e está congelado — cumprir, não inventar.
2. LLM retorna JSON validado; o .tex é renderizado por código determinístico.
3. Guardrail anti-alucinação obrigatório; a base de dados é a única fonte.
4. Toda decisão técnica nova vira ADR; toda US implementada inclui testes.
5. lead-agent emite checkpoint após cada US.

NESTA SESSÃO, implemente apenas esta fatia: <US-NN, US-NN, US-NN>.
Comece pelas de menor dependência.
```

**Fatia 4** (composição estendida — split front/back para polimento visual): troque o
`Fullstack` por `Backend` + `Frontend` (6 agentes) e acrescente a regra:
"6. Respeitem o ownership por diretório de docs/agent-team.md; o frontend consome o contrato
Zod read-only; mudança no contrato só via proposta ao architect."
