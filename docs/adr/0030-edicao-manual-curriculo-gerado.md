# 0030 — Edição manual do conteúdo de um currículo gerado (re-render, sem guardrail)

- **Status:** Accepted
- **Data:** 2026-06-03
- **Relaciona:** [[0007-llm-json-validado-renderer-deterministico]] (renderer puro reusado),
  [[0008-guardrail-anti-alucinacao-3-camadas]] (por que o guardrail NÃO roda aqui),
  [[0021-gestao-curriculos-nome-editar-excluir-limpar-base]] (estende o `PATCH /api/resumes/[id]`),
  [[0027-adaptacao-vaga-2-passos-prompt-rearquitetado]] (a adaptação lê a base, NÃO o currículo padrão)

## Contexto

Hoje o usuário só consegue **renomear/excluir/definir como padrão** um currículo gerado e ver/baixar o
`.tex`. Falta o essencial pedido pelo dono: **editar o conteúdo do currículo dentro do site** — corrigir o
objetivo, reescrever um bullet, remover/adicionar um item — e ter o `.tex` regenerado, **sem** gastar uma
nova geração da IA.

Esclarecimento importante levantado no planejamento: o motivo originalmente associado a esse pedido ("o
currículo padrão é usado na adaptação") **deixou de valer na Fatia 10** ([[0027-adaptacao-vaga-2-passos-prompt-rearquitetado]]):
o Modo 2 tira os **fatos da base (`/perfil`)**, não do currículo padrão (`getDefaultResume()` não é mais
chamado em `generate/route.ts`). Decisão do dono: a edição altera **apenas o conteúdo daquele currículo**
(`contentJson`) e regenera o `.tex`; as adaptações continuam lendo `/perfil`. Para mudar fatos que afetam
adaptações, o caminho segue sendo o `/perfil` (já totalmente editável).

## Decisão

### 1. Alvo da edição: `GeneratedResume.contentJson` + re-render determinístico
A edição altera o `ResumeContent` armazenado em `contentJson`. Ao salvar, o `.tex` é **re-renderizado pelo
renderer puro** `renderResume(content, profile)` ([[0007-llm-json-validado-renderer-deterministico]]) e
gravado em `texOutput`. **Sem chamada ao LLM.** O `escapeLatex()` continua sendo a única fronteira de
escape; a IA continua sendo a única coisa proibida de inventar.

### 2. O guardrail de rastreabilidade NÃO roda na edição manual
`validate-traceability.ts` existe para impedir **a IA** de inserir fatos fora da base
([[0008-guardrail-anti-alucinacao-3-camadas]]). Uma edição feita **pelo próprio dono dos dados** não é
alucinação de IA — é o usuário declarando informação própria. Logo o guardrail **não** é executado sobre a
edição manual; a validação é **apenas estrutural** (`ResumeContentSchema`). O **invariante de produto
permanece intacto**: "a **IA** nunca inventa" — e nenhum caminho de IA é tocado por esta decisão.

Como o `traceabilityReport` antigo descrevia a reescrita **da IA** (agora sobrescrita pelo usuário), ao
salvar uma edição manual o report é **zerado para `null`** ("não avaliado" — coerente com [[0014]]), em vez
de exibir avisos obsoletos.

### 3. Contrato (aditivo ao congelado — [[0011-contrato-api-zod-congelado]])
- **`GET /api/resumes/[id]`** (novo): devolve `GeneratedResumeSchema` (via `getGeneratedResumeById`, restrito
  ao usuário; **404** se inexistente/alheio). Necessário para a tela de edição carregar um currículo.
- **`PATCH /api/resumes/[id]`** ganha o campo opcional **`contentJson: ResumeContent`** (além de
  `name?`/`isDefault?`; o `refine` passa a exigir **pelo menos um** dos três). Quando vier `contentJson`: a
  rota carrega `getProfileBundle()` (o cabeçalho `\name`/`\address` vem do **Profile**, não do
  `contentJson`), re-renderiza o `.tex` e persiste via `updateGeneratedResumeContent(id, content, tex)`.
  Identidade via `getCurrentUserId()`; **404** se alheio/inexistente; **400** se o `contentJson` for
  estruturalmente inválido (Zod).

### 4. Escopo e profundidade (decisão do dono)
- **Qualquer** currículo é editável (o padrão ★ é só um deles), não apenas o padrão.
- **Edição completa**: editar/adicionar/remover/reordenar itens em todas as seções
  (objetivo, formação, habilidades, experiências, projetos, idiomas, cursos, extras, liderança),
  **reusando o editor visual do `/perfil`** (`ListSection` + `FieldDef`). Itens novos de **experiência**
  recebem um `sourceId` sintético (`manual-…`) só para satisfazer o schema (a experiência exige
  `sourceId.min(1)`); como o guardrail não roda, o `sourceId` é inerte aqui.
- O **cabeçalho (nome/contato)** não é editado nesta tela — é dado de `/perfil` (link/aviso na UI).

## Consequências
- O usuário passa a **polir a saída** de qualquer currículo e regenerar o `.tex` localmente, sem custo de IA.
- O renderer determinístico é reusado tal e qual — a garantia de LaTeX válido e de "só renderiza o que está
  no `ResumeContent`" se mantém para a edição manual.
- A edição manual **não** afeta a adaptação à vaga (que lê `/perfil`, [[0027]]); isso é explicitado na UI
  para não recriar a confusão do antigo "currículo de referência".
- Mudanças **aditivas** ao contrato; `GET /api/resumes` e a geração seguem inalterados.

## Alternativas consideradas
- **Rodar o guardrail também na edição manual:** rejeitado — bloquearia o usuário de corrigir/declarar
  fatos próprios (ex.: adicionar uma conquista real ainda não cadastrada), tratando o dono dos dados como
  se fosse a IA. O invariante é sobre a **IA**, não sobre o usuário.
- **Editar via `/perfil` e regenerar com IA:** rejeitado para este caso — perderia a redação já produzida
  (objetivo/bullets reescritos) e gastaria geração; além disso `/perfil` é a base (fatos), não o snapshot.
- **Sincronizar a edição de volta para `/perfil`:** rejeitado pelo dono — o mapeamento `ResumeContent →
  base` é lossy (skills agrupadas→planas, objetivo→resumo, períodos formatados↔datas) e ambíguo.
- **Rota dedicada `PATCH /api/resumes/[id]/content`:** rejeitada — estender o `PATCH` existente é mais
  simples e mantém uma só porta de atualização do recurso (aditivo, [[0021]]).
- **Reintroduzir o currículo padrão como referência da adaptação para "herdar" as edições:** rejeitado —
  reabriria a causa do copy-paste que o [[0027]] eliminou.
