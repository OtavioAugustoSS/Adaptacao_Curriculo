# US-06 — Download do .tex + preview na tela

**Fatia:** 2 — Modo 1 (currículo padrão)
**Dependências:** US-05 (existe um `GeneratedResume` com `texOutput`)

## História

**Como** usuário,
**quero** visualizar o `.tex` gerado na tela `/gerar` e baixá-lo (ou copiá-lo),
**para** levar o arquivo ao Overleaf e compilar meu PDF.

## Descrição

- Preview na tela `/gerar`: exibir o `.tex` gerado em bloco de código, com botão **Copiar** e botão **Baixar `.tex`**.
- Rota `GET /api/resumes/[id]/download` — serve o `texOutput` cacheado como `text/plain` com `Content-Disposition: attachment` (sem nova chamada ao LLM).
- Resolução de usuário via `getCurrentUserId()`; 404 se o `GeneratedResume` não existir/não pertencer ao usuário.
- Nome de arquivo sugerido (ex.: `curriculo-<id>.tex`).

## Referências

- **Spec:** §2.2 (Preview do resultado — bloco de código, Baixar `.tex`, Copiar; placeholder para avisos de rastreabilidade).
- **Contrato de API:** `GET /api/resumes/[id]/download` (`text/plain`, `Content-Disposition: attachment`); status 404.
- **ERD:** `GeneratedResume.texOutput` (cache servido sem refazer LLM).
- **Código:** `src/app/api/resumes/[id]/download/route.ts`, `src/app/(dashboard)/gerar/page.tsx`, `src/components/` (preview).
- **Arquitetura:** §1 (saída somente `.tex`, compila no Overleaf), §4 (`texOutput` cacheado), ADR-0002.

## Estados envolvidos

- Preview com `.tex` disponível.
- Copiar (feedback de cópia).
- Download iniciado.
- `GeneratedResume` inexistente → 404.

## Fora do escopo

- Compilação para PDF (não-objetivo do MVP — Overleaf).
- Lista de avisos de rastreabilidade no preview (US-07).
- Histórico / re-download a partir de `/curriculos` (US-09).

## Pendências

- [DECISÃO PENDENTE] Convenção do nome do arquivo `.tex` (incluir nome da pessoa? data? modo?). Definir padrão.
