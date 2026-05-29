# 0001 — Aplicação web fullstack em Next.js 15 (App Router) + TypeScript

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

O produto precisa de UI (editar a base de dados, gerar e baixar currículos) e de
lógica de servidor (chamadas ao LLM, render LaTeX, persistência). O time é pequeno
e quer evitar o custo de manter dois projetos separados (backend + frontend) com um
handoff de contrato entre eles. A tipagem ponta a ponta é desejável.

## Decisão

Construir uma única aplicação web fullstack em **Next.js 15 (App Router)** com
**TypeScript estrito**. UI, Route Handlers e Server Actions vivem no mesmo codebase.
Os mesmos schemas Zod servem de tipos no cliente e no servidor.

## Consequências

- Um único repositório, deploy e pipeline; sem handoff backend↔frontend.
- Tipos compartilhados entre UI e API sem duplicação nem serialização de contrato.
- Caminho de deploy futuro direto na Vercel.
- Acoplamento ao ecossistema Next.js/React; convenções do App Router precisam ser seguidas.
- Lógica de servidor sensível (chaves de LLM) deve ficar restrita a Route Handlers/Server Actions.

## Alternativas consideradas

- **Remix:** fullstack capaz, mas sem a tração e o caminho de deploy do Next.js para o time.
- **SvelteKit:** exigiria sair do ecossistema React, sem ganho que justifique.
- **Vite + API separada (backend dedicado):** dois projetos, contrato explícito entre
  eles e mais infraestrutura — overhead desnecessário para um app single-user no MVP.
