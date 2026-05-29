# 0011 — Contrato de API como schemas Zod compartilhados, congelado

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

Como o app é um único processo Next.js (sem handoff backend↔frontend separado), não há um
contrato HTTP formal entre serviços. Ainda assim, é preciso um acordo estável entre o
`architect-agent` e o `fullstack-agent` sobre tipos de request/response e rotas, definido
antes da implementação para evitar retrabalho e divergência.

## Decisão

O contrato de API são os **schemas Zod compartilhados** (`src/lib/schemas/`) — única
definição de tipos de request/response, importada por UI e Route Handlers — **mais a lista
de Route Handlers** documentada em `docs/api-contract.md`. O contrato é **congelado na
fase 4.3, antes da implementação**. Mudanças só por proposta aprovada pelo architect,
registradas como nota no topo do `api-contract.md` + ADR.

## Consequências

- Uma única fonte de verdade de tipos para cliente e servidor (sem duplicação).
- Implementação parte de um contrato estável; menos retrabalho e divergência.
- Validação em runtime (Zod) e tipos em compile-time saem do mesmo schema.
- Alterar o contrato tem custo de processo (proposta + ADR) — intencional, para estabilidade.

## Alternativas consideradas

- **OpenAPI/Swagger:** pesado e redundante para um único processo Next.js sem serviços
  externos; Zod já dá tipos + validação.
- **Contrato informal (definir tipos durante a implementação):** rejeitado por gerar
  divergência entre UI e handlers e retrabalho.
