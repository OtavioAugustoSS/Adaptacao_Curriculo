# 0022 — Currículo padrão (`isDefault`) e adaptação ancorada em referência de profundidade

- **Status:** Accepted
- **Data:** 2026-05-31

## Contexto

Com o uso real, dois problemas apareceram na geração:

1. **O Modo 2 (adaptar à vaga) enxuga demais.** Lendo o `prisma/dev.db` real do dono: a base está
   **rica** (DruSign 5 bullets, Workana 5 bullets, 3 projetos com bullets+stack, 29 skills, 2 idiomas).
   O Modo 1 produziu um `.tex` completo (~6,1 KB), mas o Modo 2 numa vaga PHP gerou ~3,4 KB —
   **derrubou 2 dos 3 projetos** e cortou DruSign/Workana de **5→2 bullets**. A causa é o próprio prompt
   do Modo 2 ([[0010-dois-modos-mvp]]/[[0016-modo2-historico-escopo-mvp]]): ele instrui "omita o que não
   agrega" e "um currículo mais curto é melhor que inflado" — um **viés de cortar** que destrói a
   profundidade que o dono construiu (bullets no padrão problema→ação→impacto→justificativa de stack, o
   estilo que lhe rendeu uma vaga).

2. **Não há "currículo padrão".** O dono quer marcar um currículo como base e **adaptar a partir dele**,
   para que a adaptação parta de algo completo em vez de re-derivar do zero e encolher.

A base (`ProfileBundle`) é a fonte da verdade e continua sendo a entrada de fatos do guardrail
([[0008-guardrail-anti-alucinacao-3-camadas]]). A decisão precisa melhorar a riqueza **sem** afrouxar o
invariante anti-alucinação. Mudanças **aditivas** ao contrato congelado ([[0011-contrato-api-zod-congelado]]).

## Decisão

### 1. `GeneratedResume.isDefault` (currículo padrão do usuário)

- **Prisma:** `GeneratedResume.isDefault Boolean @default(false)` (migração; **backfill**: por usuário,
  marca o **STANDARD mais recente** — ou, na falta, o mais recente — como `true`, garantindo "pelo menos
  um padrão" para dados existentes).
- **`GeneratedResumeSchema`:** ganha `isDefault: z.boolean().default(false)` (aditivo; `GET /api/resumes`
  passa a devolvê-lo).
- **Invariante de unicidade:** no máximo **um** currículo `isDefault=true` por usuário. Garantido na
  escrita (`setDefaultResume`), não por constraint de banco (simplicidade SQLite/MVP).
- **Default automático:** `createGeneratedResume` marca o currículo como padrão **se o usuário tiver zero
  currículos** (o primeiro gerado vira o padrão). Caso contrário, preserva o padrão atual.

### 2. `setDefaultResume` / `getDefaultResume` (repo, via `getCurrentUserId()`)

- `setDefaultResume(id)`: marca o alvo (`updateMany where { id, userId }`); se `count === 0` → **`null`**
  (id inexistente/alheio, **nada** é alterado — não zera o padrão atual); senão **zera** o `isDefault` dos
  **demais** currículos do usuário (`where { userId, isDefault: true, NOT: { id } }`) e devolve o registro.
  A ordem (setar antes de zerar) evita ficar **sem** padrão quando o id é inválido.
- `getDefaultResume()`: `findFirst { userId, isDefault: true }`; **fallback** → STANDARD mais recente. Usado
  como referência-padrão no Modo 2 quando o request não trouxer `baseResumeId`.

### 3. `PATCH /api/resumes/[id]` aceita `isDefault` (aditivo ao rename do [[0021]])

`PATCH { name?, isDefault?: true }`. Com `isDefault: true` → chama `setDefaultResume` (404 se alheio/
inexistente, igual ao rename). `name` e `isDefault` são independentes; o handler aceita um ou outro. O
contrato do [[0021]] (renomear) é preservado — o body apenas **ganha** um campo opcional.

### 4. Adaptação ancorada em "referência de profundidade" (Modo 2)

- `GenerateRequestSchema` ganha **`baseResumeId?: string`** (Modo 2). A `refine` de `jobText` é preservada.
- A rota Modo 2 carrega o conteúdo do currículo base — `baseResumeId` (selecionado na UI) **ou**, na
  ausência, `getDefaultResume()` — e o injeta no gerador como **`baseContent: ResumeContent`**.
- `buildJobAdaptiveCvPrompts(bundle, jobText, baseContent?)` serializa, quando presente, um bloco
  **"CURRÍCULO PADRÃO DE REFERÊNCIA"** no **user prompt**, com instrução explícita: *use como referência de
  **profundidade/estrutura/completude**; os **fatos** continuam vindo da BASE; **não** é fonte de fatos novos.*
- **Por que referência e não "adaptar o CV pronto":** adaptar a partir do `.tex`/conteúdo já reescrito
  faria um **2º rewrite** (base → padrão → adaptado), acumulando *drift* de redação. Mantendo a BASE como
  fonte de fatos e o padrão só como **referência de profundidade**, ancora-se a riqueza sem telefone-sem-fio.

### 5. Virada de filosofia do prompt do Modo 2 (de "enxugar" para "equilibrado")

`JOB_ADAPTIVE_CV_SYSTEM_PROMPT` muda para a política **Equilibrado** (mantendo o invariante):
- **Remover** a instrução "um currículo mais curto é melhor que inflado".
- **Manter** todas as experiências reais e a **maioria** dos projetos; só omitir o que estiver
  **claramente fora** do escopo da vaga.
- **Profundidade dos bullets:** preservar a estrutura **contexto/problema → o que foi feito → impacto/
  resultado → justificativa da escolha técnica** (quando existir na base); condensar **só** os itens menos
  relevantes — nunca reduzir um bullet rico a uma frase genérica.
- **Stack:** incluir a linha de `techStack` de cada experiência/projeto.
- **Tamanho:** 1–2 páginas é normal; **não** forçar 1 página cortando conteúdo verdadeiro relevante.
- **ATS + humano:** usar as palavras-chave reais da vaga **que casam com itens reais** da base — para passar
  na triagem automática **e** na leitura do RH — sem inventar para casar.

`STANDARD_CV_SYSTEM_PROMPT` (Modo 1) recebe **reforço leve** do mesmo padrão de profundidade (ele é a base
que vira referência; precisa continuar rico). Já inclui "tudo da base".

### 6. O que NÃO muda

- **Guardrail** (`validate-traceability.ts`) e política de regeneração ([[0015]]): **intactos**, validando
  contra a `bundle` (base). O `baseContent` não é entrada do guardrail — todo item dele já vem da base.
- **Invariante anti-alucinação** ([[0008]]): intacto. A referência de profundidade **não** é fonte de fatos.
- **`ResumeContentSchema`** e o **renderer** ([[0007-llm-json-validado-renderer-deterministico]],
  [[0020-resume-content-enriquecido-geracao-completa]]): sem mudança — o renderer já emite todos os bullets +
  linha `Stack:` e flui multi-página (sem `\newpage` fixo).
- **Identidade**: tudo via `getCurrentUserId()` ([[0006-identidade-seam-getcurrentuserid]]).

## Consequências

- A adaptação à vaga passa a partir de um currículo completo e mantém profundidade — sai do "1 página
  enxuta" para algo que passa em ATS **e** agrada o RH, sem arranhar o invariante.
- O dono ganha o conceito de **currículo padrão** (marcar, destacar, e basear a adaptação nele).
- Mudanças **aditivas**: `isDefault` com default `false` + backfill não quebram dados/geração existentes;
  `baseResumeId` é opcional (ausente → usa o default; sem default → comportamento atual, deriva só da base).
- **Risco de tamanho:** um Modo 2 mais rico aumenta tokens/latência (já mitigado pelo timeout de 180s do
  import; a geração normal já tolera ~50s). E mais conteúdo = mais superfície de **avisos** de
  rastreabilidade no preview (esperado; avisos não bloqueiam).
- A unicidade do padrão é garantida **na aplicação** (não no banco). Aceitável no MVP single-user; numa
  migração multiusuário, considerar índice parcial único `(userId) WHERE isDefault`.

## Alternativas consideradas

- **Adaptar a partir do CV padrão já escrito (2º rewrite):** rejeitado — acumula *drift* de redação e
  afasta da base; a referência de profundidade entrega a riqueza sem reprocessar o texto pronto.
- **Só reescrever o prompt, sem `isDefault`/seletor:** rejeitado — não atende o pedido de "definir e basear
  no padrão" nem o destaque visual; e perde a âncora de completude que evita o encolhimento.
- **Constraint única no banco para `isDefault`:** adiado — índice parcial único é específico de Postgres;
  no SQLite/MVP a unicidade na escrita basta.
- **`baseResumeId` obrigatório no Modo 2:** rejeitado — quebraria chamadas atuais e o caso "sem nenhum
  STANDARD ainda"; opcional com fallback para o default mantém retrocompatibilidade.
- **Default = nenhum até o usuário escolher:** rejeitado em parte — auto-marcar o primeiro currículo como
  padrão garante o "pelo menos um" que o dono pediu, sem fricção.
