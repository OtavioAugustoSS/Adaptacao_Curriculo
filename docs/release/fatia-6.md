# Relatório de release — Fatia 6 · Importar currículo por ARQUIVO (PDF/DOCX/TXT) com IA

> Documento **committável** (vive no repo) para continuar o projeto em qualquer máquina.
> Continuação de `docs/release/fatia-5.md`. Consolidação do lead (template-workflow §6.2).
> Atualizado: 2026-05-30.

## Estado atual

- ✅ **Fatia 6 — importar currículo por arquivo**, via Agent Team de **5 papéis**
  (`cv-adapter-development-team`: lead + product-owner + architect + fullstack + qa):
  - **US-13** — no painel "Importar com IA" do `/perfil`, além de **colar texto** (Fatia 5), o usuário
    **envia um arquivo** (PDF, DOCX ou TXT) → `POST /api/profile/import/file` → o **servidor extrai o
    texto** → alimenta o **MESMO** pipeline da Fatia 5 (`extractProfileFromDump`) → o rascunho é
    **mesclado** no formulário (reusa `mergeDraft`) → revisão humana → Salvar (`PUT` estrito). O import
    **não persiste**.
- 🏁 **MVP + UI + import por texto + import por arquivo completos.**
- **Verificado à mão (lead):** `tsc --noEmit` limpo · `npm test` **243/243** (25 arquivos; 211 da Fatia 5
  intactos + **32 novos**) · `npm run build` OK (**12 rotas**, nova `/api/profile/import/file`). O `/perfil`
  ficou em 26.6 kB — os parsers `unpdf`/`mammoth` **não entram no bundle do cliente** (imports dinâmicos
  no servidor).

## O que mudou (US-13)

| Camada | Entrega |
|--------|---------|
| **Contrato** | Rota nova `POST /api/profile/import/file` (`multipart/form-data`, campo `file`) → response `ProfileBundleSchema` (mesmo rascunho **tolerante** da Fatia 5, **não persistido**). **Sem mudança de schema** (reusa `ImportProfileBundleSchema`/`ProfileBundleSchema`). Validação por whitelist de tipo + limite (corpo binário, sem Zod). |
| **Extração** | `src/server/profile/extract-text.ts` (**fronteira única** arquivo→texto, espelha `escape-latex.ts`): PDF → `unpdf`, DOCX → `mammoth`, TXT → `TextDecoder`. Imports **dinâmicos** (fora do bundle do cliente). Sem OCR → PDF imagem/digitalizado devolve texto vazio. |
| **Rota** | `src/app/api/profile/import/file/route.ts` (`runtime = "nodejs"`): mapa de status do ADR-0019 — 400 (sem `file`), 415 (tipo), 413 (>8 MB), **422 (texto vazio — PDF imagem)**, 502 (`LLMError`), 500 (inesperado). Reusa `extractProfileFromDump` + `getLLMProvider` + `resolveModel` + helpers de `@/lib/http`. **Não persiste.** |
| **Whitelist** | `src/lib/import-file.ts` (fonte única server+UI): MIMEs/extensões PDF/DOCX/TXT, `MAX_IMPORT_FILE_BYTES` (8 MB), `isAcceptedImportFile` (aceita por MIME **ou** extensão), `IMPORT_FILE_ACCEPT`. |
| **UI** | `perfil/page.tsx`: no painel existente, input de arquivo (`accept`) + nome + botão "Enviar arquivo" + estados ocioso/enviando/erro; `handleImportFile` pré-valida tipo/tamanho no cliente, faz `FormData`→POST, no sucesso reusa `mergeDraft`, em erro mostra mensagem amigável sem alterar o bundle. Hint atualizado. |

## Trabalho do time nesta fatia

- **architect-agent** — **ADR-0019** (gate, antes do código): rota multipart nova; extração **no servidor**
  (`unpdf`+`mammoth`+TXT) justificada vs. navegador; validação por whitelist+limite (corpo binário, sem
  Zod); **reuso total** do pipeline da Fatia 5; **sem OCR** (PDF imagem → 422); invariante **extração ≠
  geração** herdado do ADR-0018. Confirmou **sem mudança de schema** e `ResumeContentSchema`/`/import`
  (texto) intocados. Nota datada no contrato + linha na §2 (com o mapa de status) + índice de ADRs.
- **product-owner-agent** — **US-13** (estende a US-11): critérios por estado e por formato; erros
  amigáveis (415/413/422/502); invariantes; fora de escopo (OCR, URL/LinkedIn, persistir arquivo, múltiplos).
- **fullstack-agent** — implementou após o gate: deps (`unpdf`+`mammoth`, confirmadas via context7),
  `import-file.ts`, `extract-text.ts` (imports dinâmicos), rota multipart, UI. `tsc` limpo; manteve 211.
  Detalhes: validação de tamanho dupla (`file.size` + bytes lidos), `Buffer.from(bytes)` p/ o mammoth,
  `UnsupportedFileTypeError` tipado.
- **qa-agent** — **32 testes novos** (total **243**): `import-file` (whitelist por MIME/extensão, limite),
  `extract-text` (TXT real; PDF/DOCX via **mock** de `unpdf`/`mammoth`, confirmando que `vi.mock` cobre os
  **imports dinâmicos**; tipo inválido → erro), rota (todos os status do ADR + **assert que não persiste**
  em todos os ramos). **Nenhum bug de produção.**
- **lead** — coordenou por mensagem; verificou à mão o gate (ADR + contrato), a implementação (arquivos-núcleo
  lidos) e rodou os gates. **Pegou um erro que o `npm test` não pega:** o 1º teste de rota do qa passava no
  vitest mas **quebrava o `npx tsc --noEmit`** (`Uint8Array` não é `BlobPart` válido ao montar o `File`) —
  devolveu ao qa, que corrigiu (cast `as BlobPart`) e revalidou os **dois** gates. Consolidou este relatório.

## Decisão-chave desta fatia
- **ADR-0019** — Fatia 6: importar currículo por arquivo. Rota multipart nova; extração de texto **no
  servidor** (`unpdf`/`mammoth`/TXT) numa **fronteira única**; **sem mudança de schema** (reusa o rascunho
  tolerante da Fatia 5); **sem OCR** (PDF imagem → 422 com fallback "colar texto"); **extração ≠ geração**
  mantido.

## Verificação (lead, à mão — Agent Teams é experimental)
- `npx tsc --noEmit` → **No errors** (gate que o `npm test`/vitest NÃO faz — pegou 1 erro de tipo no teste).
- `npm test` → **243 passed (25 arquivos)**; os 211 da Fatia 5 intactos (zero regressão).
- `npm run build` → **OK**, 12 rotas (nova `/api/profile/import/file`); `/perfil` 26.6 kB (parsers fora do cliente).

## Riscos / limites conhecidos (aceitos)
- **Sem OCR:** PDF digitalizado/imagem (sem camada de texto) → 422 orientando a colar o texto. Limitação
  consciente do MVP; reabrir é uma fatia futura.
- **Qualidade da extração** depende de `unpdf`/`mammoth` (layout complexo de PDF pode sair com texto fora de
  ordem) — mitigado pela **revisão humana** antes de salvar (a IA só estrutura; o usuário corrige).
- **Duas deps novas** (`unpdf`, `mammoth`) só no servidor — não incham o bundle do cliente (confirmado no
  build). Superfície de supply chain ligeiramente maior, aceita.
- Sem testes de componente (mantido das fatias anteriores): o upload foi coberto por testes de
  lógica/rota/whitelist e validado no build; o fluxo visual é validado manualmente.

## Pendências
- **Nenhuma** bloqueante. (Opcional, dono: smoke test real do upload com a NIM `nvapi-`; OCR no futuro.)

## Versão executiva (stakeholders)
- O "Importar com IA" agora aceita **enviar o arquivo do currículo** (PDF/DOCX/TXT), não só colar texto: o
  sistema lê o arquivo, preenche o formulário para o usuário **revisar** e salvar — **sem a IA inventar nada**
  (estrutura só o que está no arquivo; revisão humana antes de salvar). PDFs de imagem (sem texto) avisam para
  colar o texto (sem OCR nesta versão).
- 243 testes verdes, build OK, **contrato congelado respeitado** (rota aditiva, sem mudança de schema).

## Próximo passo
- **Commitar a Fatia 6** (proposta abaixo).
- Smoke test real opcional do upload com a NIM (chave `nvapi-`).

## Commit proposto
`feat: Fatia 6 — importar currículo por arquivo PDF/DOCX/TXT (US-13), ADR-0019`

**Novos:** `src/lib/import-file.ts`, `src/server/profile/extract-text.ts`,
`src/app/api/profile/import/file/route.ts`, `tests/import-file.test.ts`, `tests/extract-text.test.ts`,
`tests/profile-import-file-route.test.ts`, `docs/adr/0019-import-perfil-por-arquivo.md`,
`docs/user-stories/US-13-importar-curriculo-arquivo-ia.md`, este relatório.
**Modificados:** `src/app/(dashboard)/perfil/page.tsx`, `docs/api-contract.md`, `docs/adr/README.md`,
`docs/user-stories/README.md`, `package.json`, `package-lock.json`.
