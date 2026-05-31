# Architecture Decision Records (ADRs) — CV-Adapter

Este diretório registra as decisões arquiteturais do projeto no formato
[Michael Nygard](https://github.com/joelparkerhenderson/architecture-decision-record).
Cada ADR documenta uma decisão **já tomada** (ver `ARCHITECTURE.md` §6), seu contexto,
suas consequências e as alternativas consideradas.

Idioma: PT-BR. Cada arquivo segue o padrão `NNNN-slug.md` (kebab-case).

## Índice

| ADR | Título | Status |
|---|---|---|
| [0001](0001-app-web-fullstack-nextjs.md) | Aplicação web fullstack em Next.js 15 (App Router) + TypeScript | Accepted |
| [0002](0002-saida-somente-tex-overleaf.md) | Saída somente `.tex`; compilação no Overleaf | Accepted |
| [0003](0003-ia-openai-compatible-nvidia-nim.md) | IA via cliente OpenAI-compatible → NVIDIA NIM, atrás de `LLMProvider` | Accepted |
| [0004](0004-modelo-base-url-por-env.md) | Modelo e base-URL por variável de ambiente; catálogo em código | Accepted |
| [0005](0005-dados-local-first-sqlite-prisma.md) | Dados local-first (SQLite/Prisma) migráveis para Postgres; `userId` em tudo | Accepted |
| [0006](0006-identidade-seam-getcurrentuserid.md) | Identidade via seam `getCurrentUserId()`; autenticação real adiada | Superseded by 0024 |
| [0007](0007-llm-json-validado-renderer-deterministico.md) | LLM produz JSON validado (Zod); `.tex` por renderer determinístico | Accepted |
| [0008](0008-guardrail-anti-alucinacao-3-camadas.md) | Guardrail anti-alucinação em 3 camadas | Accepted |
| [0009](0009-escape-latex-centralizado.md) | Escape LaTeX centralizado (`escapeLatex`) | Accepted |
| [0010](0010-dois-modos-mvp.md) | Dois modos no MVP (Standard, Job-adaptive); 3º modo é não-objetivo | Accepted |
| [0011](0011-contrato-api-zod-congelado.md) | Contrato de API como schemas Zod compartilhados, congelado | Accepted |
| [0012](0012-saida-estruturada-json-schema-llmprovider.md) | Saída estruturada via `response_format: json_schema` + Zod; timeout/retry no adapter | Accepted |
| [0013](0013-modelo-padrao-llama-3-3-70b.md) | Modelo padrão do MVP: `meta/llama-3.3-70b-instruct` | Accepted |
| [0014](0014-geracao-modo1-prereq-traceability-nome-arquivo.md) | Geração Modo 1: pré-requisito da base, `traceabilityReport` pré-US-07, nome do `.tex` | Accepted |
| [0015](0015-guardrail-rastreabilidade-classificacao-regeneracao.md) | Guardrail de rastreabilidade (US-07): classificação erro×aviso e regeneração | Accepted |
| [0016](0016-modo2-historico-escopo-mvp.md) | Modo 2 (US-08) e histórico (US-09): decisões de escopo do MVP | Accepted (parte do título do histórico Superseded by ADR-0021) |
| [0017](0017-tailwind-css-mapeamento-tokens-fatia-4.md) | Tailwind CSS na Fatia 4: setup no Next 15 + mapeamento dos tokens do DS | Accepted |
| [0018](0018-import-perfil-dump-education-current.md) | Fatia 5: import de perfil por dump + `Education.current` | Accepted |
| [0019](0019-import-perfil-por-arquivo.md) | Fatia 6: importar currículo por arquivo (PDF/DOCX/TXT) | Accepted |
| [0020](0020-resume-content-enriquecido-geracao-completa.md) | Fatia 7: `ResumeContent` enriquecido (idiomas, cursos, bullets+stack de projeto); geração completa e fiel | Accepted |
| [0021](0021-gestao-curriculos-nome-editar-excluir-limpar-base.md) | Fatia 7: gestão de currículos (nome/editar/excluir) e limpar a base | Accepted |
| [0022](0022-curriculo-padrao-adaptacao-referencia-profundidade.md) | Fatia 8: currículo padrão (`isDefault`) e adaptação ancorada em referência de profundidade | Accepted |
| [0023](0023-geracao-rica-timeout-prompts-tailoring.md) | Geração rica: timeout 180s+1retry+temp 0.3, prompts compactos, tailoring (achados do e2e real) | Accepted |
| [0024](0024-autenticacao-real-authjs-oauth-seam-async.md) | Fatia 9: autenticação real (Auth.js/OAuth) e seam de identidade assíncrono | Accepted |
| [0025](0025-migracao-sqlite-postgres-multiusuario.md) | Fatia 9: migração SQLite → Postgres para deploy multiusuário | Accepted |

## Template padrão de ADR

```markdown
# NNNN — Título da decisão

- **Status:** Proposed | Accepted | Deprecated | Superseded
- **Data:** AAAA-MM-DD

## Contexto

O que motivou a decisão. Forças em jogo, restrições, requisitos relevantes.

## Decisão

A decisão tomada, em frases curtas e diretas, no presente.

## Consequências

Os resultados da decisão — positivos, negativos e neutros. O que fica mais
fácil e o que fica mais difícil depois desta escolha.

## Alternativas consideradas

Opções avaliadas e descartadas, com o motivo do descarte.
```
