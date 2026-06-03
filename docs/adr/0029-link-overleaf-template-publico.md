# 0029 — "Abrir no Overleaf" aponta para o template público (env-configurável)

- **Status:** Accepted
- **Data:** 2026-06-03
- **Refina:** [[0002-saida-somente-tex-overleaf]] (saída só `.tex`; compilação no Overleaf)

## Contexto

Desde a Fatia 7 (WS2) o botão **"Abrir no Overleaf"** (`/gerar` e `/curriculos`) é um link fixo em
`src/lib/overleaf.ts`:

```
OVERLEAF_PROJECT_URL = "https://www.overleaf.com/project/6a1b7884ee1222c3e7a18a19"
```

Isso é a URL de um **projeto privado do dono**. No MVP single-user funcionava (era a conta dele). Com o
sistema **multiusuário em produção** (Fatias 9–11), **outros usuários não têm permissão nesse projeto** →
ao clicar, o Overleaf responde "você não tem permissão para carregar esta página". O link está errado para
todo mundo que não seja o dono.

O `.tex` que geramos começa com `\documentclass{resume}` e **depende do `resume.cls`** do template
faangpath (ver `templates/faangpath/resume.cls.txt`). O `resume.cls` **vive dentro do template** — não o
hospedamos, não o redistribuímos (licença própria do template) e o sistema **não compila LaTeX**
([[0002-saida-somente-tex-overleaf]]). Logo, o destino correto do botão é a **página pública do template**,
de onde qualquer usuário cria a própria cópia (já com o `resume.cls`) e cola o `.tex` gerado.

## Decisão

### 1. Apontar para o template público faangpath
`src/lib/overleaf.ts` passa a expor o **link público do template** (já documentado no README e no
`resume.cls.txt`):

```
https://www.overleaf.com/latex/templates/faangpath-simple-template/npsfpdqnxmbc
```

### 2. Configurável por env, com fallback
A URL passa a ser lida de **`process.env.NEXT_PUBLIC_OVERLEAF_TEMPLATE_URL`** (prefixo `NEXT_PUBLIC_`
obrigatório: `overleaf.ts` é importado por componentes client), com o link do template acima como
**fallback**. Assim trocar o template no futuro não exige caçar string nem novo deploy de código.

O export é **renomeado** `OVERLEAF_PROJECT_URL → OVERLEAF_TEMPLATE_URL` (semântica correta: é um template,
não um projeto). Os dois import sites (`/gerar`, `/curriculos`) acompanham.

### 3. Ajuda de fluxo na UI
Como o sistema não compila LaTeX, ao lado do botão fica uma linha curta explicando o caminho:
**abrir o template → "Abrir como modelo" (Open as Template) → colar o `.tex` no `main.tex`**. Reforça o
modelo mental "copie/baixe o `.tex` → cole no template".

## Consequências
- **Corrige o bug para todos os usuários:** qualquer um abre a página pública e clona o template (com o
  `resume.cls`), sem erro de permissão.
- Mudança mínima e isolada (uma constante + 2 import sites + um texto de ajuda). Sem mudança de schema,
  rota, domínio ou invariante.
- O fluxo continua sendo **2 passos manuais** (clonar template, colar `.tex`) — aceito; ver alternativa
  abaixo.
- Nova env **opcional** (`NEXT_PUBLIC_OVERLEAF_TEMPLATE_URL`); documentar no `DEPLOY.md`/`.env.example`.

## Alternativas consideradas
- **One-click "Abrir no Overleaf" com o `.tex` pré-carregado** (API `snip`/`snip_uri` do Overleaf):
  rejeitado. `snip`/`snip_uri` cria projeto de **arquivo único**, **sem o `resume.cls`** → o `.tex` **não
  compila**. A única forma robusta seria `snip_uri` apontando para um **zip público** (`main.tex` +
  `resume.cls`) numa URL **sem auth** — mas (a) não temos/redistribuímos o `resume.cls` (licença do
  template) e (b) nosso `/download` é protegido por sessão. Complexidade e risco de licença altos para o
  benefício; fora de escopo.
- **Manter o link de projeto, mas tornar o projeto público:** rejeitado — vincularia todos os usuários a um
  único projeto do dono (e edições compartilhadas). O template público é o destino natural e isolado.
- **Hospedar nosso próprio template/projeto compartilhável:** rejeitado no MVP — sem ganho sobre o template
  público oficial faangpath, que já traz o `resume.cls` correto.
