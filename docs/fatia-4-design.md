# Fatia 4 — Brief de Design (polimento visual)

> Documento **committável** de handoff de design para a Fatia 4. Entrada para o Agent Team
> (`cv-adapter-development-team`, composição estendida de 6 papéis). Escrito após o design ser
> aprovado pelo dono. Atualizado: 2026-05-30.

## Origem do design

Design produzido na ferramenta **Claude Design** (claude.ai/design) ao longo de **3 rodadas**
(design system → Casca+Gerar → ajustes+telas restantes), com handoff "Send to Claude Code".
Direção visual: **dev-tool moderno** (referências Linear / Vercel / Raycast).

- **Reference impl (versionado):** `docs/design/claude-design/` — React JSX + `app/cv.css`
  (tokens + componentes) + screenshots por tela + `CV-Adapter Design System.html`.
- **Bundles brutos (locais, gitignored):** `design-ref/v1..v3/` + prompts em `design-ref/*.md`.

O reference impl é **protótipo** (HTML/CSS/JS). A Fatia 4 o **recria** no app Next.js real,
casando o visual; não copia a estrutura interna do protótipo quando ela não encaixa.

## Decisões travadas (com o dono)

1. **Estilização: Tailwind CSS** (dependência nova, aprovada pelo dono). → **ADR do architect
   (ADR-0017)** antes de codar: setup Tailwind no Next 15 + mapeamento dos tokens do DS
   (`cv.css` `:root` / `[data-theme]`) para o theme do Tailwind. **Contrato Zod congelado intacto.**
2. **Direção:** dev-tool moderno. Fonte **Geist + Geist Mono**. Acento azul **#2f63ff** (light) /
   **#4f7cff** (dark) — refino do `#1a5cff` original. **Light + dark** obrigatórios.
3. **Escopo:** casca/shell (sidebar + nav + toggle de tema + drawer mobile) + **Home** + **Perfil**
   + **Gerar** + **Currículos**.
4. **Currículos:** título do card = **rótulo do modo** ("Currículo adaptado à vaga" / "Currículo
   padrão") + data + nome do arquivo. **NÃO** exibir título/empresa da vaga — **ADR-0016 mantido**,
   sem mudança de contrato.
5. **Execução:** Agent Team de **6 papéis** (lead + PO + architect + frontend-agent +
   backend-agent + qa-agent), conforme `docs/agent-team.md` (composição estendida da Fatia 4).

## Design system — tokens (canônico em `docs/design/claude-design/app/cv.css`)

- **Raio:** 6 / 8 / 10 / 14 / 18 / 999. **Spacing:** base 4pt (4…64).
- **Fontes:** Geist (UI), Geist Mono (.tex, metadados, números).
- **Dark:** canvas `#0b0d11`, surface `#14171d`, surface-2 `#1b1f27`, border `#262b34`,
  fg `#f2f5f9`, fg-muted `#98a1b0`, accent `#4f7cff`.
- **Light:** canvas `#f6f7f9`, surface `#fff`, border `#e7e9ee`, fg `#13161c`,
  fg-muted `#5a626f`, accent `#2f63ff`.
- **Semânticos:** success / warning (→ avisos de rastreabilidade) / danger / accent (→ modo Adaptado).
- **Componentes:** button (primary/secondary/ghost/danger · sm/md/lg · icon · disabled),
  input+field (label/req/help/erro), badge, tabs (segmentada + sublinhada), card, bloco de código
  `.tex`, note/callout (accent/warning/danger/success), skeleton, spinner.

## Telas + estados (reference: `docs/design/claude-design/app/*.jsx`)

- **Casca (`shell.jsx`):** sidebar 240px (brand, nav Início/Perfil/Gerar/Currículos com `nav-sub`
  de contagem, ativo = `surface-2` + acento + barra 3px), toggle de tema no rodapé, drawer mobile
  (<820px) com scrim. `aria-current`.
- **Home (`home.jsx`):** saudação + chips de status da base (derivados) + 3 atalhos. Estado base vazia.
- **Perfil (`perfil.jsx`):** cabeçalho + 6 listas (add/editar/remover/reordenar, toggle, bullets),
  barra de salvar fixa. Estados: carregando/pronto/vazio/salvando/salvo/erro por campo.
- **Gerar (`gerar.jsx`):** tabs Padrão/Adaptar, textarea da vaga, botão, **estados**
  validando/ocioso/gerando/erro/preview; preview = Copiar("Copiado!")/Baixar + avisos numerados +
  bloco `.tex`.
- **Currículos (`curriculos.jsx`):** lista de cards (badge de modo, data, meta faangpath, avisos
  expansíveis), vazio/erro/loading.

## Fronteira de ownership (split front/back — `docs/agent-team.md`)

- **frontend-agent:** `src/components/` + apresentação de `src/app/**/page.tsx`. Porta o shell + 5
  telas do reference impl para Tailwind. Consome os schemas Zod **read-only**. Usa skills de design
  (`frontend-design`/`ui-ux-pro-max`/`impeccable`) no polish.
- **backend-agent:** `src/server/`, `src/app/api/`, `prisma/`, `src/lib/schemas/`. Mantém o
  **contrato congelado**. Os dados novos que a UI pede (contagem de itens p/ `nav-sub` e chips da
  Home) são **deriváveis** de `GET /api/profile` e `GET /api/resumes` no cliente — **sem mudança de
  contrato**.

## Notas de fidelidade (corrigir na implementação — NÃO são defeitos do design)

- **Preview `.tex`** vem do renderer real `src/server/resume/render-latex.ts` (texOutput cacheado
  via `GET /api/resumes/[id]/download`), **nunca** de um `buildTex` JS (o do protótipo é mock).
- **Avisos de rastreabilidade:** o breadcrumb `campo` do protótipo é mais rico que o nosso
  `Issue = { field, value, reason }`. Renderizar `field` como vier (**contrato intacto**). Mostrar
  avisos quando `traceabilityReport.warnings.length > 0` em **qualquer modo** (Modo 1 também pode);
  `errors` **nunca** aparecem aqui (disparam regeneração).
- **Remover** o `.demobar` ("Estados") — é andaime de protótipo; no app os estados são runtime.
- **Manter** os ganhos de a11y já no reference: nav ativa com barra de acento, `help`/placeholder
  em `--fg-muted`, `prefers-reduced-motion`, feedback "Copiado!".

## Verificação obrigatória (lead, à mão — Agent Teams é experimental)

`tsc --noEmit` limpo · `npm test` **sem regredir os 147** · `npm run build` OK.
Gotcha Windows: se `next build` der ENOENT de manifest, apagar `.next` e rebuildar.
O dono faz os commits (propor, não commitar). Não instalar dep além do Tailwind sem confirmar.

## Próximo passo

Recriar o time via `TeamCreate` (morre no `/clear` e no resume). O **architect** escreve o
**ADR-0017** (Tailwind + mapeamento de tokens) **antes** de qualquer código.
