# User Stories — CV-Adapter

Índice das user stories do MVP, derivadas de `ARCHITECTURE.md`, `docs/spec.md` (telas e
fluxos), `docs/erd.md` (entidades) e `docs/api-contract.md` (rotas e schemas).

Formato: **Como X, quero Y, para Z**. Escopo de implementação guiada — sem critérios de
aceite detalhados e sem story points. Cada US referencia as fontes (tela / endpoint /
entidade) e marca **[DECISÃO PENDENTE]** onde a fonte é ambígua.

## Ordem de implementação (menor dependência primeiro)

As US estão ordenadas por dependência. Recomenda-se implementar nesta ordem; dentro de uma
mesma fatia, itens sem dependência mútua podem andar em paralelo.

### Fatia 1 — Fundações sem LLM

| US | Título | Depende de |
|---|---|---|
| [US-01](./US-01-renderer-deterministico-tex.md) | Renderer determinístico: ResumeContent → .tex (faangpath) | — |
| [US-02](./US-02-crud-perfil-base.md) | CRUD do Perfil (cabeçalho + resumo) | — |
| [US-03](./US-03-gerenciar-itens-base.md) | Gerenciar itens da base com ordenação | US-02 |

### Fatia 2 — Modo 1 (currículo padrão)

| US | Título | Depende de |
|---|---|---|
| [US-04](./US-04-camada-ia-llmprovider-nim.md) | Camada de IA: LLMProvider + adapter NIM | — |
| [US-05](./US-05-fluxo-geracao-modo1-standard.md) | Fluxo de geração Modo 1 (currículo padrão) | US-01, US-03, US-04 |
| [US-06](./US-06-download-tex-preview.md) | Download do .tex + preview na tela | US-05 |

### Fatia 3 — Guardrail + Modo 2

| US | Título | Depende de |
|---|---|---|
| [US-07](./US-07-guardrail-rastreabilidade.md) | Guardrail de rastreabilidade (anti-alucinação) | US-05 |
| [US-08](./US-08-modo2-adaptativo-vaga.md) | Modo 2 adaptativo à vaga | US-05, US-07 |
| [US-09](./US-09-historico-curriculos.md) | Histórico de currículos | US-05, US-06 |

### Fatia 4 — Polimento visual

| US | Título | Depende de |
|---|---|---|
| [US-10](./US-10-redesign-visual-dev-tool.md) | Redesign visual dev-tool (casca + Início + Perfil + Gerar + Currículos), design system, Tailwind, light+dark | US-02..09, ADR-0017 |

### Grafo de dependência resumido

```
US-01 ─┐
US-02 → US-03 ─┐
US-04 ─────────┤→ US-05 → US-06 ─┐
               │        └→ US-07 ─┤
               │                  ├→ US-08
               │                  └→ US-09
```

## Template padrão de US

Use este modelo ao criar novas US (`US-NN-slug.md`, kebab-case):

```markdown
# US-NN — Título

**Fatia:** <1 | 2 | 3 — nome da fatia>
**Dependências:** <US-XX, US-YY | nenhuma>

## História

**Como** <ator>,
**quero** <ação/objetivo>,
**para** <benefício/razão>.

## Descrição

- <o que entregar, em itens objetivos e rastreáveis às fontes>

## Referências

- **Spec:** <seção de `docs/spec.md` — telas/estados/fluxos>
- **Contrato de API:** <rotas e schemas de `docs/api-contract.md`>
- **ERD:** <entidades/campos de `docs/erd.md`>
- **Código:** <arquivos previstos em ARCHITECTURE §3>
- **Arquitetura:** <seções/ADRs relevantes>
- **Testes:** <arquivos de teste, se cobertura obrigatória>

## Estados envolvidos

- <estados de UI/fluxo conforme a spec>

## Fora do escopo

- <o que esta US explicitamente não cobre>

## Pendências

- [DECISÃO PENDENTE] <pergunta direta sobre ambiguidade da fonte>
```

## Sugestões adicionais (fora da lista pedida)

Itens importantes percebidos durante a derivação, **não** transformados em US (precisam de
decisão antes de virar escopo):

- **[SUGESTÃO ADICIONAL] Seed e seam de identidade como pré-requisito operacional.** O
  `prisma/seed.ts` (cria `LOCAL_USER_ID` + base de exemplo) e `getCurrentUserId.ts` são
  citados em ARCHITECTURE §3/§5 e usados por quase todas as US, mas não há US dedicada.
  Sugere-se uma US-00 de bootstrap (schema Prisma inicial + seed + seam) antes da Fatia 1,
  ou incorporá-los explicitamente em US-02.
- **[SUGESTÃO ADICIONAL] Envelope de erro e validação Zod nas rotas.** O contrato (§2)
  define `{ error: { code, message, details? } }` e mapeamento de status (400/404/422/502).
  Vale uma US transversal (ou nota de implementação) padronizando o tratamento de erro em
  todos os Route Handlers.
- **[SUGESTÃO ADICIONAL] Catálogo/seleção de modelo na UI.** `models.ts` mantém um catálogo
  e o `MODEL_ID` vem por env; a spec não prevê o usuário escolher modelo na tela `/gerar`.
  Confirmar se a seleção de modelo é só por env (MVP) ou se vira UI futura.
- **[SUGESTÃO ADICIONAL] Layout/navegação do dashboard.** `src/app/layout.tsx` e a
  navegação entre `/perfil`, `/gerar`, `/curriculos` não têm US própria; a spec descreve as
  telas isoladamente. Pode ser uma pequena US de shell de navegação.
