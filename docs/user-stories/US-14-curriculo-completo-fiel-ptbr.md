# US-14 — Currículo padrão completo e fiel (+ PT-BR + links discretos)

**Fatia:** 7 — Qualidade da geração + gestão de currículos + limpeza da base
**Dependências:** US-05 (fluxo de geração Modo 1), US-08 (Modo 2 adaptativo à vaga), US-07 (guardrail de rastreabilidade — estendido aqui), US-01 (renderer determinístico `.tex`). Depende do **ADR-0020** (enriquecimento do `ResumeContentSchema` + regra de rastreabilidade dos novos campos).

## História

**Como** usuário,
**quero** que o currículo gerado no **Modo 1** inclua **tudo** o que cadastrei na minha base e seja fiel ao que escrevi (sem cortar projetos, idiomas ou cursos), com os títulos do `.tex` em **português** e os links em **cor discreta**,
**para** ter um currículo padrão completo e apresentável que eu possa colar no Overleaf sem perder informação nem precisar reescrever seções.

## Descrição

### Modo 1 — completo e fiel (não omite)
- O **Modo 1 (currículo padrão)** passa a incluir **TUDO** o que existe na base, sem cortar:
  - **Todas as experiências** (com todos os bullets).
  - **Todos os projetos** — e cada projeto **com seus bullets** e seu **techStack** (hoje bullets e stack são **descartados** porque o `ResumeProjectItemSchema` só tem `title/description/url`).
  - **Todas as habilidades** (agrupadas por categoria).
  - **Todas as formações**.
  - **IDIOMAS** — seção nova (nome + proficiência).
  - **CURSOS / CERTIFICAÇÕES** — seção nova (título · emissor · data, URL opcional).
- A IA **só organiza e reescreve a redação** desses itens (ordem, fraseado) — **NÃO omite** nenhum item da base no Modo 1. Omitir/priorizar continua sendo papel **exclusivo do Modo 2**.

### Modo 2 — segue selecionando, mas emite os campos novos
- O **Modo 2 (adaptar à vaga)** mantém o comportamento atual: **seleciona, prioriza e reordena** itens reais que casam com a vaga e **omite** o que não casa (US-08). A mudança é que, para os itens que ele **mantém**, agora também emite os **campos novos** (bullets + techStack dos projetos selecionados, idiomas e cursos relevantes). O Modo 2 **pode** continuar omitindo idiomas/cursos que não ajudem na vaga — isso é seleção, não invenção.

### Títulos do `.tex` em PT-BR
- O renderer determinístico (`render-latex.ts`) passa a emitir os títulos de seção em **português**: **OBJETIVO**, **FORMAÇÃO**, **HABILIDADES**, **EXPERIÊNCIA**, **PROJETOS**, **IDIOMAS**, **CURSOS & CERTIFICAÇÕES**, **ATIVIDADES EXTRACURRICULARES** (extras), **LIDERANÇA** (leadership). Hoje os títulos estão **hardcoded em inglês** (`OBJECTIVE`, `SKILLS`, `EXPERIENCE`, etc.).
- Seção **vazia continua sendo omitida** (comportamento atual do renderer) — só aparece a seção que tem conteúdo.

### Links em cor discreta
- O `.tex` gerado passa a renderizar os hyperlinks (LinkedIn, GitHub, website, URLs de projeto/curso) num **azul-marinho escuro discreto (~`#1F3A5F`)**, com `colorlinks=true` — substituindo o **rosa** padrão do `resume.cls` do faangpath (que nunca foi sobrescrito; o dono vetou o rosa). A correção é feita **no preâmbulo do `.tex`** (`\hypersetup{colorlinks=true, urlcolor=…, linkcolor=…}` no `skeleton.ts`), **sem** tocar no `resume.cls` (que vive no Overleaf).

### Invariante anti-alucinação intacto
- O invariante **continua valendo nos dois modos**: a IA **não inventa**. Os campos novos (idiomas, cursos, bullets e techStack de projeto) **só devem conter conteúdo que existe na base** — o guardrail de rastreabilidade (`validate-traceability.ts`) é **estendido** para cobri-los (ver Referências), **sem afrouxar** as regras atuais. A geração segue: LLM → render → guardrail → persiste (US-05/US-07).
- **Regra do guardrail (ADR-0020 §3):** como **idiomas, cursos e techStack vêm da base**, eles **não geram aviso**; só conteúdo **fora** da base é **surfado como AVISO** (idioma/curso por nome/título normalizado; techStack por corpus; número em bullet de projeto via `checkNumbers`) — **nunca como erro forte que bloqueia**. Os erros fortes existentes (experiência/formação/projeto via `sourceId`) ficam intactos; nenhum erro forte novo é introduzido.

## Referências

- **Spec:** §2.1 (base como fonte da verdade: a base tem experiências, formação, habilidades, projetos com bullets+stack, **idiomas** e **cursos/certificações** — o currículo deve refletir tudo isso). §3 (fluxo Modo 1, passos 1–6 — render → guardrail → persiste). §4 (regra inegociável: a IA não inventa; números/datas/tecnologias novas viram aviso, entidade inexistente é erro forte).
- **Contrato de API:** **mudança ADITIVA no `ResumeContentSchema`** (registrar nota datada + **ADR-0020**): `ResumeProjectItemSchema` ganha `bullets: string[]` e `techStack: string[]`; `ResumeContentSchema` ganha `languages: { name, proficiency, sourceId? }[]` e `courses: { title, issuer, date, url?, sourceId? }[]`. `POST /api/resumes/generate` (`GenerateRequestSchema`) e `GeneratedResumeSchema` **não mudam** por esta US. Os dados já trafegam na base via `ProfileBundleSchema` (`languages`, `courses`, `projects.bullets`, `projects.techStack` já existem).
- **ERD:** sem entidade nova. As entidades `Language`, `Course` e os campos `Project.bullets`/`Project.techStack` **já existem** na base (`docs/erd.md`); a lacuna é só na **saída do LLM** (`ResumeContent`) e no **renderer**.
- **Código:** `src/lib/schemas/resume-content.ts` (campos novos em `ResumeProjectItemSchema` + `languages`/`courses` em `ResumeContentSchema`), `src/server/resume/render-latex.ts` (títulos PT-BR; projetos com bullets+stack; seções IDIOMAS e CURSOS & CERTIFICAÇÕES; omitir vazias; tudo via `escapeLatex()`), `templates/faangpath/skeleton.ts` (`\hypersetup{...}` no preâmbulo), `src/server/llm/prompts/standard-cv.ts` (Modo 1: instrução de **completude** + bloco de formato JSON com os campos novos, PT-BR), `src/server/llm/prompts/job-adaptive-cv.ts` (Modo 2: passa a emitir os campos novos dos itens selecionados), `src/server/llm/prompts/parse-dump.ts` (reforço de completude na extração), `src/server/resume/validate-traceability.ts` (estender o guardrail).
- **Arquitetura/ADRs:** **ADR-0020** (`ResumeContent` enriquecido + como a rastreabilidade trata os novos campos — erro vs. aviso). ADR-0001/0007 (renderer determinístico — o LLM **nunca** emite `.tex`; o renderer monta as seções; o "Atual" em datas vem do `period` formatado pelo LLM, US-12). ADR-0008/0015 (guardrail de rastreabilidade — estendido **sem afrouxar**). ADR-0009 (`escapeLatex()` é a fronteira única — todo texto novo passa por ela). ADR-0011 (contrato congelado — estendido com nota datada).
- **Testes:** `render-latex` (títulos PT-BR; projeto com bullets+stack; seções IDIOMAS e CURSOS; preâmbulo com `\hypersetup`; seção vazia omitida); `validate-traceability` (números em bullets de projeto; idiomas/cursos/techStack derivados da base não geram erro; conteúdo fora da base segue virando aviso/erro conforme ADR-0020); `schemas` (`ResumeContentSchema` aceita os campos novos).

## Decisões de produto travadas nesta US

1. **Modo 1 = completo e fiel.** Inclui TUDO da base; a IA só organiza/reescreve, **não corta**. (Decisão do dono — plano da Fatia 7.)
2. **Modo 2 segue selecionando/priorizando** para a vaga, mas **emite** os campos novos (bullets+stack, idiomas, cursos) dos itens que mantém. Omitir é seleção legítima do Modo 2, **não** se aplica ao Modo 1.
3. **Base estruturada é a fonte.** O currículo reflete a base; nada de anexo persistido (mantém ADR-0019). Os dados de idiomas/cursos/projetos já estão na base — esta US só os faz **chegar ao `.tex`**.
4. **Títulos do `.tex` em PT-BR** (lista fixa acima).
5. **Links em azul-marinho escuro discreto (~`#1F3A5F`, `colorlinks=true`)** via `\hypersetup` no preâmbulo — **sem** alterar o `resume.cls` (que mora no Overleaf). Travado pelo dono (só vetou o rosa).
6. **Invariante anti-alucinação intacto nos dois modos.** Os campos novos entram no guardrail; nada de inventar idioma/curso/tecnologia que não esteja na base.

## Critérios de aceite (por seção/estado)

### Modo 1 — completude (.tex gerado)
- **Dado** uma base com N experiências, **quando** gero o Modo 1, **então** o `.tex` contém **todas as N** experiências (nenhuma omitida) com seus bullets.
- **Dado** uma base com projetos que têm **bullets** e **techStack**, **quando** gero o Modo 1, **então** cada projeto no `.tex` mostra sua descrição **+ os bullets** (em itemize) **+ a linha de stack** (ex.: "Stack: …") — bullets e stack **não são mais descartados**.
- **Dado** uma base com **idiomas**, **quando** gero o Modo 1, **então** o `.tex` tem uma seção **IDIOMAS** listando cada idioma com sua proficiência (ex.: "Português — Nativo · Inglês — Avançado").
- **Dado** uma base com **cursos/certificações**, **quando** gero o Modo 1, **então** o `.tex` tem uma seção **CURSOS & CERTIFICAÇÕES** com título · emissor · data (URL quando houver).
- **Dado** uma base com habilidades e formações, **então** **todas** aparecem no `.tex` do Modo 1 (nenhuma cortada).

### Títulos PT-BR
- **Dado** qualquer currículo gerado (Modo 1 ou 2), **então** os títulos de seção do `.tex` estão em **português** (OBJETIVO, FORMAÇÃO, HABILIDADES, EXPERIÊNCIA, PROJETOS, IDIOMAS, CURSOS & CERTIFICAÇÕES, ATIVIDADES EXTRACURRICULARES, LIDERANÇA) — **não** em inglês.

### Links discretos
- **Dado** um currículo com links (LinkedIn/GitHub/website/URL de projeto ou curso), **quando** o `.tex` é compilado no Overleaf, **então** os links aparecem em **azul-marinho escuro discreto (~`#1F3A5F`, `colorlinks=true`)** — **não** rosa — por efeito do `\hypersetup` no preâmbulo, sem alterar o `resume.cls`.

### Seção vazia omitida
- **Dado** uma base **sem idiomas** (ou sem cursos, ou sem projetos), **quando** gero o currículo, **então** a respectiva seção **não aparece** no `.tex` (comportamento atual preservado — não imprime cabeçalho de seção vazia).

### Modo 2 — emite os campos novos sem perder a seleção
- **Dado** uma vaga colada, **quando** gero o Modo 2, **então** ele continua **selecionando/priorizando** itens reais (omitindo o que não casa, US-08), **e** os itens mantidos trazem seus bullets+techStack; idiomas/cursos relevantes aparecem (o Modo 2 pode omitir idiomas/cursos que não ajudem — isso é seleção, não falha).

### Invariante (guardrail) — não afrouxa
- **Dado** um conteúdo gerado em que um **idioma/curso/tecnologia** não existe na base, **então** o guardrail o trata conforme o **ADR-0020** §3: `languages[].name` (por `Language.name` normalizado), `courses[].title` (por `Course.title` normalizado) e `projects[].techStack[]` (por corpus normalizado da base) fora da base viram **AVISO** (não erro forte); `projects[].bullets[]` entra no `checkNumbers` (token numérico fora do corpus → aviso). Os **erros fortes** existentes (experiência/formação/projeto via `sourceId`) ficam **intactos** — nenhuma regra é afrouxada e **nenhum erro forte novo** é introduzido.
- **Dado** uma base vazia ou pré-requisito não atendido, **então** o fluxo de geração se comporta como hoje (`PREREQUISITE_NOT_MET` → 422, ADR-0014) — esta US não muda os pré-requisitos.

### Estados de geração (inalterados)
- **Ocioso / gerando (loading) / preview com avisos / erro do LLM (502, retry) / erro forte de guardrail (422)** — os estados de `/gerar` permanecem os da US-05/US-08; esta US só **enriquece o conteúdo** gerado.

## Estados envolvidos

- **Modo 1 gerado:** `.tex` completo (todas as seções com conteúdo da base), títulos PT-BR, links discretos.
- **Modo 2 gerado:** `.tex` selecionado para a vaga, com os campos novos dos itens mantidos.
- **Seção vazia:** omitida do `.tex`.
- **Preview com avisos:** avisos de rastreabilidade dos campos novos (números em bullets de projeto, etc.) surfados como hoje.
- **Erro:** 502 (LLM) com retry; 422 (guardrail forte / pré-requisito) — inalterados.

## Fora do escopo

- **Mudar o invariante anti-alucinação** — segue valendo nos dois modos; só é **estendido** aos campos novos.
- **Persistir o arquivo anexado** ou storage de currículos enviados (mantém ADR-0019 — base estruturada é a fonte).
- **Múltiplos templates** de `.tex`, i18n configurável (PT-BR é fixo nesta US), tema de cores escolhível pelo usuário.
- **Alterar o `resume.cls`** do faangpath — a cor do link é resolvida só no preâmbulo gerado.
- **Mudar `GenerateRequestSchema`/`GeneratedResumeSchema`** (o **nome** do currículo é da **US-15**; aqui só muda o `ResumeContentSchema`).
- **Reordenação manual** das seções pelo usuário (a ordem é a do renderer/LLM).

## Pendências

- [RESOLVIDA — travada pelo dono] **Cor dos links.** **Azul-marinho escuro discreto (~`#1F3A5F`), `colorlinks=true`** no `\hypersetup` (`urlcolor`/`linkcolor`). O dono vetou só o rosa; um azul-marinho sóbrio resolve. (Fora do ADR-0020, que trata só de `ResumeContent`/guardrail.)
- [RESOLVIDA — ver ADR-0020 §3] **Rastreabilidade dos novos campos (erro vs. aviso).** Travado: `languages[].name`, `courses[].title` e `projects[].techStack[]` fora da base → **AVISO** por nome/título normalizado (não erro forte); `projects[].bullets[]` entra no `checkNumbers`. Nenhum erro forte novo; os existentes ficam intactos.
- [DECISÃO PENDENTE] **Rótulo no `.tex`: "CURSOS & CERTIFICAÇÕES" vs. "CURSOS E CERTIFICAÇÕES".** Sugestão: **"CURSOS & CERTIFICAÇÕES"** (o `&` precisa ir escapado via `escapeLatex()`). Confirmar a grafia final com o dono.
