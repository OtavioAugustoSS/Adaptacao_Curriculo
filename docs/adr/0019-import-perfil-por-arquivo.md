# 0019 — Fatia 6: importar currículo por arquivo (PDF/DOCX/TXT)

- **Status:** Accepted
- **Data:** 2026-05-30

## Contexto

A Fatia 5 ([[0018-import-perfil-dump-education-current]]) entregou o "Importar com IA" por
**texto colado**: `POST /api/profile/import` recebe `{ rawText }`, a IA estrutura um rascunho
de `ProfileBundle` (variante tolerante, **não persistido**), o formulário do `/perfil` mescla
esse rascunho e o usuário revisa antes de salvar pelo `PUT /api/profile` existente. O hint do
painel já fala em "currículo antigo", mas a entrada só aceita texto.

O dono quer a opção irmã: **enviar o arquivo do currículo** (PDF, DOCX ou TXT) em vez de copiar
e colar. O modelo do MVP é **text-only** (`meta/llama-3.3-70b-instruct`,
[[0013-modelo-padrao-llama-3-3-70b]]) — não é possível mandar o binário direto à IA. O caminho
é, portanto, **arquivo → texto → o EXISTENTE `extractProfileFromDump`**: reaproveitamos
integralmente o pipeline já validado da Fatia 5, só acrescentando uma etapa de extração de
texto antes dele.

Isto toca o **contrato congelado** (`docs/api-contract.md`,
[[0011-contrato-api-zod-congelado]]) — uma rota nova — então exige o gate do architect: ADR +
nota datada no contrato. As forças a equilibrar:

- A extração roda no **servidor** (não no navegador): parsing testável, sem inchar o bundle do
  cliente, e mantém a chave/credencial da IA fora do front.
- A entrada é **binária**: não há corpo JSON para validar com Zod; a validação precisa de outra
  forma (tipo + tamanho).
- O invariante anti-alucinação ([[0008-guardrail-anti-alucinacao-3-camadas]]) não pode enfraquecer.
  Como na Fatia 5, isto é **extração, não geração**: o usuário fornece o próprio material.

## Decisão

### 1. Rota nova `POST /api/profile/import/file` — multipart, devolve o mesmo rascunho da Fatia 5

Adicionamos um Route Handler:

- **Request:** `multipart/form-data` com um campo **`file`** (o arquivo do currículo). **Não há
  schema Zod de corpo** — o corpo é binário (ver item 3).
- **Response:** `ProfileBundleSchema` — exatamente o **mesmo rascunho tolerante** da Fatia 5,
  validado no adapter pela `ImportProfileBundleSchema` (`fullName` pode vir `""`). É um
  **rascunho NÃO persistido**, devolvido ao formulário do `/perfil` para o usuário mesclar e
  revisar.
- **`export const runtime = "nodejs"`** — a extração de texto usa APIs de Node (Buffer/streams
  das libs de parsing); não roda no edge runtime.
- **NÃO persiste.** Quem salva continua sendo o `PUT /api/profile` estrito, após a revisão humana.

**Sem mudança de schema.** A rota reusa `ImportProfileBundleSchema`/`ProfileBundleSchema` da
Fatia 5; nenhum schema novo de request/response é criado, e o `ResumeContentSchema` (núcleo do
guardrail) **permanece congelado e intocado**.

### 2. Extração de texto no SERVIDOR — `unpdf` (PDF) + `mammoth` (DOCX) + TXT nativo

A conversão arquivo → texto acontece **no servidor**, em uma **fronteira única**
(`src/server/profile/extract-text.ts`), espelhando a filosofia de fronteira única do
`escape-latex.ts` ([[0009-escape-latex-centralizado]]). O despacho é por tipo:

- **PDF** → **`unpdf`** (PDF→texto em JS puro; wrap serverless do pdfjs, sem binário nativo,
  ideal para Next/Node).
- **DOCX** → **`mammoth`** (`extractRawText`).
- **TXT** → nativo: `new TextDecoder("utf-8").decode(bytes)` (sem lib).
- Tipo fora da whitelist → erro tipado (mapeado a 415/400 na rota).

**Servidor × navegador (justificativa):** o parsing no servidor é **testável** com mocks
determinísticos (sem rede, sem DOM), **não incha o bundle** do cliente com parsers pesados de
PDF/DOCX, e centraliza a lógica numa fronteira única auditável. O navegador exigiria carregar
pdfjs/mammoth no front (peso + variação por browser) e dificultaria os testes. Por isso a
extração é server-side.

**Duas dependências novas, confirmadas pelo dono** (CLAUDE.md exige confirmação prévia):
`unpdf` e `mammoth`. TXT não precisa de lib.

### 3. Validação SEM schema Zod de corpo — whitelist de tipo + limite de tamanho

O corpo é **binário** (multipart), não um JSON parseável por Zod. A validação do request é por:

- **Whitelist de tipo:** apenas PDF (`application/pdf`), DOCX
  (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`) e TXT
  (`text/plain`) — por MIME **e** por extensão (`.pdf`/`.docx`/`.txt`), porque o MIME do
  multipart nem sempre é confiável. Whitelist e limite ficam numa fonte única compartilhada
  (`src/lib/import-file.ts`), reusada pela rota (servidor) e pelo `accept`/pré-validação da UI.
- **Limite de tamanho:** **8 MB** (`MAX_IMPORT_FILE_BYTES`) — suficiente para um currículo,
  barra uploads abusivos.

**Mapa de status de erro da rota** (envelope padrão `{ error: { code, message, details? } }` de
`@/lib/http`):

| Situação | Status | Observação |
|---|---|---|
| Sem campo `file` no multipart | **400** | `INVALID_REQUEST` (campo ausente). |
| Tipo fora da whitelist | **415** | `UNSUPPORTED_MEDIA_TYPE` (não-PDF/DOCX/TXT). |
| Arquivo acima do limite | **413** | `PAYLOAD_TOO_LARGE` (> 8 MB). |
| Texto extraído vazio | **422** | `EMPTY_EXTRACTION` (ver item 5 — PDF imagem/digitalizado). |
| `LLMError` (transporte/validação) | **502** | `LLM_ERROR` (mesma política do `/import` texto). |
| Inesperado | **500** | `INTERNAL_ERROR`. |

> Os códigos exatos (e a opção de degradar 415→400 / 413→400) ficam a critério do fullstack na
> implementação; o importante é a semântica: ausência → 400, tipo → 415, tamanho → 413, vazio →
> 422, IA → 502.

### 4. Reuso total do pipeline da Fatia 5 — só uma etapa nova antes

O fluxo é: **arquivo → (extração de texto) → texto → o EXISTENTE `extractProfileFromDump` →
mesmo rascunho → merge no formulário**. A única peça nova no caminho da IA é a etapa
arquivo→texto; daí em diante é **idêntico** à Fatia 5:

- `extractProfileFromDump(text, provider, modelId)` (`src/server/profile/extract-profile.ts`) —
  **não muda**.
- `getLLMProvider` (`src/server/llm/index.ts`), `resolveModel` (`src/server/llm/models.ts`) —
  reuso.
- Variante tolerante (`ImportProfileBundleSchema`) validada dentro do
  `NimProvider.extractProfileFromDump` — **não muda**.
- `errorResponse`/`validationErrorResponse` (`src/lib/http.ts`) — reuso.

**A rota `/api/profile/import` (texto) e o `ResumeContentSchema` NÃO mudam.** A entrada por
arquivo é puramente aditiva: um adaptador de entrada (binário→texto) na frente de um pipeline
intocado.

### 5. SEM OCR — PDF digitalizado/imagem (sem camada de texto) → 422 amigável

OCR fica **fora do escopo do MVP**. Um PDF digitalizado ou exportado como imagem **não tem
camada de texto**; `unpdf` devolve texto **vazio**. Nesse caso a rota retorna **422** com
mensagem amigável orientando o usuário a **colar o texto manualmente** (caindo no
`/api/profile/import` por texto, que já existe).

**Por que OCR fica fora:** OCR exigiria uma dependência pesada (Tesseract/serviço externo),
latência e custo desproporcionais para um caso de borda do MVP single-user; e o usuário sempre
tem o caminho de fallback (colar o texto). O ganho não justifica o peso agora. A porta fica
aberta para uma fatia futura, sem reabrir esta decisão.

### 6. Invariante EXTRAÇÃO ≠ GERAÇÃO mantido (herdado do ADR-0018)

Esta rota **herda integralmente** a racional do [[0018-import-perfil-dump-education-current]] §4:
a IA estrutura **só o conteúdo do arquivo do próprio usuário** — não há base de referência contra
a qual comparar, então o guardrail de rastreabilidade (`validate-traceability.ts`) **não se
aplica**. A proteção é a mesma dupla, suficiente para extração:

1. **Prompt restritivo** (o mesmo `buildParseDumpPrompts` da Fatia 5): "estruture apenas o que
   está no texto; não invente nem infira; deixe vazio o que não aparecer".
2. **Revisão humana antes de persistir:** a rota **não salva**; devolve rascunho ao formulário; o
   usuário revisa e só então usa o `PUT /api/profile` estrito.

O invariante de produto ("a IA nunca inventa informação") **continua íntegro**: o usuário fornece
o próprio arquivo e revisa o resultado. A geração de currículo, o guardrail de rastreabilidade e o
invariante anti-alucinação **não mudam**.

## Consequências

- **Onboarding ainda mais rápido:** arrastar o PDF do currículo, em vez de copiar e colar o texto.
- O contrato muda de forma **mínima e aditiva**: **uma rota nova**, **sem nenhum schema novo**
  (reusa `ProfileBundleSchema`/`ImportProfileBundleSchema` da Fatia 5). O `ResumeContentSchema`
  segue congelado; a rota `/api/profile/import` por texto segue idêntica.
- O pipeline de IA da Fatia 5 é reaproveitado **inteiro** — só ganha um adaptador de entrada
  (binário→texto) na frente. Risco de regressão baixo: a parte sensível (extração via LLM +
  validação tolerante) não é tocada.
- Surge uma **fronteira nova** arquivo→texto (`extract-text.ts`), análoga ao `escape-latex.ts`:
  um único ponto auditável e testável (mocks de `unpdf`/`mammoth`), sem rede.
- **Duas dependências novas** (`unpdf`, `mammoth`) entram só no servidor — não incham o bundle do
  cliente. Custo de manutenção e superfície de supply chain ligeiramente maiores, aceitos pela
  escolha do dono.
- A validação deixa de ser "Zod no corpo" e passa a ser **whitelist de tipo + limite de tamanho**:
  uma forma de validação diferente das demais rotas, justificada por o corpo ser binário. Fonte
  única (`import-file.ts`) evita divergência entre servidor e UI.
- **Sem OCR:** PDFs digitalizados/imagem não funcionam por upload — viram 422 com fallback para
  colar texto. Limitação consciente do MVP; reabrir é uma fatia futura, não uma dívida silenciosa.

## Alternativas consideradas

- **Extrair o texto no NAVEGADOR (client-side):** rejeitado — incharia o bundle do cliente com
  pdfjs/mammoth, variaria por browser e dificultaria os testes determinísticos. O servidor é
  testável, isolado e mantém a credencial da IA fora do front.
- **Mandar o arquivo direto para a IA (multimodal):** rejeitado — o modelo do MVP é **text-only**
  ([[0013-modelo-padrao-llama-3-3-70b]]); não aceita o binário. Trocar de modelo só por isso seria
  desproporcional. O caminho arquivo→texto→`extractProfileFromDump` reusa o fluxo já validado.
- **Schema Zod para o corpo da rota:** rejeitado — o corpo é `multipart/form-data` binário, não um
  JSON; Zod no corpo não se aplica. A validação correta para binário é whitelist de tipo + limite
  de tamanho.
- **Incluir OCR para PDFs digitalizados/imagem:** rejeitado (fora de escopo) — dependência pesada,
  latência e custo desproporcionais para um caso de borda do MVP; o usuário tem o fallback de colar
  o texto (422 amigável). Fica para uma fatia futura.
- **Persistir o arquivo enviado / histórico de imports:** rejeitado (fora de escopo) — o import é
  efêmero (arquivo → rascunho → revisão → save). Guardar o binário não agrega ao MVP e adiciona
  superfície de armazenamento/privacidade.
- **Sobrecarregar a rota `/api/profile/import` (texto) para também aceitar arquivo:** rejeitado —
  acoplaria dois formatos de request (JSON × multipart) numa rota já validada em produção. A rota
  nova dedicada isola o caminho binário sem risco de regressão no fluxo de texto.
- **Aceitar mais formatos (RTF, ODT, etc.):** rejeitado (fora de escopo) — PDF/DOCX/TXT cobrem a
  esmagadora maioria dos currículos; cada formato extra é uma lib/superfície a mais. Ampliável em
  fatia futura se houver demanda.
