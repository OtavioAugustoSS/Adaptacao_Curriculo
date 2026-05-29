# CV-Adapter — Adaptação de Currículo com IA

Aplicação web que usa IA para adaptar seu currículo ao template LaTeX
[faangpath-simple-template](https://www.overleaf.com/latex/templates/faangpath-simple-template/npsfpdqnxmbc)
do Overleaf. Você mantém uma base de dados pessoal e gera o `.tex` em dois modos:
**padrão** e **adaptativo a uma vaga** — sempre usando apenas informações reais (a IA não inventa).

## Stack

Next.js 15 + TypeScript · Prisma (SQLite → Postgres) · IA via NVIDIA NIM (OpenAI-compatible) ·
Zod · Vitest. Saída `.tex` (compilação no Overleaf). Detalhes em `ARCHITECTURE.md`.

## Como rodar

> O scaffold do código (Fatia 0) ainda não foi gerado. Após o scaffold:

```
cp .env.example .env      # preencha LLM_API_KEY etc.
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

## Documentação

- `ARCHITECTURE.md` — decisões de arquitetura (fonte da verdade).
- `docs/spec.md` — especificação funcional (telas e fluxos).
- `docs/erd.md` / `docs/erd.mmd` — modelo de dados.
- `docs/api-contract.md` — contrato (schemas Zod + rotas), congelado.
- `docs/user-stories/` — backlog · `docs/adr/` — decisões · `docs/release/` — relatórios.
- `template-claude-workflow.md` — o workflow de desenvolvimento seguido neste projeto.
