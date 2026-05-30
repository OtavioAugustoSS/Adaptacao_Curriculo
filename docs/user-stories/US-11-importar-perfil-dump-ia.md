# US-11 — Importar perfil por dump com IA

**Fatia:** 5 — Import por dump (IA) + Formação em andamento
**Dependências:** US-02, US-03 (CRUD do perfil + listas da base — reusa o formulário e o `PUT /api/profile`); US-04 (camada `LLMProvider`/NIM — estende-a). Depende do **ADR-0018** (rota de import, distinção extração≠geração).

## História

**Como** usuário,
**quero** colar um texto livre (currículo antigo, perfil do LinkedIn, anotações) num painel "Importar com IA" no topo do `/perfil` e a IA estruturar isso na minha base,
**para** acelerar o onboarding sem digitar tudo manualmente, revisando o resultado antes de salvar.

## Descrição

- Adicionar ao topo do `/perfil` um **painel "Importar com IA"** colapsável: uma **textarea** para colar o dump + botão **"Preencher com IA"**.
- Ao acionar, enviar `POST /api/profile/import` com `{ rawText }`. O backend chama a IA (extrator estruturado), valida a saída contra `ProfileBundleSchema` (ids ausentes ok) e **devolve um rascunho** — **não persiste**.
- No sucesso, **MESCLAR** o rascunho no estado do formulário aberto:
  - **Acrescenta** itens às 6 listas (Experiência, Formação, Habilidades, Projetos, Idiomas, Cursos) — **nada existente é apagado**.
  - Preenche campos do **cabeçalho** (nome, e-mail, telefone, localização, website, linkedin, github, resumo) **somente onde estiverem vazios** — **não sobrescreve** o que o usuário já preencheu.
- O usuário **revisa** o formulário mesclado e usa o **Salvar existente** (`PUT /api/profile`, fluxo da US-02/US-03) para persistir. O painel de import não tem botão de salvar próprio.
- **Invariante (explicitar na UI e no prompt):** a IA **estrutura só o que está no texto** colado — **não inventa nem infere**; deixa **vazio** o que não aparece. A proteção aqui é o prompt "estruture só o texto, não invente" + a **revisão humana** — distinto da geração de currículo (este import **não** passa pelo guardrail de rastreabilidade `validate-traceability.ts`).

## Referências

- **Spec:** §2.1 (tela Perfil — base como fonte da verdade; este painel é uma entrada acelerada para a mesma base). §4 (regra inegociável "nunca inventa") aplicada à extração.
- **Contrato de API:** **rota nova** `POST /api/profile/import` — request `ProfileImportRequestSchema = { rawText: string (min 1) }`, response `ProfileBundleSchema` (rascunho, **não persistido**). Reusa `PUT /api/profile` (`ProfileBundleSchema`) para o salvar. Envelope de erro padrão `{ error: { code, message, details? } }`.
- **ERD:** sem entidade nova. O rascunho usa as entidades existentes (`Profile` + 6 listas) **sem `id`** (não persistido até o `PUT`).
- **Código:** `src/app/(dashboard)/perfil/page.tsx` (painel + merge no estado), `src/app/api/profile/import/route.ts` (novo), `src/server/profile/extract-profile.ts` (novo), `src/server/llm/prompts/parse-dump.ts` (novo), `src/server/llm/provider.ts` + `src/server/llm/nim.ts` (método `extractProfileFromDump`), `src/lib/schemas/profile-import.ts` (novo) ou barrel.
- **Arquitetura/ADRs:** **ADR-0018** (Fatia 5 — import por dump; extração ≠ geração; rota não persiste). ADR-0011 (contrato congelado — esta US o estende com nota datada). ADR-0004 (`LLMProvider` — extensão aditiva, sem mexer no `generateResumeContent`).

## Decisões de produto travadas nesta US

1. **Dump com base existente → MESCLA.** Acrescenta às listas atuais; nada é perdido. Cabeçalho preenchido **só onde vazio** (não sobrescreve). (Decisão do dono, plano da Fatia 5.)
2. **Local → painel no topo do `/perfil`.** Preenche o formulário ali mesmo, sem passar estado entre páginas.
3. **A extração não persiste.** `POST /api/profile/import` devolve rascunho; quem persiste é o `PUT /api/profile` após a revisão humana.
4. **Sem dedup automático.** O usuário remove duplicatas manualmente na revisão (usa o "remover" das listas já existentes da US-03).
5. **Sem guardrail de rastreabilidade.** A invariante "não inventa" é garantida pelo prompt + revisão humana, não pelo `validate-traceability.ts` (que é da geração base→.tex).

## Critérios de aceite (por estado)

### Painel e estado ocioso
- **Dado** que estou no `/perfil`, **quando** a página carrega, **então** vejo no topo um painel "Importar com IA" **colapsável** (fechado ou aberto conforme o design), contendo uma textarea com placeholder explicativo (ex.: "Cole seu currículo antigo, perfil do LinkedIn ou anotações") e um botão **"Preencher com IA"**.
- **Dado** o painel aberto com a textarea **vazia**, **então** o botão "Preencher com IA" fica **desabilitado** (espelha o `rawText.min(1)` do schema).

### Estado enviando
- **Dado** texto colado na textarea, **quando** clico em "Preencher com IA", **então** o botão entra em estado **"Preenchendo…"** com spinner, fica desabilitado e a textarea desabilitada enquanto a chamada `POST /api/profile/import` está em andamento.

### Estado sucesso (merge)
- **Dado** que o import retorna um rascunho `ProfileBundle`, **quando** a resposta chega, **então** os itens das 6 listas são **acrescentados** às listas atuais do formulário (nenhum item existente é removido).
- **E** os campos do cabeçalho são preenchidos **somente onde estavam vazios** — campos já preenchidos pelo usuário **permanecem intactos**.
- **E** uma mensagem/badge confirma quantos itens foram adicionados (ou ao menos sinaliza que o formulário foi preenchido) e lembra o usuário de **revisar e salvar**.
- **E** nada foi persistido ainda: só após o usuário clicar em **Salvar** (`PUT /api/profile`) os dados vão ao banco.

### Estado erro
- **Dado** que o LLM falha (erro/timeout) ou retorna saída inválida, **quando** a chamada termina, **então** vejo uma **mensagem amigável** ("Não foi possível interpretar o texto — tente novamente" — origem `502` no backend), o formulário **não é alterado** e a textarea preserva o texto colado para nova tentativa.
- **Dado** `rawText` vazio chegando ao backend, **então** a rota responde `400` (Zod) — mas a UI já previne pelo botão desabilitado.

### Invariante na UI
- **Dado** um dump em que campos não aparecem (ex.: sem GitHub, sem idiomas), **então** o rascunho deixa esses campos/listas **vazios** — a IA **não inventa** valores plausíveis. A UI deixa claro (hint no painel) que a IA "estrutura apenas o que está no texto e não inventa nada".

## Estados envolvidos

- **Ocioso:** painel pronto, textarea vazia → botão desabilitado.
- **Enviando:** "Preenchendo…" com spinner; textarea/botão desabilitados.
- **Sucesso (merge):** formulário mesclado + confirmação + lembrete de revisar/salvar.
- **Erro:** mensagem amigável (502); formulário inalterado; texto preservado.

## Fora do escopo

- **Persistir o dump bruto** ou manter **histórico de imports** (o `rawText` é descartado após gerar o rascunho).
- **Dedup automático** na mesclagem — o usuário remove duplicatas na revisão.
- Aplicar o **guardrail de rastreabilidade** ao import (é da geração base→.tex, não da extração).
- Editar/salvar direto pelo painel — o salvar é o `PUT /api/profile` existente, após revisão.
- Importar de arquivo (PDF/DOCX) ou de URL — apenas **texto colado** no MVP da Fatia 5.

## Pendências

- [DECISÃO PENDENTE] **Estado inicial do painel:** começa **colapsado** (fechado) ou **aberto** ao entrar no `/perfil`? **Sugestão:** colapsado por padrão para não competir com o formulário em quem já tem base; aberto quando a base está vazia (onboarding). Decisão final do dono/design.
- [DECISÃO PENDENTE] **Feedback do merge:** mostrar apenas um badge genérico ("Formulário preenchido — revise e salve") ou detalhar a contagem por lista (ex.: "+3 experiências, +5 habilidades")? **Sugestão:** badge com contagem total + lembrete de salvar; detalhamento por lista é opcional.
