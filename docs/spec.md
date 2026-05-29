# Especificação Funcional — CV-Adapter

> Substitui o `design_handoff/` (não há design visual ainda; ver template §10).
> Descreve as telas, seus estados e os fluxos dos dois modos. O design visual pode ser
> gerado depois com as skills `frontend-design` / `ui-ux-pro-max`.

## 1. Atores

- **Usuário** (no MVP, único e local): mantém sua base de dados e gera currículos.

## 2. Telas

### 2.1 Perfil (`/perfil`) — editar a base de dados pessoal

A base é a **fonte da verdade**. Tela com seções editáveis, cada uma uma lista de itens
reordenáveis (campo `order`):

- **Cabeçalho/Resumo:** nome, telefone, localização, email, LinkedIn, GitHub, website,
  resumo/objetivo.
- **Experiência profissional:** empresa, cargo, local, início, fim (ou "atual"), bullets.
- **Formação:** instituição, grau, área, início, fim, nota (opcional), detalhes (opcional).
- **Habilidades:** categoria (ex.: "Técnicas", "Soft skills") + nome + nível (opcional).
- **Projetos:** nome, descrição, bullets, stack, URL (opcional).
- **Idiomas:** nome + proficiência.
- **Cursos/Certificações:** título, emissor, data, URL (opcional).

**Estados:** vazio (CTA para começar a preencher), preenchido, salvando, erro de validação
(Zod), salvo com sucesso.

### 2.2 Gerar (`/gerar`) — gerador de currículo

Seleção de modo:

- **Modo 1 — Padrão:** botão "Gerar currículo padrão". Pré-requisito: base de dados
  preenchida (pelo menos cabeçalho + 1 experiência ou formação).
- **Modo 2 — Adaptativo à vaga:** campo de texto grande para colar a vaga + botão
  "Adaptar à vaga". Pré-requisito: base preenchida (idealmente já com um currículo padrão).

**Estados:** ocioso, validando pré-requisitos, gerando (chamada ao LLM — loading),
preview do resultado, erro do LLM (com retry), aviso de rastreabilidade (ver §3).

**Preview do resultado:** mostra o `.tex` gerado (bloco de código), botão **Baixar `.tex`**,
botão **Copiar**, e — se houver — a lista de **avisos de rastreabilidade** do guardrail.

### 2.3 Currículos (`/curriculos`) — histórico

Lista de `GeneratedResume` (modo, data, vaga associada se Modo 2). Cada item: rebaixar o
`.tex` cacheado (sem nova chamada ao LLM) e ver o relatório de rastreabilidade.

**Estados:** vazio, populado.

## 3. Fluxos dos modos

### Modo 1 — Currículo padrão
1. Usuário tem a base preenchida.
2. Sistema serializa a base como JSON e chama o LLM (prompt do Modo 1).
3. LLM devolve `ResumeContent` (JSON validado por Zod) — seleção/ordenação/redação de
   itens **reais**.
4. `render-latex.ts` monta o `.tex` faangpath.
5. `validate-traceability.ts` confere o conteúdo contra a base → relatório.
6. Persiste `GeneratedResume` (mode=STANDARD) e mostra preview + download.

### Modo 2 — Adaptativo à vaga
1. Usuário já tem a base (e idealmente um currículo padrão).
2. Cola o texto da vaga → salvo como `JobPosting`.
3. Sistema chama o LLM com a base + a vaga (prompt do Modo 2): **prioriza itens reais que
   casam com a vaga; o que a vaga pede e o usuário não tem é simplesmente omitido — nunca
   preenchido**.
4–6. Igual ao Modo 1 (render → guardrail → persiste mode=JOB_ADAPTIVE + jobPostingId).

## 4. Regra inegociável (em toda a UI)

A IA **não inventa**. O preview sempre expõe os avisos de rastreabilidade. Entidade
inexistente na base (ex.: empresa que o usuário nunca cadastrou) é **erro forte** e dispara
regeneração; números/datas/tecnologias novas viram **aviso** revisável pelo usuário.
