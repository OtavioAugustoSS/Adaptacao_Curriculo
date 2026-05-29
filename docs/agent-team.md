# Agent Team — `cv-adapter-development-team`

> **⚠️ Recurso experimental.** Agent Teams roda atrás da flag
> `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (já em `.claude/settings.json`). A orquestração
> (comunicação entre agentes, checkpoints, resolução de conflito) pode não funcionar tão bem
> quanto o protocolo abaixo assume. Trate a primeira execução como **best-effort**: acompanhe
> de perto e **verifique os artefatos manualmente** — não confie cegamente que os agentes
> conversaram entre si.

Especificação do time usado na **fase de implementação** (rodando em fatias — ver
`template-claude-workflow.md` §6.8). Adaptação para um único app Next.js: **backend e
frontend colapsados num só `fullstack-agent`**.

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

### `fullstack-agent` (Opus) — Fullstack Developer  *(substitui backend + frontend)*
- **Ferramentas:** Read, Write, Edit, Glob, Grep, Bash
- **Output:** código em `src/`, `prisma/`, `templates/`, `tests/`
- Lê `ARCHITECTURE.md`, `docs/api-contract.md`, `docs/user-stories/`, `docs/adr/`, `docs/spec.md`.
- Implementa UI + Route Handlers + lógica de servidor juntos, cumprindo o contrato Zod
  (não inventa contrato; mudança via proposta ao architect).
- Respeita a regra **LLM→JSON→renderer** e o guardrail anti-alucinação.
- Dúvida funcional → `product-owner-agent`; dúvida técnica → `architect-agent`.
- Trabalha em branch dedicada; cada US gera commit + testes.

### `qa-agent` (opus) — Quality Engineer
- **Ferramentas:** Read, Write, Edit, Glob, Grep, Bash
- **Output:** testes em `tests/`
- Garante cobertura da lógica pura crítica (`escapeLatex`, `renderResume`, `validateTraceability`).

## Protocolo
- **Contrato Zod** (`docs/api-contract.md`) é a fonte da verdade; só o architect aprova mudança.
- Conflito funcional → PO; técnico → Architect; impasse → lead escala para o humano.
- Toda decisão técnica nova vira ADR; toda US implementada inclui testes.
- Rodar em **fatias de 3–5 US por sessão**, menor dependência primeiro; `/clear` entre fatias.

## Prompt de criação (ajuste a fatia a cada sessão)

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
