# US-13 — Importar currículo por arquivo (PDF/DOCX/TXT) com IA

**Fatia:** 6 — Import por arquivo (IA)
**Dependências:** **US-11** (estende-a — reusa o painel "Importar com IA", o `mergeDraft` no formulário e o pipeline `extractProfileFromDump`); US-02, US-03 (CRUD do perfil + listas da base — reusa o formulário e o `PUT /api/profile`); US-04 (camada `LLMProvider`/NIM). Depende do **ADR-0019** (rota de import por arquivo, extração no servidor, `unpdf`+`mammoth`, whitelist + limite, sem OCR).

## História

**Como** usuário,
**quero** enviar o **arquivo do meu currículo** (PDF, DOCX ou TXT) no painel "Importar com IA" do `/perfil` e a IA extrair/estruturar as informações no formulário,
**para** não precisar copiar e colar o texto — revisando o resultado antes de salvar.

## Descrição

- O painel **"Importar com IA"** (criado na US-11) passa a aceitar **duas entradas**: **colar texto** (já existente) **OU enviar um arquivo**. Ao lado da textarea, um **input de arquivo** (com `accept` restrito a PDF/DOCX/TXT), o **nome do arquivo selecionado** e um botão **"Enviar arquivo"**.
- Ao enviar, o front faz `POST /api/profile/import/file` com `multipart/form-data` (campo `file`). O **servidor extrai o texto** do arquivo (PDF/DOCX/TXT), alimenta o **MESMO** pipeline da US-11 (`extractProfileFromDump`) e devolve o **mesmo rascunho** (`ProfileBundle`, ids ausentes ok) — **não persiste**.
- No sucesso, o rascunho é **MESCLADO** no estado do formulário aberto, exatamente como na US-11 (reusa `mergeDraft`):
  - **Acrescenta** itens às 6 listas (Experiência, Formação, Habilidades, Projetos, Idiomas, Cursos) — **nada existente é apagado**.
  - Preenche campos do **cabeçalho** (nome, e-mail, telefone, localização, website, linkedin, github, resumo) **somente onde estiverem vazios** — **não sobrescreve** o que o usuário já preencheu.
- O usuário **revisa** o formulário mesclado e usa o **Salvar existente** (`PUT /api/profile`, fluxo da US-02/US-03) para persistir. O painel de import **não** tem botão de salvar próprio.
- **Invariante (explicitar na UI e no prompt):** a IA **estrutura só o que está no arquivo** — **não inventa nem infere**; deixa **vazio** o que não aparece. A proteção é o prompt "estruture só o texto, não invente" + a **revisão humana**. **Extração ≠ geração:** este import **não** passa pelo guardrail de rastreabilidade (`validate-traceability.ts`), que é da geração base→.tex.
- Atualizar o **hint** do painel para mencionar que se pode "colar texto **ou enviar um arquivo (PDF, DOCX, TXT)**".

## Referências

- **Spec:** §2.1 (tela Perfil — base como fonte da verdade; o painel é uma entrada acelerada para a mesma base). §4 (regra inegociável "nunca inventa") aplicada à extração.
- **Contrato de API:** **rota nova** `POST /api/profile/import/file` — request `multipart/form-data` (campo `file`), **sem schema Zod de corpo** (é binário; validação por whitelist de tipo + limite de tamanho), response `ProfileBundleSchema` (rascunho, **não persistido** — mesmo da US-11). Reusa `PUT /api/profile` (`ProfileBundleSchema`) para o salvar. Envelope de erro padrão `{ error: { code, message, details? } }`.
- **ERD:** sem entidade nova. O rascunho usa as entidades existentes (`Profile` + 6 listas) **sem `id`** (não persistido até o `PUT`).
- **Código:** `src/lib/import-file.ts` (novo — whitelist de tipo/extensão + limite, fonte única para rota e UI), `src/server/profile/extract-text.ts` (novo — fronteira única arquivo→texto: PDF via `unpdf`, DOCX via `mammoth`, TXT via `TextDecoder`), `src/app/api/profile/import/file/route.ts` (novo — `runtime = "nodejs"`), `src/app/(dashboard)/perfil/page.tsx` (input de arquivo + `handleImportFile` + reuso de `mergeDraft`). **Reusa sem alterar:** `src/server/profile/extract-profile.ts` (`extractProfileFromDump`), `src/server/llm/{index,models,nim,provider}.ts`, `src/lib/http.ts`, `src/lib/schemas/profile-import.ts`, `src/app/api/profile/import/route.ts`.
- **Arquitetura/ADRs:** **ADR-0019** (import por arquivo — extração no servidor, `unpdf`+`mammoth`, whitelist + limite, reuso de `extractProfileFromDump`, sem OCR → PDF-imagem vira 422, extração ≠ geração mantida). ADR-0018 (Fatia 5 — import por dump; rota não persiste; esta US a estende para arquivo). ADR-0011 (contrato congelado — estendido com nota datada). ADR-0004 (`LLMProvider` — extensão aditiva, sem mexer no `generateResumeContent`).

## Decisões de produto travadas nesta US

1. **Extração no SERVIDOR, não no navegador.** Rota multipart nova; parsing testável; sem inchar o bundle do cliente. (Decisão do dono, plano da Fatia 6.)
2. **Formatos aceitos: PDF, DOCX e TXT.** Outros tipos → erro amigável "formato não suportado".
3. **Arquivo → texto → `extractProfileFromDump` (reuso total).** O modelo é text-only (`llama-3.3-70b-instruct`); o arquivo não vai direto à IA. O servidor extrai o texto e o alimenta no pipeline já validado da US-11.
4. **Mesmo comportamento de merge da US-11.** Acrescenta às 6 listas; cabeçalho só onde vazio; **não persiste** no import (só o `PUT /api/profile` após a revisão).
5. **Sem dedup automático.** O usuário remove duplicatas manualmente na revisão (usa o "remover" das listas da US-03).
6. **Sem OCR no MVP.** PDF digitalizado/imagem (sem camada de texto) → **422** orientando a **colar o texto** manualmente.
7. **Extração ≠ geração.** Sem guardrail de rastreabilidade aqui; a invariante "não inventa" é garantida pelo prompt + revisão humana.

## Critérios de aceite (por estado)

### Estado ocioso
- **Dado** o painel "Importar com IA" aberto, **então** vejo, ao lado da textarea de colar texto, um **input de arquivo** restrito a PDF/DOCX/TXT (`accept`) e um botão **"Enviar arquivo"**.
- **Dado** que **nenhum arquivo** está selecionado, **então** o botão "Enviar arquivo" fica **desabilitado**.
- **Dado** que selecionei um arquivo, **então** seu **nome** aparece e o botão "Enviar arquivo" fica habilitado.

### Estado enviando
- **Dado** um arquivo selecionado, **quando** clico em "Enviar arquivo", **então** o botão entra em estado **"Enviando…"** com spinner e fica **desabilitado** enquanto a chamada `POST /api/profile/import/file` está em andamento (a outra entrada — colar texto — também não dispara em paralelo).

### Estado sucesso (merge)
- **Dado** que o import por arquivo retorna um rascunho `ProfileBundle`, **quando** a resposta chega, **então** os itens das 6 listas são **acrescentados** às listas atuais do formulário (nenhum item existente é removido) e os campos do **cabeçalho** são preenchidos **somente onde estavam vazios**.
- **E** uma mensagem/badge confirma que o formulário foi preenchido e **lembra o usuário de revisar e salvar** (mesmo feedback da US-11).
- **E** nada foi persistido ainda: só após clicar em **Salvar** (`PUT /api/profile`) os dados vão ao banco.

### Estado erro (mensagens amigáveis; formulário inalterado)
- **Dado** um arquivo de **tipo não suportado** (ex.: `.png`, `.xlsx`), **quando** o envio é tentado, **então** vejo uma mensagem amigável **"Formato não suportado — envie um PDF, DOCX ou TXT"** (origem `415`/`400` no backend; o `accept` do input já ajuda a prevenir) e o formulário **não é alterado**.
- **Dado** um arquivo **grande demais** (acima do limite, ex.: 8 MB), **então** vejo uma mensagem amigável de tamanho excedido (origem `413`/`400`) e o formulário **não é alterado**.
- **Dado** um **PDF digitalizado/imagem** (sem camada de texto extraível), **então** vejo uma mensagem amigável explicando que **não há OCR no MVP** e orientando a **colar o texto** manualmente na textarea (origem `422` no backend); o formulário **não é alterado**.
- **Dado** que o **LLM falha** (erro/timeout) ao estruturar o texto extraído, **então** vejo a **mensagem amigável** ("Não foi possível interpretar o arquivo — tente novamente" — origem `502`) e o formulário **não é alterado**.
- **Dado** que **nenhum arquivo** foi enviado ao backend, **então** a rota responde `400` — mas a UI já previne pelo botão desabilitado.

### Invariante na UI
- **Dado** um arquivo em que campos não aparecem (ex.: sem GitHub, sem idiomas), **então** o rascunho deixa esses campos/listas **vazios** — a IA **não inventa** valores plausíveis. A UI deixa claro (hint do painel) que a IA "estrutura apenas o que está no arquivo e não inventa nada".

## Estados envolvidos

- **Ocioso:** input de arquivo pronto; botão "Enviar arquivo" **desabilitado** sem arquivo; nome exibido ao selecionar.
- **Enviando:** "Enviando…" com spinner; botão desabilitado.
- **Sucesso (merge):** formulário mesclado + confirmação + lembrete de revisar/salvar (reusa o feedback da US-11).
- **Erro:** mensagem amigável conforme o caso (415/400 tipo, 413/400 tamanho, **422** PDF-imagem/sem OCR, 502 LLM); formulário **inalterado**.

## Fora do escopo

- **OCR** de PDFs digitalizados/imagem (sem camada de texto → 422 orientando a colar o texto). 
- **Import por URL / LinkedIn API** — apenas arquivo enviado (e o texto colado da US-11).
- **Persistir o arquivo enviado** ou manter **histórico de imports** (o arquivo e o texto extraído são descartados após gerar o rascunho).
- **Múltiplos arquivos** de uma vez.
- **Dedup automático** na mesclagem — o usuário remove duplicatas na revisão.
- Aplicar o **guardrail de rastreabilidade** ao import (é da geração base→.tex, não da extração).
- Editar/salvar direto pelo painel — o salvar é o `PUT /api/profile` existente, após revisão.
- Mudar a geração de currículo, o guardrail ou o invariante anti-invenção.

## Pendências

- [DECISÃO PENDENTE] **Limite de tamanho do arquivo.** O plano sugere **8 MB** (`MAX_IMPORT_FILE_BYTES`). Confirmar o valor exato com o dono/architect ao fechar o ADR-0019 (currículos reais raramente passam de poucos MB; 8 MB cobre PDFs com fotos sem permitir uploads abusivos).
- [DECISÃO PENDENTE] **Mensagem do 422 (PDF-imagem).** Texto sugerido: *"Não consegui extrair texto deste PDF — ele parece ser uma imagem/digitalização. Como não há OCR nesta versão, cole o texto do currículo na caixa ao lado."* Confirmar o tom/redação final com o dono.
