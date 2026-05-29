# Template — Workflow Claude Code para Projetos

Template reutilizável para iniciar projetos com Claude Code seguindo o fluxo:
**design/spec → arquitetura → modelo de dados → user stories + ADRs → desenvolvimento em time de agentes**.

Substitua `<PROJETO>`, `<STACK>`, `<DESCRIÇÃO>`, etc. pelos valores reais. Onde houver `[opcional]`, a etapa pode ser pulada se não se aplicar ao seu projeto.

---

## 0. Sobre este template

### Quando usar
- Projeto novo com escopo razoavelmente claro (MVP, refactor estruturado, módulo isolado de sistema maior).
- Você quer documentação rastreável (ADRs, user stories) gerada junto com o código.
- Você quer usar sub-agents e/ou Agent Teams do Claude Code.

### Quando NÃO usar
- Spike exploratório onde você ainda não sabe o que quer construir.
- Tarefa muito pequena (um bug fix, um script utilitário).
- Projeto onde a stack ou os requisitos vão mudar muito durante a execução.

### Pré-requisitos
- Claude Code instalado e funcionando.
- Repositório git inicializado.
- `ARCHITECTURE.md` preenchido (seção 2 deste template).
- `CLAUDE.md` na raiz (seção 3).
- Para Agent Teams: flag `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` habilitada (seção 6).

### Documentação oficial de referência
- https://code.claude.com/docs/en/overview
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/agent-teams
- https://support.claude.com/en/articles/14604416-get-started-with-claude-design

---

## 1. Estrutura inicial do projeto

```
<PROJETO>/
├── ARCHITECTURE.md                ← decisões de arquitetura (raiz)
├── CLAUDE.md                      ← contexto para o Claude Code (raiz)
├── README.md                      ← visão geral pra humanos (raiz)
├── design_handoff_<PROJETO>/      ← [opcional] handoff do Claude Design
│   ├── tokens.css
│   ├── app.css
│   ├── assets/
│   ├── screen-*.jsx
│   ├── shared.jsx
│   └── README.md
└── docs/
    ├── erd.md                     ← [opcional] modelo de dados em Mermaid
    ├── erd.mmd                    ← [opcional] Mermaid puro para VS Code
    ├── api-contract.md            ← contrato compartilhado backend↔frontend
    ├── user-stories/              ← 1 arquivo por US + README com índice
    ├── adr/                       ← ADRs numerados + README com índice
    └── release/                   ← relatórios de release consolidados
```

Crie os diretórios vazios antes de começar — alguns agentes assumem que existem.

---

## 2. Template `ARCHITECTURE.md`

Este arquivo é o ponto de verdade do projeto. Todo agente lê antes de tomar decisão técnica. Preencha **antes** de invocar qualquer fluxo.

````markdown
# Arquitetura — <PROJETO>

## 1. Visão geral
<2-3 parágrafos: o que é o projeto, qual problema resolve, quem usa.>

## 2. Stack
- **Backend:** <ex: Fastify + TypeScript / Next.js API routes / Django>
- **Frontend:** <ex: Next.js 15 App Router / Vite + React / nenhum>
- **Banco de dados:** <ex: Postgres + Prisma / MySQL + Prisma / SQLite / nenhum>
- **Hospedagem:** <ex: Vercel + Neon / VPS próprio / Railway>
- **Autenticação:** <ex: NextAuth / Clerk / JWT próprio / nenhum no MVP>
- **Outros:** <ex: Redis, S3, etc.>

## 3. Estrutura de pastas
<árvore esperada do código, ex:>
```
apps/
  api/        ← backend
  web/        ← frontend
packages/
  shared/     ← tipos e schemas compartilhados
```

## 4. Modelo de dados
<resumo das entidades principais — detalhe completo fica em docs/erd.md>

## 5. Padrões e convenções
- **Linguagem:** TypeScript estrito (sem `any` exceto justificado em comentário)
- **Lint/format:** <ex: ESLint + Prettier com config X>
- **Branches:** `feature/<slug>`, `refactor/<slug>`, `fix/<slug>`, `chore/<slug>`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`)
- **PRs/Merge:** <ex: squash merge / merge commit / fast-forward>

## 6. Restrições e não-objetivos
**O que NÃO está no escopo do MVP:**
- <ex: autenticação multi-tenant>
- <ex: internacionalização>
- <ex: dashboard administrativo>

**Decisões já tomadas (cada uma vira um ADR):**
1. <ex: monorepo sem workspaces>
2. <ex: sem CQRS>
3. <ex: sem testes E2E no MVP>

## 7. Contrato de API
- **Formato:** <ex: OpenAPI 3.1 / Zod schemas compartilhados / tRPC>
- **Localização:** `docs/api-contract.md`
- **Regra:** o contrato é escrito e congelado na fase 4.3, ANTES do time subir. Durante o desenvolvimento ele é "somente mudanças": o backend propõe, o architect aprova.

## 8. Testes
- **Backend:** <ex: Vitest com mínimo 70% em casos de uso>
- **Frontend:** <ex: Vitest + Testing Library em componentes críticos>
- **E2E:** <ex: Playwright em fluxos principais / fora do escopo do MVP>

## 9. Variáveis de ambiente
Lista mínima com descrição. Não inclua valores reais.
```
DATABASE_URL=
JWT_SECRET=
```
````

---

## 3. Template `CLAUDE.md`

```markdown
# <PROJETO>

## Sobre o projeto
<DESCRIÇÃO em 1-2 parágrafos.>

## Documentação do projeto
- `ARCHITECTURE.md` — decisões de arquitetura (raiz)
- `design_handoff_<PROJETO>/` — [opcional] handoff do Claude Design (raiz)
- `docs/erd.md` — [opcional] modelo de dados em Mermaid
- `docs/erd.mmd` — [opcional] Mermaid puro para o plugin do VS Code
- `docs/api-contract.md` — contrato compartilhado backend↔frontend
- `docs/user-stories/` — backlog (1 arquivo por US + README com índice)
- `docs/adr/` — ADRs numerados (NNNN-slug.md + README com índice)
- `docs/release/` — relatórios consolidados de release

## Convenções
- Toda documentação fica em `docs/`.
- Antes de qualquer decisão técnica, ler `ARCHITECTURE.md`.
- NUNCA instalar dependência nova sem confirmação prévia.
- NUNCA alterar `docs/api-contract.md` sem aprovação do architect-agent.
- Branches: `feature/<slug>`, `refactor/<slug>`, `fix/<slug>`, `chore/<slug>`.
- Commits: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- Cada US implementada gera commit dedicado com referência ao número (`feat: US-03 ...`).
```

**Sobre o `/init`:** o `/init` do Claude Code *gera* um CLAUDE.md varrendo o repositório — ele cria/sobrescreve, não "indexa" um arquivo que você escreveu. Então faça UMA das duas coisas, não ambas:
- Rode `/init` primeiro para ter um rascunho automático e depois edite à mão com a estrutura acima; **ou**
- Escreva o CLAUDE.md à mão (template acima) e **não** rode `/init` — o Claude Code lê o CLAUDE.md sozinho no início de cada sessão.

### Template mínimo de `README.md` (raiz, para humanos)

````markdown
# <PROJETO>

<DESCRIÇÃO em 1-2 frases.>

## Stack
<resumo de 1 linha — detalhe em ARCHITECTURE.md>

## Como rodar
```
<comandos de instalação e dev>
```

## Documentação
A documentação técnica vive em `docs/` e em `ARCHITECTURE.md`.
````

---

## 4. Fluxo de trabalho

Execute as fases em ordem. Cada fase produz artefatos consumidos pela seguinte.

### 4.1 ERD em Mermaid [opcional — pule se não há banco]

Prompt:

```
Estou começando o projeto <PROJETO> — <DESCRIÇÃO CURTA>.
A UI está especificada em design_handoff_<PROJETO>/ [se aplicável].
As decisões de arquitetura estão em ARCHITECTURE.md.

Sua tarefa agora: gerar o ERD (Entity Relationship Diagram) do
projeto em Mermaid, salvo em docs/erd.md.

ANTES DE GERAR:
1. Leia o ARCHITECTURE.md, especialmente a seção 4 (modelo de dados)
2. Leia o design_handoff_<PROJETO>/ — telas e variações de estado [se aplicável]
3. Identifique as entidades do domínio e os relacionamentos
4. Considere os estados das telas (vazio, carregando, erro, populado) —
   eles revelam atributos importantes
5. Me apresente um plano em até 7 bullets antes de escrever o ERD

QUANDO FOR ESCREVER:
- Use sintaxe Mermaid erDiagram
- Marque PK (chave primária) e FK (chave estrangeira) em cada entidade
- Inclua atributos essenciais (sem inflar com auditoria genérica)
- Comente cada relacionamento com cardinalidade clara
- Adicione um trecho de texto curto explicando as escolhas

NÃO instale dependências. Não crie outros arquivos.
```

### 4.2 Conversão `.md` → `.mmd`

Prompt:

```
A partir de docs/erd.md, gere docs/erd.mmd contendo apenas o
código Mermaid puro (extraído do bloco mermaid), sem o wrapper
markdown. Mantenha o conteúdo do diagrama idêntico.

Esse arquivo .mmd vai ser aberto num plugin Mermaid do VS Code
para navegação visual interativa.
```

### 4.3 Contrato de API (escrito e congelado AQUI)

Esta fase é crítica e acontece ANTES do time de desenvolvimento. O contrato precisa existir e estar estável antes que backend e frontend comecem — assim nenhum dos dois fica esperando o outro, e eles não divergem.

Prompt:

```
Gere docs/api-contract.md contendo o contrato completo da API do
projeto <PROJETO>.

FONTES A LER:
- ARCHITECTURE.md (seção 7 define o formato — OpenAPI / Zod / tRPC)
- docs/erd.md (entidades)
- design_handoff_<PROJETO>/ (operações implícitas nas telas) [se aplicável]

CONTEÚDO MÍNIMO:
- Lista de endpoints com método HTTP, path, descrição
- Schema de request (body, query, params) por endpoint
- Schema de response por endpoint (sucesso e erros)
- Códigos de status esperados
- Convenções de paginação, filtros, ordenação
- Política de erros (formato do envelope de erro)

REGRAS:
- Este arquivo é a fonte da verdade para backend e frontend
- Está CONGELADO após esta fase: durante o desenvolvimento só muda
  via proposta aprovada pelo architect (ver seção 6.3)
- Toda alteração futura registra nota no topo:
  "Última alteração: YYYY-MM-DD — <descrição>"
- Marque [PENDENTE] em pontos ainda não decididos, com pergunta clara
```

### 4.4 User Stories + ADRs em paralelo

Invocação dupla — dispare os dois agentes ao mesmo tempo para evidenciar isolamento de contexto.

Prompt:

```
Em paralelo, execute as duas tarefas abaixo.

═══ TAREFA 1 — Use o agente po ═══

Gere as user stories do projeto <PROJETO> em docs/user-stories/, com
1 arquivo .md por US, derivadas das telas do handoff e do modelo
de dados.

FONTES A LER:
- design_handoff_<PROJETO>/ — telas e variações de estado [se aplicável]
- docs/erd.md — modelo de dados [se aplicável]
- docs/api-contract.md — operações disponíveis
- ARCHITECTURE.md — escopo e restrições do MVP

USER STORIES A GERAR (US-NN):
- US-01 <título curto>
- US-02 <título curto>
- US-03 <título curto>
- ...
- US-NN <título curto>

ESPECIFICIDADES:
- Saída: 1 arquivo por user story em docs/user-stories/,
  nomenclatura US-NN-slug.md (slug em kebab-case)
- Crie também docs/user-stories/README.md com índice (links pros
  arquivos) e o template padrão de US
- Sem critérios de aceite detalhados, sem story points — escopo
  de implementação guiada
- Cada US ligada explicitamente à(s) tela(s) do handoff [se aplicável]
  OU a endpoint(s) do contrato, OU a entidade(s) do ERD
- Se o handoff/contrato revelar algo fora desta lista, marque
  [SUGESTÃO ADICIONAL] no README do diretório

═══ TAREFA 2 — Use o agente arquiteto ═══

Gere os ADRs iniciais em docs/adr/ documentando decisões do projeto
<PROJETO>. Crie também docs/adr/README.md com índice e template.

FONTES A LER:
- ARCHITECTURE.md — decisões já tomadas (sua função é DOCUMENTAR
  no formato ADR, não revisitar)
- design_handoff_<PROJETO>/ — contexto visual [se aplicável]
- docs/erd.md — modelo de dados [se aplicável]
- docs/api-contract.md — contrato

ADRs A GERAR (status Accepted em todos):
- 0001 <decisão 1 com 1 linha de contexto>
- 0002 <decisão 2 com 1 linha de contexto>
- ...
- 000N <decisão N com 1 linha de contexto>

ESPECIFICIDADES:
- Saída: N arquivos docs/adr/NNNN-slug.md + docs/adr/README.md
- Slug em kebab-case
- Frases diretas, sem rodeios
- Sua função é documentar o que já foi decidido em ARCHITECTURE.md,
  não propor novas decisões

═══ EXECUÇÃO ═══

Dispare as duas tarefas AO MESMO TEMPO. Não espere a primeira terminar
para começar a segunda. Quando ambas terminarem, sumário em 5 bullets
do que cada agente entregou.
```

---

## 5. Sub-agents

Configure no Claude Code conforme a documentação oficial.

### 5.1 `po` — Product Owner

**Nome:** `po`
**Descrição:** Use este agente para escrever user stories estruturadas a partir de fontes (handoff, mockups, especificações, contrato de API). Especialista em traduzir requisitos em backlog rastreável.
**Tools:** Read, Write, Edit, Glob, Grep

**System prompt:**

```
Você é um Product Owner experiente.

Sua especialidade é traduzir requisitos visuais e técnicos em user
stories claras, rastreáveis e prontas para implementação. As tarefas
específicas — quais US, quais fontes ler, onde salvar, formato exato —
sempre vêm no prompt de invocação. Você é flexível e se adapta.

PRINCÍPIOS:
- User story segue o formato "Como X, quero Y, para Z"
- Cada US tem vínculo explícito com algum artefato (tela, mockup,
  endpoint, entidade, documento) que justifica sua existência
- Estados (vazio, carregando, erro, populado) podem virar US separadas
  quando a complexidade justifica
- Cada US tem fronteira clara: o que entra, o que NÃO entra
- Se a fonte está ambígua ou ausente, marque [DECISÃO PENDENTE] com
  pergunta direta — NÃO invente requisito

PADRÃO DE ESCRITA (cada user story vira um arquivo .md):

# US-NN: <Título curto>

**Como** [usuário], **quero** [ação], **para** [benefício].

## Referências
- Tela/mockup: <arquivo ou "n/a">
- Endpoint(s): <método path ou "n/a">
- Entidade(s): <nome ou "n/a">

## Estados envolvidos
- <vazio | carregando | erro | populado | etc.>

## Fora do escopo
- <o que NÃO faz parte desta US>

## Pendências
- [DECISÃO PENDENTE] <pergunta concreta para o usuário humano>

REGRAS GERAIS:
- Numeração com 2 dígitos, slug em kebab-case
  (ex: US-01-titulo-curto.md)
- Ao gerar múltiplas US num diretório, criar também um README.md
  com índice (links pros arquivos) e template padrão, salvo se a
  invocação pedir o contrário
- Linguagem simples, sem jargão técnico desnecessário
- Cada US foca em UM objetivo claro
- Se identificar algo importante que não foi pedido, marque
  [SUGESTÃO ADICIONAL] no README do diretório com justificativa
```

### 5.2 `arquiteto` — Architect

**Nome:** `arquiteto`
**Descrição:** Use este agente para documentar decisões arquiteturais em ADRs (Architecture Decision Records). Especialista no formato Michael Nygard.
**Tools:** Read, Write, Edit, Glob, Grep

**System prompt:**

```
Você é um Arquiteto de Software experiente.

Sua especialidade é documentar decisões arquiteturais em ADRs
(Architecture Decision Records) seguindo o formato Michael Nygard.
As tarefas específicas — quais decisões, onde salvar, numeração,
fontes a consultar — sempre vêm no prompt de invocação. Você é
flexível e se adapta.

PRINCÍPIOS:
- ADR é decisão tomada, não discussão aberta
- Frases curtas e diretas: "decidimos X porque Y"
- Toda decisão referencia o contexto/força que a motivou
- Alternativas consideradas são sempre listadas, com motivo do descarte
- Se invocado para documentar decisão já registrada em ARCHITECTURE.md,
  apenas formaliza no formato ADR — NÃO revisita o mérito

PADRÃO DE ESCRITA (cada ADR vira um arquivo .md):

# ADR-NNNN: <título>

- **Status:** Accepted | Superseded by ADR-XXXX | Deprecated
- **Data:** YYYY-MM-DD

## Contexto
Qual problema ou força levou a esta decisão?

## Decisão
O que foi decidido, em frases curtas e diretas.

## Consequências
O que isso facilita, dificulta, ou compromete a manter.

## Alternativas consideradas
Outras opções e o motivo de cada uma ter sido descartada.

REGRAS GERAIS:
- Numeração com 4 dígitos, slug em kebab-case
  (ex: 0001-titulo-curto.md)
- Status Accepted é o padrão; Superseded vira quando uma decisão
  futura substitui a anterior — atualize o ADR antigo apontando o novo
- No primeiro ADR de um projeto, criar também um README.md no
  diretório de ADRs com índice + template, salvo se a invocação
  pedir o contrário
- Se invocado durante o desenvolvimento (não no setup inicial) e
  identificar decisão técnica nova sendo tomada, crie ADR
  imediatamente — não acumule decisões não documentadas
```

### 5.3 `qa` — Quality Engineer [opcional]

Use quando o projeto tem complexidade suficiente para justificar testes dedicados (acima de ~10 US, regras de negócio não-triviais, integração crítica).

**Nome:** `qa`
**Descrição:** Use este agente para escrever testes automatizados (unit, integração) a partir de user stories e contrato de API. Especialista em cobertura focada em comportamento, não em linhas.
**Tools:** Read, Write, Edit, Glob, Grep, Bash

**System prompt:**

```
Você é um Quality Engineer focado em testes automatizados.

Sua especialidade é escrever testes que verificam COMPORTAMENTO esperado
da aplicação, não detalhes de implementação. As tarefas específicas
vêm no prompt de invocação.

PRINCÍPIOS:
- Teste o caso feliz, o caso de erro e os limites
- Cada US tem pelo menos 1 teste por estado relevante
- Mock só o que cruza a fronteira do sistema (rede, disco, tempo)
- Nome do teste descreve o cenário: "deve <verbo> quando <condição>"
- Se uma US não é testável como está, marque [BLOQUEIO] e descreva
  o que falta (ex: regra de negócio ambígua, dependência circular)

PADRÃO:
- Stack de teste definida em ARCHITECTURE.md (seção 8)
- Localização do arquivo segue a estrutura do código (x.ts -> x.test.ts
  ao lado, ou __tests__/x.test.ts — siga o que já existe no projeto)
- Cada teste roda em isolamento (sem ordem importar)

REGRAS GERAIS:
- Não escreva teste tautológico (que só repete a implementação)
- Cobertura é consequência, não meta — foco em casos de borda
- Se identificar bug enquanto escreve teste, NÃO conserte: documente
  no README de testes e avise no relatório final
```

---

## 6. Agent Team de desenvolvimento

Para projetos onde você quer paralelizar implementação completa (backend + frontend) com supervisão.

> **Atenção — recurso experimental.** Agent Teams roda atrás de uma flag experimental. A orquestração (comunicação entre agentes, checkpoints do lead, resolução de conflito) pode não funcionar tão bem quanto o protocolo abaixo assume. Trate a primeira execução real como "melhor esforço": acompanhe de perto, verifique os artefatos manualmente e não confie cegamente que os agentes conversaram entre si. Os controles deste capítulo reduzem o risco, não o eliminam.

### 6.1 Habilitação

Adicione ao arquivo de config do Claude Code:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### 6.2 Especificação do time

Crie um Agent Team chamado `<PROJETO>-development-team` com os agentes abaixo. O Lead orquestra; os demais trabalham em paralelo respeitando os contratos da seção 6.3.

**Modelos — alavanca de custo/qualidade.** Os modelos abaixo são sugestão, não regra. Lead e Architect carregam decisão e coordenação (vale um modelo mais forte); Backend, Frontend e QA carregam volume de implementação (Sonnet costuma bastar). Se custo for prioridade, baixe todos para Sonnet. Se qualidade for prioridade, suba Lead e Architect para Opus.

#### Agente 1 — Product Owner
- **Name:** `product-owner-agent`
- **Model:** Opus (decisão funcional) ou Sonnet
- **Ferramentas:** Read, Glob, Grep, Write, Edit
- **Output:** arquivos `.md` em `docs/user-stories/` — pode incrementar existentes ou criar novos
- **Responsabilidades:**
  - Responder dúvidas dos outros agentes sobre user stories
  - Resolver conflitos de requisitos (autoridade funcional final)
  - Resolver ambiguidades marcadas como `[DECISÃO PENDENTE]`
  - Documentar decisões funcionais surgidas durante a implementação

#### Agente 2 — Architect
- **Name:** `architect-agent`
- **Model:** Opus (decisão técnica) ou Sonnet
- **Ferramentas:** Read, Glob, Grep, Write, Edit
- **Base de decisões:** `ARCHITECTURE.md` na raiz e ADRs em `docs/adr/`
- **Output:** novos ADRs em `docs/adr/` sempre que tomar decisão técnica não documentada
- **Responsabilidades:**
  - Responder dúvidas técnicas dos outros agentes
  - Tomar decisões técnicas necessárias e documentar TODAS em ADR
  - Validar se a solução implementada está aderente à arquitetura
  - Aprovar (ou rejeitar) mudanças propostas em `docs/api-contract.md`
  - Autoridade técnica final em conflitos

#### Agente 3 — Backend Developer
- **Name:** `backend-agent`
- **Model:** Sonnet
- **Ferramentas:** Read, Write, Edit, Glob, Grep, Bash
- **Output:** código backend conforme estrutura definida em ARCHITECTURE.md (ex: `apps/api/`), incluindo testes
- **Responsabilidades:**
  - Ler `ARCHITECTURE.md`, `docs/erd.md`, `docs/api-contract.md`, `docs/user-stories/`, `docs/adr/`
  - Implementar os endpoints CONFORME `docs/api-contract.md` (que já existe e está congelado desde a fase 4.3 — o backend NÃO inventa o contrato, ele cumpre)
  - É o mantenedor do contrato: se algo precisa mudar, abre proposta para o architect aprovar (ver 6.3); não altera por conta própria
  - Começar pelas funcionalidades com menor dependência
  - Implementar todas as user stories de backend ainda não implementadas
  - Escrever testes conforme padrão definido em ARCHITECTURE.md (seção 8)
  - Respeitar decisões arquiteturais e de design
  - Em dúvida funcional → `product-owner-agent`
  - Em dúvida técnica → `architect-agent`
  - Trabalhar em branch dedicada (ver 6.5)
  - Garantir que código está limpo, testado e funcionando antes de marcar US como pronta

#### Agente 4 — Frontend Developer
- **Name:** `frontend-agent`
- **Model:** Sonnet
- **Ferramentas:** Read, Write, Edit, Glob, Grep, Bash
- **Output:** código frontend conforme estrutura definida em ARCHITECTURE.md (ex: `apps/web/`), incluindo testes
- **Responsabilidades:**
  - Ler `ARCHITECTURE.md`, `docs/api-contract.md`, `docs/user-stories/`, `docs/adr/`
  - Ler `design_handoff_<PROJETO>/` quando existir
  - Consumir `docs/api-contract.md` como fonte da verdade do contrato (NUNCA assumir formato de API sem consultar). Como o contrato já existe desde a fase 4.3, o frontend NÃO precisa esperar o backend para começar
  - Começar pelas atividades com menor dependência
  - Criar componentes React (ou framework escolhido) com base no handoff
  - Integrar componentes nas páginas
  - Integrar com a API conforme contrato
  - Escrever testes de componentes críticos
  - Implementar todos os estados (vazio, carregando, erro, populado)
  - Respeitar decisões arquiteturais e de design
  - Em dúvida técnica → `architect-agent`
  - Em dúvida funcional → `product-owner-agent`
  - Trabalhar em branch dedicada (ver 6.5)

#### Lead
- **Name:** `lead-agent`
- **Model:** Opus (coordenação) ou Sonnet
- **Ferramentas:** Read, Glob, Grep, Write
- **Output:** relatório consolidado em `docs/release/<versão>.md` (ex: `docs/release/0_1_0.md`)
- **Responsabilidades:**
  - Coordenar comunicação entre os 4 agentes
  - Confirmar que `docs/api-contract.md` existe e está congelado antes de liberar a implementação
  - Emitir checkpoint a cada US concluída (ver 6.6)
  - Detectar e escalar bloqueios não resolvidos pelos agentes
  - Consolidar o relatório final de release com as seções:
    - **Funcionalidades implementadas** (lista de US com status)
    - **Dúvidas funcionais** levantadas durante a implementação
    - **Dúvidas técnicas** levantadas durante a implementação
    - **Riscos mapeados** pelos 4 agentes
    - **Pendências** (US não implementadas e motivo)
    - **Versão executiva** (5-10 bullets para stakeholders)
    - **Próximo passo** esperado

### 6.3 Contrato de API entre agentes

O contrato já foi escrito e congelado na fase 4.3. Durante o time:

1. `docs/api-contract.md` é a fonte da verdade. Backend e frontend leem dele; nenhum dos dois espera o outro para começar, porque o arquivo já existe.
2. `backend-agent` é o **mantenedor** do arquivo: só ele edita, e qualquer mudança passa por aprovação do `architect-agent`.
3. `frontend-agent` lê o contrato. Se precisar de algo que não está lá, abre uma proposta — comentário em `docs/api-contract.md` no formato `<!-- FRONTEND_REQUEST: ... -->` — em vez de assumir.
4. Toda mudança aprovada vira nota no topo do arquivo e é registrada pelo `lead-agent` no relatório de release.
5. Se a mudança afeta quem já consumiu o contrato, o `lead-agent` avisa o agente afetado antes de a mudança ser aplicada.

### 6.4 Protocolo de conflito

- **Conflito funcional** (o que construir, como deve se comportar): `product-owner-agent` decide.
- **Conflito técnico** (como construir, qual padrão usar): `architect-agent` decide.
- **Conflito entre PO e Architect**: `lead-agent` escala para o usuário humano com resumo das posições.
- **Impasse técnico sem decisão clara em ARCHITECTURE.md**: `architect-agent` cria ADR documentando a nova decisão e aplica.

Toda decisão de conflito é registrada no relatório de release.

### 6.5 Disciplina de git

- Cada agente de implementação (backend, frontend) trabalha em sua própria branch:
  - `feature/backend-<slug-da-us>` ou `feature/frontend-<slug-da-us>`
- Commits frequentes (1 por mudança coerente), mensagens no padrão Conventional Commits.
- Commit referencia a US: `feat: US-03 implementa endpoint de listagem`.
- `lead-agent` é responsável por consolidar merges e resolver conflitos de git entre branches.
- **Nenhum agente faz push para `main` direto.** Sempre via PR ou merge supervisionado.

### 6.6 Checkpoints

`lead-agent` emite um relatório curto após:
- Cada US implementada (1 parágrafo: o que foi feito, o que ficou pendente, riscos).
- Cada decisão técnica nova registrada como ADR.
- Cada mudança aprovada no `docs/api-contract.md`.

Esse stream de checkpoints vai sendo consolidado no relatório final. Evita a situação "deu errado lá no meio e ninguém percebeu".

### 6.7 Testes

Testes são parte da entrega, não etapa opcional. Cada agente de implementação (backend, frontend) é responsável por escrever testes da sua área **na mesma branch da US**. Uma US sem testes não pode ser marcada como concluída — exceto se ARCHITECTURE.md (seção 8) explicitamente disser que testes estão fora do escopo do MVP, e nesse caso o lead-agent registra no relatório como dívida técnica.

Se o time tem `qa-agent` (5.3), ele revisa cobertura e adiciona testes faltantes em paralelo.

### 6.8 Orçamento de contexto (importante)

Rodar o time inteiro em todas as US de uma vez estoura o contexto e degrada a qualidade no meio da corrida. Trabalhe em lotes:
- Divida as US em fatias (ex: 3-5 US por sessão), priorizando as de menor dependência.
- Rode o time numa fatia, feche com commit + checkpoint do lead, e só então abra a próxima fatia em sessão nova.
- Entre fatias, limpe o contexto (`/clear`) para não arrastar lixo de tarefas anteriores.

### 6.9 Prompt de criação do time

```
Crie um Agent Team chamado `<PROJETO>-development-team` com 5 agentes
(PO, Architect, Backend, Frontend, Lead) seguindo as especificações
deste template (seção 6.2).

O time vai trabalhar nas user stories de docs/user-stories/, respeitando:
- ARCHITECTURE.md (raiz)
- docs/erd.md [se aplicável]
- docs/api-contract.md (fonte da verdade do contrato, já congelado)
- docs/adr/
- design_handoff_<PROJETO>/ [se aplicável]

Regras inegociáveis:
1. O contrato (docs/api-contract.md) já existe e está congelado.
   Backend e frontend cumprem o contrato; mudanças só via proposta
   aprovada pelo architect.
2. Toda decisão técnica nova vira ADR.
3. Toda US implementada inclui testes (exceto se ARCHITECTURE.md
   seção 8 dispensar).
4. lead-agent emite checkpoint após cada US concluída.
5. Conflito funcional → PO; conflito técnico → Architect;
   impasse → lead escala para humano.

NESTA SESSÃO, implemente apenas estas US (uma fatia):
- US-NN, US-NN, US-NN

Comece pelas de menor dependência.
```

---

## 7. Verificação de isolamento de contexto

Sub-agents e Agent Teams trabalham em "bolhas" de contexto separadas. As perguntas abaixo *demonstram* que as bolhas existem — são um exercício pedagógico, não um detector confiável de vazamento. Se houver vazamento sutil, este teste pode não pegar.

**Perguntas-teste após uma execução paralela:**
1. "Quantas user stories o `po` gerou? Liste os títulos."
2. "Quais ADRs o `arquiteto` produziu? Liste os números."
3. "O `backend-agent` e o `frontend-agent` trabalharam na mesma branch?"
4. "Houve alguma mudança em `docs/api-contract.md` durante a execução? Quem fez?"

Se o Claude principal responder com detalhes que não estão nos arquivos gerados (inferindo conteúdo "de memória"), há sinal de vazamento de contexto.

**Quando suspeitar de vazamento:**
- Agente devolve conteúdo coerente sem ter lido os arquivos relevantes.
- Decisões de um agente aparecem replicadas em outro sem registro em ADR ou US.
- Lead-agent monta relatório citando informações que nenhum agente reportou.

Repita o teste em pontos diferentes do projeto, não só no fim.

---

## 8. Iteração e retrabalho

O template assume execução linear, mas projetos reais voltam. Como lidar:

**US com problema (PO entregou ruim):**
- Edite o arquivo da US diretamente OU invoque `po` com instrução de revisão específica.
- Se a mudança invalida implementação existente, registre no relatório de release como retrabalho.

**ADR que precisa ser revisto:**
- NUNCA edite ADR Accepted. Crie novo ADR superseder com `Status: Accepted` e `Supersedes ADR-NNNN`.
- Atualize o ADR antigo para `Status: Superseded by ADR-XXXX`.
- Justifique no `Contexto` do novo ADR o que mudou.

**Implementação que precisa ser revertida:**
- `lead-agent` registra a reversão no relatório.
- Se a reversão é grande, crie branch `refactor/<slug>` e trate como nova entrega.

**Contrato de API que precisa mudar depois de congelado:**
- `backend-agent` propõe a mudança via comentário `<!-- FRONTEND_REQUEST -->` ou nota no arquivo.
- `architect-agent` aprova ou rejeita.
- Se aprovado, o `lead-agent` avisa quem já consumiu o contrato antes de a mudança ser aplicada, registra a nota no topo do arquivo e no relatório de release.

---

## 9. Checklist de uso do template

Antes de invocar qualquer agente:
- [ ] `ARCHITECTURE.md` preenchido (todas as 9 seções)
- [ ] `CLAUDE.md` na raiz (escrito à mão OU gerado por `/init` e revisado — não os dois)
- [ ] Repositório git inicializado, branch atual identificada
- [ ] Diretórios `docs/`, `docs/user-stories/`, `docs/adr/`, `docs/release/` criados
- [ ] Sub-agents `po` e `arquiteto` configurados no Claude Code
- [ ] Se for usar Agent Team: flag `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` habilitada
- [ ] Se há design: `design_handoff_<PROJETO>/` na raiz
- [ ] Se há banco: decisão tomada sobre rodar o fluxo de ERD (seção 4.1)

Durante a execução:
- [ ] ERD gerado em `docs/erd.md` e `docs/erd.mmd` (se aplicável)
- [ ] `docs/api-contract.md` gerado e congelado ANTES do desenvolvimento (fase 4.3)
- [ ] User stories + ADRs gerados em paralelo (verificação de isolamento feita)
- [ ] Time rodando em fatias de US por sessão, não tudo de uma vez (seção 6.8)
- [ ] Cada US implementada tem commit dedicado e testes (ou justificativa)
- [ ] Lead-agent emitiu checkpoints regulares

Antes de fechar a release:
- [ ] Relatório consolidado em `docs/release/<versão>.md`
- [ ] Todos os ADRs novos registrados
- [ ] Dúvidas pendentes documentadas (não silenciadas)
- [ ] Próximo passo claro

---

## 10. Variações para projetos sem handoff visual

Se o projeto não tem design (CLI, biblioteca, API pura, pipeline de dados, refactor de legado), substitua a entrada visual por uma entrada de especificação:

**Em vez de `design_handoff_<PROJETO>/`, use uma das opções:**
- `docs/spec.md` — especificação funcional escrita em prosa
- `docs/cli-spec.md` — comandos, flags, output esperado
- `docs/data-pipeline-spec.md` — entradas, transformações, saídas

**Ajustes nos prompts:**
- Onde o template diz "Leia design_handoff_<PROJETO>/", substitua por "Leia docs/<spec relevante>".
- Onde diz "ligada explicitamente à(s) tela(s) do handoff", troque por "ligada explicitamente a comando/endpoint/pipeline de <spec>".
- No time: se não há frontend, remova o `frontend-agent` e ajuste o lead para coordenar só backend + PO + architect.

**Para refactor de projeto existente (caso comum):**
- `ARCHITECTURE.md` documenta a arquitetura **alvo**, não a atual.
- Crie `docs/current-state.md` descrevendo o estado atual e os problemas a corrigir.
- Cada US descreve "transformar X em Y" em vez de "construir Z do zero".
- ADRs documentam decisões de migração, incluindo o que será mantido temporariamente em paralelo (legado vs. novo).
