# Relatório de release — Fatia 4 (polimento visual) · MVP + UI dev-tool

> Documento **committável** (vive no repo) para continuar o projeto em qualquer máquina.
> Continuação de `docs/release/fatia-3.md`. Consolidação do lead (template-workflow §6.2).
> Atualizado: 2026-05-30.

## Estado atual

- ✅ **Fatia 4 — Polimento visual**, via Agent Team **estendido de 6 papéis**
  (`cv-adapter-development-team`: lead + product-owner + architect + **frontend** + **backend** + qa):
  - **US-10** — redesign visual dev-tool (Linear/Vercel/Raycast): casca (sidebar + nav + toggle de
    tema light/dark + drawer mobile) + Início + Perfil + Gerar + Currículos, com **design system em
    Tailwind CSS v4** (tokens light+dark, Geist/Geist Mono), **todos os estados** por tela.
- 🏁 **MVP + UI completos:** as 9 US originais (US-01…09) + a US-10 (visual). **Apenas
  apresentação** mudou — nenhuma rota, schema, lógica ou contrato Zod foi alterado.
- **Verificado à mão (lead):** `tsc --noEmit` limpo · `npm test` **165/165** (17 arq.; 147 originais
  intactos + 18 novos) · `npm run build` OK (10 rotas).
- O design foi produzido na ferramenta **Claude Design** (claude.ai/design) em 3 rodadas e
  recriado no app real em Tailwind (não é o protótipo importado). Reference versionado em
  `docs/design/claude-design/`; brief em `docs/fatia-4-design.md`.

## O que mudou (US-10 — status)

| Tela | Entrega |
|------|---------|
| **Casca** | `(dashboard)/layout.tsx`: sidebar 240px, nav Início/Perfil/Gerar/Currículos (ativo = `surface-2` + acento + barra 3px + `aria-current`), `nav-sub` com contagens **derivadas no cliente**, toggle de tema persistido (`cv-theme`, default dark) via `data-theme`, drawer mobile <820px + scrim. |
| **Início** | `(dashboard)/page.tsx`: saudação + chips de status da base (omitem zero) + 3 atalhos; estado base vazia. |
| **Perfil** | cabeçalho + 6 listas (add/editar/remover/reordenar, toggle, bullets, tags) + savebar fixa + estados carregando/pronto/vazio/salvando/salvo/erro por campo. |
| **Gerar** | tabs Padrão/Adaptar, textarea da vaga, estados validando/base-insuficiente/ocioso/gerando/erro/preview; preview com Copiar→"Copiado!", Baixar `.tex` real, avisos numerados (campos reais) e bloco `.tex` (realce leve). `.demobar` do protótipo removido. |
| **Currículos** | cards com rótulo do modo (ADR-0016, nunca a vaga) + badge + data `dd/mm/aaaa HH:mm` + meta faangpath + avisos expansíveis + Baixar `.tex` cacheado; estados carregando/erro/vazio/populado. |

## Trabalho do time nesta fatia

- **architect-agent** — **ADR-0017**: Tailwind v4 + `@tailwindcss/postcss` (sem `tailwind.config.js`),
  `@theme inline` consumindo as CSS vars sob `data-theme` (fonte única, light/dark em runtime), Geist
  via `next/font/google`, spacing 4pt = escala nativa. Confirmou **contrato Zod congelado intacto**.
- **product-owner-agent** — **US-10** com critérios de aceite por tela e por estado; travou as
  decisões (título = rótulo do modo / ADR-0016; sem dado inventado; avisos com campos reais; remover
  `.demobar`; tema default dark).
- **backend-agent** — veredito: **contrato intacto, zero mudança de backend**. A UI nova é 100%
  derivável de `GET /api/profile` e `GET /api/resumes` (contagens no cliente; sem endpoint/campo novo).
  Heads-up útil: campo é `educations` (plural), não `education`.
- **frontend-agent** — instalou Tailwind (2 deps confirmadas pelo dono), montou `globals.css` +
  `@theme` + Geist, recriou casca + 5 telas em Tailwind preservando toda a lógica/API, e **extraiu a
  lógica de apresentação para helpers puros** (`src/lib/presentation/`) consumidos pelos componentes
  (fonte única). Verificou no navegador (dark/light/mobile) e gerou Modo 1 real contra a NIM.
- **qa-agent** — baseline 147 travado; confirmou **ausência de lib de teste de componente** e
  **não instalou dep** → testes de **lógica pura**. `tests/presentation-hardening.test.ts` (**18
  testes**) cobre as travas: rótulo do modo (ADR-0016, nunca a vaga), gating de avisos (só warnings,
  **errors nunca**), contagens com `educations` plural + plural PT-BR, tema default dark/`cv-theme`,
  `formatResumeDate` com bordas. Nenhum bug de produção.

## Decisão-chave desta fatia
- **ADR-0017** — Tailwind CSS v4 na Fatia 4: setup no Next 15 + mapeamento dos tokens do DS via
  `@theme inline` sobre CSS vars (`data-theme`); contrato congelado intacto; ownership front/back.

## Verificação (lead, à mão — Agent Teams é experimental)
- `npx tsc --noEmit` → **No errors**.
- `npm test` → **165 passed (17 arquivos)**; os 147 originais byte-idênticos (zero regressão).
- `npm run build` (`.next` limpo) → **OK**, 10 rotas.
- Helpers de `src/lib/presentation/` lidos e conferidos (corretos vs US-10/ADR-0016/ADR-0015).

## Riscos / limites conhecidos (aceitos)
- Sem lib de teste de componente (decisão: não instalar dep) → cobertura da Fatia 4 é de **lógica
  pura** (helpers), não de render. Os comportamentos visuais foram validados manualmente no navegador.
- `docs/design/claude-design/` versiona o **protótipo** (referência morta, não importado) — risco de
  drift com o app é aceito; a fonte de build é o código Tailwind, não o `cv.css`.
- O boot-script de tema no `layout.tsx` raiz é uma IIFE inline (não pode importar helper); sua lógica
  espelha `resolveTheme`/`THEME_STORAGE_KEY`.

## Nota de divergência (deliberada) da US-10
- **Título do preview no Modo 1:** o frontend usa `resumeModeLabel` no preview → "Currículo padrão
  (.tex)" (consistente com o histórico), em vez do "Currículo gerado (.tex)" literal da US-10.
  **Mantido pelo lead** como melhoria (rótulo único, DRY). O dono pode vetar (revert de 1 linha);
  se mantido, o PO atualiza o critério da US-10.

## Pendências
- **Nenhuma** bloqueante. (Opcional, decisão do dono: o título do preview acima.)

## Versão executiva (stakeholders)
- O CV-Adapter agora tem uma **interface dev-tool moderna e coesa** (tema claro/escuro, casca de
  navegação, estados cuidados em todas as telas), **sem alterar nada do comportamento ou das
  garantias** do produto (a IA continua não inventando; saída `.tex` para o Overleaf).
- 165 testes verdes, build OK, contrato congelado respeitado.

## Próximo passo
- **Commitar a Fatia 4** (proposta abaixo) — o dono commita.
- Possíveis melhorias futuras (fora de escopo): lib de teste de componente + testes de render;
  smoke test visual automatizado; título da vaga no histórico (exigiria superar ADR-0016).

## Commit proposto (o dono commita)
`feat: Fatia 4 — redesign visual dev-tool (US-10) com Tailwind + design system (ADR-0017)`
Inclui (novos): `postcss.config.mjs`, `src/app/globals.css`, `src/app/(dashboard)/layout.tsx`,
`src/app/(dashboard)/page.tsx`, `src/components/Icon.tsx`, `src/components/TexCode.tsx`,
`src/lib/presentation/{resume-meta,base-stats,theme}.ts`, `tests/presentation-hardening.test.ts`,
`docs/adr/0017-*`, `docs/user-stories/US-10-*`, `docs/fatia-4-design.md`, `docs/design/claude-design/*`,
este relatório. (Modificados): `src/app/layout.tsx`, `src/app/(dashboard)/{perfil,gerar,curriculos}/page.tsx`,
`src/components/perfil/ListSection.tsx`, `package.json`, `package-lock.json`, `.gitignore`,
`docs/adr/README.md`, `docs/user-stories/README.md`. (Removido): `src/app/page.tsx` (Home foi p/ a casca).
