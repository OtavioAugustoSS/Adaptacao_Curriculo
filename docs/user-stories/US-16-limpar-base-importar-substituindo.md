# US-16 — Limpar base + importar substituindo

**Fatia:** 7 — Qualidade da geração + gestão de currículos + limpeza da base
**Dependências:** US-02, US-03 (CRUD do perfil + listas da base — o formulário e o `PUT /api/profile`), US-11 (painel "Importar com IA" + `mergeDraft`), US-13 (import por arquivo — mesma entrada de import). Depende do **ADR-0021** (rota `DELETE /api/profile` — limpar base com cascade).

## História

**Como** usuário,
**quero** **limpar** toda a minha base com um clique (com confirmação) e poder **importar substituindo** o que está no formulário,
**para** recomeçar do zero quando minha base ficou bagunçada e para trocar o conteúdo por um import limpo sem ter de remover item a item.

## Descrição

### Limpar base
- Adicionar ao `/perfil` um botão **"Limpar base"** que, **com confirmação destrutiva** (ex.: "Tem certeza que quer apagar toda a sua base? Isso remove o cabeçalho e todas as listas — Experiência, Formação, Habilidades, Projetos, Idiomas e Cursos. Esta ação não pode ser desfeita."), chama `DELETE /api/profile`.
- O backend (`clearProfile()` no `profile-repo`) **apaga o `Profile`** do usuário atual; o **cascade** do Prisma apaga **só as 6 listas** (experiences, educations, skills, projects, languages, courses). Após apagar, `getProfileBundle` volta a devolver `emptyBundle()`.
- **O histórico de currículos é preservado.** `GeneratedResume`/`JobPosting` referenciam o `User` (não o `Profile`), então limpar a base **não os apaga** — limpar a base ≠ apagar entregáveis. Os currículos seguem geridos pela US-15.
- No front, ao concluir, o **formulário é resetado** (volta ao estado vazio — o mesmo estado de quem nunca preencheu a base).
- A rota é **idempotente** (ADR-0021): se a base já estava vazia, ainda responde **204** — limpar de novo não dá erro.

### Importar substituindo (toggle Mesclar / Substituir)
- No painel **"Importar com IA"** (US-11/US-13), adicionar um **toggle Mesclar / Substituir** que controla o que acontece quando o rascunho da IA chega:
  - **Mesclar** (default — comportamento atual): acrescenta itens às 6 listas e preenche o cabeçalho **só onde estiver vazio** (não sobrescreve) — `mergeDraft(prev, draft)`.
  - **Substituir:** **descarta** o conteúdo atual do formulário e usa **só o rascunho** da IA — `setBundle(draft)`. O usuário revisa o resultado substituído e **Salva** (`PUT /api/profile`).
- A substituição é **puramente no cliente** (estado do formulário) — **não persiste** sozinha; só o **Salvar** (`PUT /api/profile`) grava no banco. Isso vale tanto para o import por **texto colado** (US-11) quanto para o import por **arquivo** (US-13) — o toggle governa os dois.

### Invariante
- "Limpar base" e "Substituir" mexem só na **base do usuário** (a fonte da verdade) — **não** tocam na geração, no guardrail nem no invariante anti-alucinação. Continuam sendo ações destrutivas que **o usuário aciona explicitamente** (limpar com confirmação; substituir é uma escolha consciente no toggle e ainda passa pela revisão + Salvar).

## Referências

- **Spec:** §2.1 (Perfil — base como fonte da verdade; estados vazio/preenchido/salvando; o painel de import é entrada acelerada para a mesma base). §4 (invariante — inalterado).
- **Contrato de API:** **rota nova** `DELETE /api/profile` → **204** sem corpo (idempotente; sem corpo de request). Reusa `GET`/`PUT /api/profile` (`ProfileBundleSchema`). O **import "Substituir"** é **puramente cliente** — **sem mudança de contrato** (reusa `POST /api/profile/import` e `POST /api/profile/import/file`, que devolvem o mesmo rascunho `ProfileBundleSchema`). Envelope de erro padrão `{ error: { code, message, details? } }`.
- **ERD:** sem entidade nova. `DELETE /api/profile` apaga o `Profile` e, por **cascade**, **só** as 6 listas (`Experience`, `Education`, `Skill`, `Project`, `Language`, `Course`). `JobPosting` e `GeneratedResume` referenciam o **`User`** (`onDelete: Cascade` no `User`), **não** o `Profile` — portanto **NÃO** são apagados ao limpar a base: o histórico de currículos **sobrevive**.
- **Código:** `src/server/data/profile-repo.ts` (`clearProfile()` — apaga o `Profile`; o cascade cuida das listas), `src/app/api/profile/route.ts` (handler `DELETE`), `src/app/(dashboard)/perfil/page.tsx` (botão "Limpar base" + confirmação + reset do formulário; toggle Mesclar/Substituir no painel de import; `setBundle(draft)` no caminho "Substituir"). **Reusa sem alterar:** `mergeDraft` (US-11), `handleImport`/`handleImportFile` (US-11/US-13), `emptyBundle()`.
- **Arquitetura/ADRs:** **ADR-0021** (rota `DELETE /api/profile` com cascade; idempotente → 204; ação destrutiva exige confirmação na UI). ADR-0018 (import por dump — `mergeDraft`, não persiste). ADR-0019 (import por arquivo — mesma entrada; o toggle vale para os dois). ADR-0011 (contrato congelado — estendido com nota datada).
- **Testes:** `rotas` (`DELETE /api/profile` zera a base e responde **204**; idempotente — base já vazia → **204**); `profile-repo` (`clearProfile()` deixa `getProfileBundle` em `emptyBundle()`, o cascade remove as 6 listas **e o histórico de `GeneratedResume` permanece intacto** — não é cascateado pelo `Profile`).

## Decisões de produto travadas nesta US

1. **"Limpar base" apaga toda a base estruturada** (cabeçalho + 6 listas) via `DELETE /api/profile`; o cascade do Prisma cuida das listas. **Os currículos gerados são PRESERVADOS** — `GeneratedResume`/`JobPosting` referenciam o `User`, não o `Profile` (limpar base ≠ apagar entregáveis). (Decisão do dono — plano da Fatia 7; confirmado pelo architect/lead.)
2. **Limpar é idempotente** (ADR-0021): base já vazia → ainda **204**, sem erro.
3. **Toggle Mesclar / Substituir** no painel de import — **Mesclar** segue sendo o default (comportamento atual); **Substituir** descarta o formulário e usa o rascunho.
4. **Substituir é puramente cliente** — descarta o estado do formulário e aplica `setBundle(draft)`; **não persiste** sozinho. Só o **Salvar** (`PUT /api/profile`) grava.
5. **Convive com o remover item-a-item** (US-03) — limpar/substituir são atalhos de granularidade grossa; o remover por item continua existindo.
6. **Invariante anti-alucinação intacto** — limpar/substituir mexem só na base; não tocam geração/guardrail.

## Critérios de aceite (por estado)

### Limpar base — ocioso
- **Dado** que estou no `/perfil` (com ou sem base preenchida), **então** vejo um botão **"Limpar base"** (visualmente sinalizado como ação destrutiva).

### Limpar base — confirmação
- **Dado** que clico em **"Limpar base"**, **então** vejo um **pedido de confirmação** explicando que **tudo** (cabeçalho + as 6 listas) será apagado e que a ação **não pode ser desfeita**.
- **Dado** que **cancelo**, **então** **nada** é apagado e o formulário fica como estava.

### Limpar base — sucesso
- **Dado** que **confirmo**, **então** o front chama `DELETE /api/profile` (sucesso **204**), o **formulário é resetado** ao estado vazio (igual a quem nunca preencheu), e ao recarregar o `/perfil` a base aparece vazia (CTA de começar a preencher).
- **Dado** que tinha currículos gerados, **quando** limpo a base, **então** o **histórico em `/curriculos` permanece intacto** — limpar a base apaga só a base estruturada, não os entregáveis (US-15).
- **Dado** que clico em "Limpar base" com a base **já vazia**, **então** a rota responde **204** (idempotente) e a UI continua coerente (sem erro).

### Limpar base — erro
- **Dado** falha de rede/servidor ao limpar, **então** a UI mostra uma **mensagem amigável** e **não** reseta o formulário (mantém o estado atual até a confirmação de sucesso).

### Import — toggle Mesclar (default)
- **Dado** o painel "Importar com IA" com o toggle em **Mesclar**, **quando** o rascunho da IA chega (texto colado **ou** arquivo), **então** os itens são **acrescentados** às 6 listas atuais e o cabeçalho é preenchido **só onde estava vazio** — comportamento da US-11/US-13, inalterado.

### Import — toggle Substituir
- **Dado** o toggle em **Substituir**, **quando** o rascunho da IA chega, **então** o conteúdo atual do formulário é **descartado** e substituído **só pelo rascunho** (`setBundle(draft)`) — listas e cabeçalho passam a refletir só o que a IA extraiu.
- **E** nada foi persistido: o usuário **revisa** o formulário substituído e **Salva** (`PUT /api/profile`) para gravar.
- **Dado** que o import **falha** (LLM 502, arquivo inválido — US-11/US-13) no modo Substituir, **então** o formulário **não é alterado** (não há rascunho para aplicar) e o erro amigável aparece como nas US-11/US-13.

### Estado destrutivo (resumo)
- **Dado** qualquer das duas ações destrutivas (Limpar base; Substituir), **então** a UI deixa claro que conteúdo será perdido: "Limpar" exige confirmação explícita; "Substituir" é uma escolha consciente no toggle, com revisão + Salvar antes de persistir.

## Estados envolvidos

- **Limpar base — ocioso:** botão visível, sinalizado como destrutivo.
- **Limpar base — confirmando:** diálogo de confirmação (apaga tudo / não desfaz).
- **Limpar base — sucesso:** `DELETE` 204 → formulário resetado → base vazia (CTA).
- **Limpar base — idempotente:** base já vazia → 204, sem erro.
- **Limpar base — erro:** mensagem amigável; formulário inalterado.
- **Import Mesclar (default):** acrescenta às listas; cabeçalho só onde vazio (US-11/US-13).
- **Import Substituir:** descarta o formulário; aplica `setBundle(draft)`; revisar + Salvar.
- **Import erro (qualquer toggle):** formulário inalterado; erro amigável (US-11/US-13).

## Fora do escopo

- **Lixeira / desfazer** a limpeza da base — a exclusão é definitiva (por isso a confirmação).
- **Backup/export da base** antes de limpar (melhoria futura — não pedido).
- **Dedup automático** no import (qualquer toggle) — o usuário ajusta na revisão (US-03).
- **Apagar só uma lista** específica (ex.: "limpar só os projetos") — limpar é tudo-ou-nada; o remover por item (US-03) cobre granularidade fina.
- **Persistir o dump/arquivo** importado (mantém ADR-0018/0019 — não persiste).
- **Mudar a geração, o guardrail ou o invariante anti-alucinação.**

## Pendências

- [RESOLVIDA — ver ADR-0021 §3] **Semântica de `DELETE /api/profile`.** Travado: apaga o `Profile`; cascade apaga **só** as 6 listas; idempotente → **204** mesmo com base já vazia. O histórico de currículos (`GeneratedResume`/`JobPosting`) **não** é cascateado (referencia o `User`, não o `Profile`) — ver a pendência resolvida abaixo.
- [DECISÃO PENDENTE] **Estado inicial do toggle Mesclar/Substituir.** Sugestão: começar em **Mesclar** (default — comportamento atual, menos destrutivo). Confirmar com o design da Fatia 4 (ADR-0017) a forma do controle (toggle, radio ou segmented).
- [RESOLVIDA — confirmado pelo architect/lead] **"Limpar base" preserva o histórico de currículos.** Limpar a base apaga **só a base estruturada** (o `Profile` + as 6 listas). Os **currículos gerados permanecem**: no schema, `GeneratedResume` (e `JobPosting`) referenciam o **`User`** (`onDelete: Cascade` no `User`), **não** o `Profile` — então apagar o `Profile` cascateia apenas as 6 listas; o histórico sobrevive. É o comportamento correto: limpar a base ≠ apagar entregáveis (os currículos são geridos/excluídos pela US-15).
