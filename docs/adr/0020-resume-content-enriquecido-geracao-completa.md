# 0020 — `ResumeContent` enriquecido: geração completa e fiel (idiomas, cursos, bullets+stack de projeto)

- **Status:** Accepted
- **Data:** 2026-05-30

## Contexto

O dono testou o produto de ponta a ponta com o currículo real. A base está completa e
correta (3 experiências, 1 formação, 29 skills, 3 projetos **com bullets+techStack**, 2 idiomas,
1 curso). Mas o currículo gerado no Modo 1 saiu **incompleto** — não por falha do LLM, e sim por
**limitação ESTRUTURAL do `ResumeContentSchema`** (congelado, núcleo do guardrail — [[0007-llm-json-validado-renderer-deterministico]], [[0011-contrato-api-zod-congelado]]):

- `ResumeProjectItemSchema` só tem `title/description/url` → os **bullets e o techStack de cada
  projeto são descartados** na geração (existem na base, mas não há onde caberem na saída).
- `ResumeContentSchema` não tem `languages` → **idiomas somem**.
- `ResumeContentSchema` não tem `courses` → **cursos/certificações somem**.

O que a saída não consegue representar, o renderer não consegue emitir. O guardrail
(`validate-traceability.ts`) já está pronto para isso: `buildBaseCorpus` **já inclui** bullets+techStack
de projeto, idiomas e cursos da base — só não havia campos correspondentes na saída para checar.

Esta decisão fecha a lacuna com mudanças **aditivas** ao schema congelado, **sem afrouxar** o
invariante anti-alucinação: a IA continua só selecionando/omitindo/reordenando/reescrevendo itens
REAIS da base — nunca inventa.

## Decisão

### 1. Campos novos no `ResumeContentSchema` (aditivos)

- **`languages: { name: string, proficiency: string, sourceId?: string }[]`** — idiomas
  selecionados/reescritos da base. `sourceId` opcional (rastreia o `Language` real quando presente).
- **`courses: { title: string, issuer: string, date: string, url?: string, sourceId?: string }[]`** —
  cursos/certificações selecionados da base. `sourceId` opcional (rastreia o `Course` real).
- **`ResumeProjectItemSchema` ganha** `bullets: string[]` e `techStack: string[]`.

Os campos espelham `LanguageSchema { name, proficiency }`, `CourseSchema { title, issuer, date, url? }`
e o `Project { bullets, techStack }` da base. Como todo o resto do schema, são **aditivos**: nenhuma
forma existente muda, nenhum campo é removido. `ResumeContent` **segue sendo o núcleo do guardrail**.

### 2. Modo 1 passa a ser COMPLETO; Modo 2 segue selecionando

- **Modo 1 (standard):** inclui **TUDO** da base — todas as experiências, todos os projetos **com
  todos os bullets + techStack**, skills, formações, **idiomas** e **cursos**. A IA só organiza e
  reescreve a redação; **não omite**. (Antes saía currículo enxuto por limitação estrutural.)
- **Modo 2 (job-adaptive):** **inalterado no princípio** — segue selecionando/priorizando para a
  vaga ([[0016-modo2-historico-escopo-mvp]]), mas agora **emite os campos novos** (idiomas/cursos/
  bullets+stack dos itens que selecionou). Selecionar/omitir para a vaga continua permitido; o que
  muda é só que os campos novos existem para serem preenchidos.

O invariante anti-alucinação ([[0008-guardrail-anti-alucinacao-3-camadas]]) vale **nos dois modos**.

### 3. Rastreabilidade dos campos novos (regra exata para o guardrail)

Estende `validate-traceability.ts` **sem afrouxar** [[0015-guardrail-rastreabilidade-classificacao-regeneracao]].
A normalização é a `normalize()` já existente (minúsculas + sem diacríticos + colapso de espaços).

- **`checkNumbers` passa a varrer também os bullets de projeto.** Hoje varre `objective`,
  `experience[].bullets` e `projects[].description`. Acrescentar `projects[].bullets[]`, com a
  **mesma** regra: token numérico que não exista como substring no corpus da base → **aviso**
  ("número possivelmente novo"). Coerente com os bullets de experiência — bullet de projeto não
  pode ser um buraco onde número inventado passe sem aviso.

- **`project.techStack` → AVISO (como skills).** Cada item de `techStack` cujo nome normalizado
  não apareça no corpus da base → **aviso** ("tecnologia possivelmente nova (não encontrada na
  base)"). Mesmo critério conservador das skills: surfa, não bloqueia. (O `buildBaseCorpus` já
  inclui o techStack da base, então técnicas reais passam sem aviso.)

- **Idiomas → AVISO por nome normalizado (NÃO erro forte).** Cada `languages[].name` cujo nome
  normalizado não case com nenhum `Language.name` da base → **aviso** ("idioma possivelmente novo
  (não encontrado na base)"). A `proficiency` **não** é rastreada como entidade (é redação, como o
  texto de um bullet).

- **Cursos → AVISO por título normalizado (NÃO erro forte).** Cada `courses[].title` cujo título
  normalizado não case com nenhum `Course.title` da base → **aviso** ("curso possivelmente novo
  (não encontrado na base)"). `issuer`/`date`/`url` não são rastreados como entidade.

**Por que aviso e não erro forte para idiomas/cursos.** Os erros fortes hoje
([[0015-guardrail-rastreabilidade-classificacao-regeneracao]]) cobrem experiência/formação/projeto —
entidades de **peso curricular alto**, onde uma fabricação é grave e justifica bloquear+regenerar.
Idioma e curso são itens **leves e curtos**; o risco de fabricação é menor e o custo de um falso
positivo (ex.: "Inglês" vs "Inglês (TOEFL)", grafia divergente, abreviação de certificação) que
**bloqueasse e regenerasse** o currículo é alto demais. O critério **conservador** ([[0015]]:
"preferir surfar a esconder") manda aqui: idioma/curso fora da base é **surfado como aviso**,
revisável, não bloqueia. Isso **mantém o invariante** — conteúdo suspeito é exposto ao usuário —
sem a fragilidade de um match de entidade estrito sobre strings curtas e ruidosas.

**Regra inequívoca para implementação (erro × aviso × normalização):**

| Campo da saída | Classificação | Como casa contra a base |
|---|---|---|
| `experience[].company` (via `sourceId`) | **ERRO** (inalterado) | `sourceId` válido + `company` normalizada = item real |
| `education[].institution` | **ERRO** (inalterado) | `institution` normalizada via `sourceId` ou igualdade |
| `projects[].title` | **ERRO** (inalterado) | `title` normalizado via `sourceId` ou contra `Project.name` |
| `objective`, `experience[].bullets[]`, `projects[].description`, **`projects[].bullets[]`** | **AVISO** (número) | token numérico ∉ corpus normalizado da base |
| `skills[].items[]` | **AVISO** (inalterado) | nome normalizado ∉ conjunto de `Skill.name` |
| **`projects[].techStack[]`** | **AVISO** | nome normalizado ∉ corpus normalizado da base |
| **`languages[].name`** | **AVISO** | nome normalizado ∉ conjunto de `Language.name` da base |
| **`courses[].title`** | **AVISO** | título normalizado ∉ conjunto de `Course.title` da base |

Nenhum erro forte novo é introduzido; só **avisos**. A política de regeneração ([[0015]]:
1 re-tentativa → 422 `GUARDRAIL_FAILED`) e os erros fortes existentes ficam **intactos**.

## Consequências

- **Modo 1 gera um currículo completo e fiel** — projetos com bullets+stack, seções de idiomas e
  cursos — sem deixar de honrar o invariante anti-alucinação.
- O guardrail ganha cobertura (números em bullets de projeto; techStack/idiomas/cursos suspeitos
  viram aviso) **sem novos pontos de bloqueio** — a superfície de falha dura não cresce.
- Mudanças **aditivas**: schemas, prompts e renderer já existentes não quebram; código que lê
  `ResumeContent` sem os campos novos continua válido (campos novos com default `[]` no schema).
- Custo: o prompt do Modo 1 fica mais longo (instrução de completude) e a saída maior; aceitável.
- Idioma/curso fora da base **não bloqueia** — trade-off consciente (ver "Por que aviso"); um
  endurecimento futuro para erro forte é possível via novo ADR se a fabricação se mostrar real.
- `validate-traceability.ts` segue **função pura** → cobertura de teste obrigatória dos novos ramos
  (ARCHITECTURE §8): número em bullet de projeto, techStack/idioma/curso da base sem aviso, e
  fora da base com aviso.

## Alternativas consideradas

- **Idiomas/cursos como ERRO forte (match de entidade, como projeto/formação):** rejeitado. Strings
  curtas e ruidosas (grafia/abreviação) gerariam falsos positivos que **bloqueariam e regenerariam**
  o currículo inteiro — custo alto para risco baixo. O critério conservador de [[0015]] indica aviso.
- **Não rastrear os campos novos (deixá-los passar sem checagem):** rejeitado — abriria um flanco no
  invariante (idioma/curso/stack inventado entraria sem nenhum aviso). O `buildBaseCorpus` já tem o
  texto da base; varrer é barato e fecha a brecha.
- **Não varrer números nos bullets de projeto:** rejeitado — seria inconsistente com os bullets de
  experiência e deixaria os bullets de projeto como zona cega para números fabricados.
- **Manter o schema congelado e resolver no prompt/renderer:** impossível — o que o schema não
  representa, o LLM não pode retornar nem o renderer emitir. A lacuna é estrutural; exige campos novos.
- **Reabrir o invariante para permitir a IA "completar" idiomas/cursos:** fora de escopo e contra o
  produto. A IA segue só selecionando/reescrevendo itens reais da base nos dois modos.
