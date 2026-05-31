# US-15 — Gestão dos currículos gerados

**Fatia:** 7 — Qualidade da geração + gestão de currículos + limpeza da base
**Dependências:** US-05 (geração que produz `GeneratedResume`), US-06 (preview + download do `.tex`), US-09 (histórico em `/curriculos` — esta US o estende). Depende do **ADR-0021** (gestão de currículos: nome editável + renomear + excluir + rotas `PATCH`/`DELETE /api/resumes/[id]`).

## História

**Como** usuário,
**quero** **nomear**, **ver/copiar**, **renomear** e **excluir** os currículos que gerei, e abri-los rapidamente no **Overleaf**,
**para** organizar meu histórico, reaproveitar o `.tex` sem nova chamada ao LLM e levar o currículo direto ao Overleaf onde eu compilo.

## Descrição

### Nomear o currículo
- Na tela `/gerar`, um campo **opcional "Nome do currículo"** enviado no `POST /api/resumes/generate`. Se o usuário não preencher, o **servidor** aplica um **default** = rótulo do modo + data (ADR-0021: **"Currículo padrão — 30/05/2026"** no Modo 1; **"Adaptado à vaga — 30/05/2026"** no Modo 2).
- No **preview** da geração, o currículo aparece com o **nome** escolhido (ou o default).
- O usuário também pode **renomear depois** (ver abaixo) — o nome é editável.

### Ver / copiar o `.tex` na tela Currículos
- Na tela `/curriculos`, cada card ganha um botão **"Ver / copiar"** que **expande** (ou abre modal) mostrando o `.tex` cacheado (`<TexCode tex={resume.texOutput} />`, reusando o componente do `/gerar`) + um botão **Copiar** (mesmo padrão do `handleCopy` do `/gerar`). Hoje a tela **só permite baixar** — passa a permitir **ver e copiar** o texto também.
- O `.tex` já vem no `GET /api/resumes` (campo `texOutput`) — **sem nova chamada** ao servidor para visualizar/copiar.

### Renomear
- Cada card de `/curriculos` permite **Renomear** (inline ou modal): envia `PATCH /api/resumes/[id]` com `{ name }`; ao confirmar, o título do card é atualizado e a lista reflete o novo nome.

### Excluir (com confirmação)
- Cada card permite **Excluir** com **confirmação destrutiva** (ex.: "Tem certeza que quer excluir este currículo? Esta ação não pode ser desfeita."). Confirmando, chama `DELETE /api/resumes/[id]` e **recarrega a lista** (o item some). Cancelando, nada acontece.

### Abrir no Overleaf
- Um botão **"Abrir no Overleaf"** (link do projeto, `target="_blank"`, `rel="noopener"`) aparece **no preview do `/gerar`** e **nos cards do `/curriculos`**, ao lado de Copiar/Baixar. Texto curto orienta o usuário: **"cole o `.tex` no projeto do Overleaf"** (a abertura leva ao projeto; o `.tex` continua sendo copiado/baixado pelo usuário).

## Referências

- **Spec:** §2.2 (preview do resultado — botões Baixar/Copiar; aqui ganha "Abrir no Overleaf" e o campo de nome). §2.3 (Currículos — histórico; rebaixar `.tex` cacheado; **estendido** com ver/copiar, renomear, excluir e "Abrir no Overleaf"). §4 (invariante anti-alucinação — **inalterado**; renomear não muda o conteúdo gerado).
- **Contrato de API:** **mudanças ADITIVAS** (registrar nota datada + **ADR-0021**): `GenerateRequestSchema` ganha `name?: string` (nomear na geração); `GeneratedResumeSchema` ganha `name: string` (Prisma + schema, com migração que faz **backfill** dos registros antigos = rótulo do modo + `createdAt`). **Rotas novas:** `PATCH /api/resumes/[id]` (request `{ name: string }` não-vazio → **200** + `GeneratedResumeSchema`; **400** Zod nome vazio; **404** se id inexistente ou não for do usuário) e `DELETE /api/resumes/[id]` (**204** sem corpo; **404** idem). Reusa `GET /api/resumes` (`GeneratedResumeSchema[]` — agora com `name`) e `GET /api/resumes/[id]/download`. Envelope de erro padrão `{ error: { code, message, details? } }`. **404 (não 403)** para recurso alheio (não vaza existência — ADR-0021).
- **ERD:** `GeneratedResume` ganha `name String` (migração Prisma); demais campos inalterados (`mode`, `createdAt`, `jobPostingId?`, `texOutput`, `traceabilityReport`).
- **Código:** `prisma/schema.prisma` (`GeneratedResume.name` + migração), `src/lib/schemas/generate.ts` (ou barrel) (`GenerateRequestSchema.name?`, `GeneratedResumeSchema.name`), `src/server/data/resume-repo.ts` (`name` no `createGeneratedResume` com default; `renameGeneratedResume(id, name)`; `deleteGeneratedResume(id)`), `src/app/api/resumes/[id]/route.ts` (novo `PATCH`/`DELETE`), `src/app/api/resumes/generate/route.ts` (recebe `name`), `src/lib/overleaf.ts` (novo — `OVERLEAF_PROJECT_URL`), `src/app/(dashboard)/gerar/page.tsx` (campo "Nome do currículo" + botão Overleaf no preview), `src/app/(dashboard)/curriculos/page.tsx` (ver/copiar, renomear, excluir, botão Overleaf), `src/components/TexCode.tsx` (reuso).
- **Arquitetura/ADRs:** **ADR-0021** (gestão de currículos: nome editável + renomear + excluir; rotas `PATCH`/`DELETE`; default do nome). **Supersede** a parte do **ADR-0016** que dizia "sem exclusão no MVP" e "título do histórico = rótulo do modo" (agora há nome editável; como o nome **não** é a vaga, o invariante anti-alucinação **não muda**). ADR-0011 (contrato congelado — estendido com nota datada).
- **Testes:** `schemas` (`GenerateRequestSchema` aceita `name?`; `GeneratedResumeSchema` exige/aceita `name`); `rotas` (`PATCH /api/resumes/[id]` renomeia + `404` se não for do usuário; `DELETE /api/resumes/[id]` exclui + `404`); `resume-repo` (default do nome no create; rename/delete).

## Decisões de produto travadas nesta US

1. **Currículos ganham nome editável.** Default = rótulo do modo + data; o usuário pode nomear na geração e renomear depois. (Decisão do dono — plano da Fatia 7; supersede a parte do ADR-0016 que fixava o título no rótulo.)
2. **Excluir É permitido no MVP** (com confirmação) — supersede o "sem exclusão" do ADR-0016.
3. **Ver/copiar usa o `.tex` cacheado** (`texOutput` do `GET /api/resumes`) — **sem** nova chamada ao LLM nem ao servidor.
4. **"Abrir no Overleaf" leva ao projeto** (`OVERLEAF_PROJECT_URL`); o usuário cola/baixa o `.tex` ele mesmo — **não** há push/integração com a API do Overleaf no MVP.
5. **Renomear não altera o conteúdo** do currículo nem o relatório de rastreabilidade — só o rótulo. Invariante anti-alucinação intacto.

## Critérios de aceite (por estado)

### Nomear na geração (`/gerar`)
- **Dado** o formulário de geração, **então** vejo um campo **opcional "Nome do currículo"**.
- **Dado** que **deixo o nome em branco** e gero, **então** o **servidor** salva o currículo com o **default** (rótulo do modo + data: "Currículo padrão — DD/MM/AAAA" no Modo 1, "Adaptado à vaga — DD/MM/AAAA" no Modo 2) e o preview mostra esse nome.
- **Dado** que **preencho um nome** e gero, **então** o currículo é salvo com esse nome e o preview o exibe.

### Lista (`/curriculos`) — populado
- **Dado** currículos gerados, **quando** abro `/curriculos`, **então** cada card mostra o **nome** do currículo como título (em vez do rótulo fixo), além de modo/data/vaga (se Modo 2) e do relatório de rastreabilidade (US-09).
- **Dado** a lista populada, **então** cada card tem as ações: **Baixar** (US-06), **Ver / copiar**, **Renomear**, **Excluir** e **Abrir no Overleaf**.

### Lista — vazio
- **Dado** que ainda não gerei nenhum currículo, **então** vejo o estado **vazio** com CTA para `/gerar` (US-09, inalterado).

### Ver / copiar
- **Dado** um card, **quando** clico em **"Ver / copiar"**, **então** o `.tex` cacheado é exibido (`<TexCode>`), **sem** nova chamada ao LLM, e há um botão **Copiar** que copia o `.tex` para a área de transferência (mesmo feedback do `/gerar`).
- **Dado** que cliquei em Copiar, **então** vejo uma confirmação breve ("Copiado").

### Renomear
- **Dado** um card, **quando** clico em **Renomear**, edito o nome e confirmo, **então** o front chama `PATCH /api/resumes/[id]` com `{ name }`, o título do card é atualizado e a lista reflete o novo nome.
- **Dado** que **cancelo** a renomeação, **então** o nome **não muda**.
- **Dado** um `name` inválido (vazio), **então** o backend responde `400` (Zod) e a UI mostra mensagem amigável (o botão de confirmar pode já ficar desabilitado com nome vazio).

### Excluir (confirmação destrutiva)
- **Dado** um card, **quando** clico em **Excluir**, **então** vejo um **pedido de confirmação** explicando que a ação **não pode ser desfeita**.
- **Dado** que **confirmo**, **então** o front chama `DELETE /api/resumes/[id]` (sucesso **204** sem corpo), o item some e a **lista é recarregada**; se a lista ficar vazia, aparece o estado vazio.
- **Dado** que **cancelo**, **então** nada é excluído.
- **Dado** que tento excluir um currículo que **não é do usuário atual** (ou já não existe), **então** o backend responde `404` e a UI mostra mensagem amigável sem quebrar a lista.

### Abrir no Overleaf
- **Dado** o **preview** do `/gerar` ou um **card** do `/curriculos`, **então** vejo um botão **"Abrir no Overleaf"** que abre o projeto em **nova aba** (`target="_blank"`, `rel="noopener"`), com a orientação curta de **colar o `.tex` no projeto**.

### Estado erro (geral)
- **Dado** falha de rede/servidor em renomear ou excluir, **então** a UI mostra uma **mensagem amigável** e a lista **não fica em estado inconsistente** (mantém o item até confirmação de sucesso).

## Estados envolvidos

- **Geração com nome:** campo opcional; default aplicado quando vazio; nome no preview.
- **Lista vazia:** CTA para `/gerar` (US-09).
- **Lista populada:** cards com nome + ações (Baixar / Ver-copiar / Renomear / Excluir / Abrir no Overleaf).
- **Ver/copiar:** `.tex` expandido (ou modal) + Copiar com confirmação.
- **Renomeando:** edição inline/modal → `PATCH` → título atualizado; cancelar não altera.
- **Excluindo:** confirmação destrutiva → `DELETE` → recarrega; cancelar não altera; `404` tratado.
- **Erro:** mensagem amigável (400 nome inválido, 404 não encontrado, falha de rede) sem corromper a lista.

## Fora do escopo

- **Editar o conteúdo** do currículo (o `.tex`/`ResumeContent`) — só o **nome** é editável; reescrever conteúdo é regerar (US-05/US-08/US-14).
- **Integração ativa com a API do Overleaf** (push do `.tex`, criar projeto) — o botão só **abre o projeto**; o usuário cola/baixa o `.tex`.
- **Paginação / busca / filtro** do histórico (volume baixo, single-user — US-09).
- **Lixeira / desfazer exclusão** — a exclusão é definitiva (por isso a confirmação).
- **Compartilhar / exportar PDF** do currículo (o sistema entrega `.tex`; a compilação é no Overleaf).
- **Mudar a geração, o guardrail ou o invariante anti-alucinação** (renomear não toca conteúdo).

## Pendências

- [RESOLVIDA — ver ADR-0021 §1] **Texto do default do nome.** Travado: **"Currículo padrão — 30/05/2026"** (Modo 1) e **"Adaptado à vaga — 30/05/2026"** (Modo 2), aplicado no **servidor** quando o request não traz `name`. Formato de data DD/MM/AAAA (a confirmar só o detalhe de localização da data, se necessário).
- [DECISÃO PENDENTE] **Renomear inline vs. modal** e **ver/copiar expandir vs. modal** — decisão de UI/design (frontend). Sugestão: inline para renomear (rápido) e expandir para ver/copiar (reusa o `TexCode`); confirmar com o design da Fatia 4 (ADR-0017).
- [DECISÃO PENDENTE] **`OVERLEAF_PROJECT_URL` fixo vs. configurável.** O plano fixa `https://www.overleaf.com/project/6a1b7884ee1222c3e7a18a19` em `src/lib/overleaf.ts`. Como é single-user (MVP), confirmar se a URL do projeto fica **hardcoded** (constante) ou vira **env** para a migração multiusuário futura.
