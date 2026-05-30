# 0017 — Tailwind CSS na Fatia 4: setup no Next 15 + mapeamento dos tokens do DS

- **Status:** Accepted
- **Data:** 2026-05-30

## Contexto

A Fatia 4 é o polimento visual (`docs/fatia-4-design.md`). Até aqui a UI usa inline-styles
funcionais. O dono aprovou **Tailwind CSS** como dependência nova e direção "dev-tool moderno"
(Linear/Vercel/Raycast), com **light + dark obrigatórios**.

O design system aprovado já existe como protótipo em `docs/design/claude-design/app/cv.css`:
tokens em `:root` (raios, spacing, fontes) e dois temas em `:root[data-theme="dark"]` /
`:root[data-theme="light"]` (canvas, surface, fg, accent, semânticos, sombras, ring, skeleton).
O acento é **#2f63ff** (light) / **#4f7cff** (dark). As fontes são **Geist** (UI) e **Geist Mono**
(`.tex`, metadados, números).

Restrições do projeto:
- O contrato Zod (`docs/api-contract.md`) está **congelado** ([[0011-contrato-api-zod-congelado]]) —
  a Fatia 4 não pode introduzir schema, rota ou campo novo.
- Stack: Next.js 15 (App Router) + React 19 + TypeScript estrito ([[0001-app-web-fullstack-nextjs]]).
  `package.json` instalado: `next@^15.5.18`, `react@^19.2.6`, `typescript@^5.9.3`. `"type": "module"`.
- A Fatia 4 split o time em `frontend-agent` + `backend-agent`; este ADR é o **gate** que destrava
  o código de ambos. Precisa ser concreto o bastante para o frontend executar sem ambiguidade.

É preciso decidir **como** Tailwind entra (versão, plugins, config) e **como** os tokens do DS
viram theme do Tailwind sem duplicar a fonte da verdade nem perder o par light/dark.

## Decisão

### 1. Adotar Tailwind CSS v4 com o plugin PostCSS

Adotamos **Tailwind CSS v4** com o pipeline PostCSS oficial (sem `tailwind.config.js`; v4
configura via CSS). Não há `tailwind.config` JS — a config vive no `globals.css` via `@theme`.

**Dependências exatas a instalar** (devDependencies; o dono confirma e instala — não instalar aqui):

```
tailwindcss@^4.1
@tailwindcss/postcss@^4.1
```

`postcss` entra como dependência transitiva de `@tailwindcss/postcss`; não declarar `autoprefixer`
nem `postcss-import` (Tailwind v4 já embute import e prefixing). Criar `postcss.config.mjs` na raiz
(ESM, coerente com `"type": "module"`):

```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

`globals.css` (em `src/app/globals.css`, importado uma vez em `src/app/layout.tsx`) começa com:

```css
@import "tailwindcss";
```

### 2. Fontes Geist + Geist Mono via `next/font/google`

Carregar **Geist** e **Geist Mono** por `next/font/google` em `layout.tsx` (não o `<link>` do
protótipo) — self-host automático, sem FOUT, sem request externo:

```ts
import { Geist, Geist_Mono } from "next/font/google";
const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
```

Aplicar `geist.variable` e `geistMono.variable` na `<html>`. No `@theme`, as famílias apontam para
essas variáveis (`var(--font-geist-sans)`), com os mesmos fallbacks do protótipo
(`system-ui,sans-serif` / `ui-monospace,monospace`). Isto **substitui** a string literal `'Geist'`
do `cv.css`.

### 3. Mapear os tokens do DS via `@theme` consumindo CSS variables (fonte única da verdade)

A fonte da verdade dos **valores de cor** continua sendo o par `[data-theme="dark"]` /
`[data-theme="light"]` — porque cor depende do tema, e `@theme` (estático) não troca em runtime.
Portar o bloco de tokens do `cv.css` para `globals.css` **fora** do `@theme`:

```css
:root { --r-sm:6px; /* … raios, spacing iguais ao cv.css … */ }
:root[data-theme="dark"]  { color-scheme:dark;  --canvas:#0b0d11; --accent:#4f7cff; /* … */ }
:root[data-theme="light"] { color-scheme:light; --canvas:#f6f7f9; --accent:#2f63ff; /* … */ }
```

O `@theme` do Tailwind **consome** essas variáveis (não redefine valores), gerando os utilitários:

```css
@theme inline {
  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-fg: var(--fg);
  --color-fg-muted: var(--fg-muted);
  --color-fg-subtle: var(--fg-subtle);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-press: var(--accent-press);
  --color-accent-fg: var(--accent-fg);
  --color-accent-subtle: var(--accent-subtle);
  --color-accent-border: var(--accent-border);
  --color-success: var(--success);
  --color-success-subtle: var(--success-subtle);
  --color-success-border: var(--success-border);
  --color-warning: var(--warning);
  --color-warning-subtle: var(--warning-subtle);
  --color-warning-border: var(--warning-border);
  --color-danger: var(--danger);
  --color-danger-subtle: var(--danger-subtle);
  --color-danger-border: var(--danger-border);

  --radius-sm: var(--r-sm);
  --radius-md: var(--r-md);
  --radius-lg: var(--r-lg);
  --radius-xl: var(--r-xl);
  --radius-2xl: var(--r-2xl);
  --radius-full: var(--r-full);

  --font-sans: var(--font-geist-sans), system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;

  --shadow-xs: var(--sh-xs);
  --shadow-sm: var(--sh-sm);
  --shadow-md: var(--sh-md);
  --shadow-lg: var(--sh-lg);
}
```

Notas de mapeamento concretas para o frontend:
- **`@theme inline`** é obrigatório aqui: como os valores são `var(--…)` que mudam por `data-theme`,
  `inline` faz o Tailwind emitir a `var()` no utilitário (ex.: `bg-surface` → `background:var(--surface)`),
  não congelar o valor. Sem `inline`, o dark/light quebraria.
- O **spacing** do DS (`--s-1`…`--s-16`, base 4pt) **coincide** com a escala 4px nativa do Tailwind v4
  (`p-1`=4px, `p-4`=16px, `p-6`=24px, `p-8`=32px, `p-10`=40px, `p-12`=48px, `p-16`=64px). **Não**
  redefinir `--spacing` no `@theme`; usar os utilitários nativos. `--s-5`=20px → `p-5`; `--s-3`=12px → `p-3`.
- Cor → `bg-*`/`text-*`/`border-*` (ex.: `bg-canvas text-fg`, `border-border`, `text-accent`).
- Raio → `rounded-sm|md|lg|xl|2xl|full`. Sombra → `shadow-xs|sm|md|lg`. Fonte → `font-sans|mono`.
- O **`--ring`** e o `--skel` (gradiente do skeleton) ficam como CSS var crua — usar via
  `ring`/`outline` arbitrário (`shadow-[0_0_0_3px_var(--ring)]`) ou em `@layer components`; não viram
  token de cor do `@theme`.
- Os **componentes** do `cv.css` (`.btn`, `.input`, `.card`, `.note`, `.tabs`, shell etc.) não são
  portados verbatim como classes globais; o frontend recria cada um com utilitários Tailwind
  (ou, quando repetitivo, `@layer components` no `globals.css`). O `cv.css` permanece como
  **referência de protótipo** versionada — não é importado pelo app.

### 4. Tema light/dark — fonte única da verdade no atributo `data-theme`

O tema é controlado por **`data-theme` no `<html>`** (mesma convenção do `cv.css`). O `layout.tsx`
define `data-theme` (default coerente com o toggle do shell), e o toggle de tema da Casca (task #4)
escreve nesse atributo. **Não** usar a estratégia `dark:` baseada em classe/`prefers-color-scheme` do
Tailwind para as cores do DS — as cores vêm das CSS vars sob `data-theme`, então `bg-surface` já
resolve para o tema ativo automaticamente. Isso mantém **uma** fonte da verdade (o atributo) e evita
duplicar variantes `dark:` em todo componente. `@custom-variant dark` não é necessário para cor.

### 5. Contrato Zod CONGELADO permanece intacto — nenhuma mudança

A Fatia 4 é **só apresentação**. Confirmado explicitamente:
- **Nenhum schema novo** em `src/lib/schemas/`; **nenhuma rota nova**; **nenhum campo novo** no contrato.
- As **contagens** que a UI nova pede — `nav-sub` da sidebar e os chips de status da Home — são
  **derivadas no cliente** a partir de `GET /api/profile` (`ProfileBundleSchema`: contar itens das
  listas `experiences`/`education`/`skills`/`projects`/`languages`/`courses`) e de `GET /api/resumes`
  (`GeneratedResumeSchema[]`: contar/agrupar por `mode`). **Sem** novo endpoint, **sem** novo campo,
  **sem** `count` no servidor.
- Os dados das telas continuam vindo das rotas já listadas em `docs/api-contract.md` §2. O preview
  `.tex` vem do renderer real via `GET /api/resumes/[id]/download` (nunca de um `buildTex` JS).
- [[0016-modo2-historico-escopo-mvp]] mantido: o card de Currículos usa **rótulo do modo**
  ("Currículo adaptado à vaga" / "Currículo padrão") + data + nome do arquivo; **não** exibe
  título/empresa da vaga (isso exigiria denormalizar o contrato — fora de escopo).

### 6. Fronteira de ownership (Fatia 4)

Reafirmada de `docs/agent-team.md`:
- **frontend-agent:** `src/components/` + a **apresentação** de `src/app/**/page.tsx`. Dono do
  `globals.css`, do `@theme`, da config Tailwind/PostCSS e do uso de `next/font`. Consome os schemas
  Zod **read-only**.
- **backend-agent:** `src/server/`, `src/app/api/`, `prisma/`, `src/lib/schemas/` e Server Actions.
  Mantenedor do contrato congelado; qualquer mudança de contrato só via proposta ao architect + ADR.

## Consequências

- Estilização consistente com tokens nomeados; o visual aprovado é reproduzível com utilitários,
  sem inline-styles soltos.
- **Uma** fonte da verdade de cor (as CSS vars sob `data-theme`); trocar tema é trocar um atributo,
  sem reflow de classes `dark:`. Tailwind, fontes e o protótipo apontam todos para as mesmas vars.
- Tailwind v4 (config-no-CSS) elimina `tailwind.config.js` e dependências extras (autoprefixer/import);
  menos superfície de manutenção. O custo é seguir as convenções v4 (`@theme inline`, `@import`).
- A escala de spacing nativa do Tailwind já casa com o DS (4pt) — sem retrabalho de escala.
- O `cv.css` vira referência morta (não importado); risco de drift entre protótipo e app — mitigado
  por ele ser explicitamente "referência de protótipo", não fonte de build.
- Nova dependência aumenta o bundle de CSS de build, mas o Tailwind faz tree-shake do CSS não usado.
- Contrato e backend **não mudam** — frontend e backend trabalham em paralelo sem espera mútua.

## Alternativas consideradas

- **Manter inline-styles / CSS Modules:** rejeitado — o dono aprovou Tailwind; inline-styles não
  escalam para o nível de polish da Fatia 4 e duplicam tokens.
- **Importar o `cv.css` como folha global e usar só as classes do protótipo (`.btn`, `.card`…):**
  rejeitado — não é Tailwind (decisão travada), e amarra o app à estrutura interna do protótipo, que
  `docs/fatia-4-design.md` diz para **não** copiar quando não encaixa.
- **Tailwind v3 com `tailwind.config.js`:** rejeitado — v4 é o atual, integra melhor com CSS vars via
  `@theme`, e evita o arquivo de config JS + autoprefixer/postcss-import.
- **`@theme` com valores literais (sem `inline`, hardcode dos hexes):** rejeitado — congelaria a cor
  no utilitário e quebraria a troca light/dark em runtime; perderia a fonte única da verdade.
- **Estratégia `dark:` do Tailwind (classe `dark` / `prefers-color-scheme`):** rejeitada para as cores
  do DS — duplicaria variantes em todo componente e criaria duas fontes da verdade; o `data-theme` +
  CSS vars já resolve o tema de forma transparente.
- **Carregar Geist via `<link>` do Google Fonts (como o protótipo):** rejeitado — `next/font/google`
  self-hospeda, elimina request externo e FOUT, e dá a CSS var pronta para o `@theme`.
- **Expor contagens via novo endpoint/campo (`count`) no servidor:** rejeitado — mudaria o contrato
  congelado; as contagens são triviais de derivar no cliente do payload já existente.
