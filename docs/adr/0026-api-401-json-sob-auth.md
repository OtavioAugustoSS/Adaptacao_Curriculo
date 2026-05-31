# 0026 — Rotas de API retornam 401 JSON sob autenticação (não redirecionam)

- **Status:** Accepted
- **Data:** 2026-05-31
- **Refina:** [[0024-autenticacao-real-authjs-oauth-seam-async]] (§4, proteção de rotas via middleware)

## Contexto

A Fatia 9 ([[0024-autenticacao-real-authjs-oauth-seam-async]]) protegeu as rotas com um middleware que
usa o callback `authorized` do Auth.js. Esse callback, ao reprovar, faz **uma única coisa**:
**redireciona** a requisição para `/login` (HTTP 307, corpo HTML). Isso vale para **todas** as rotas,
inclusive as de **API** (`/api/*`).

Isso quebrou um comportamento real: o layout do dashboard (`src/app/(dashboard)/layout.tsx`) é um
client component que faz `fetch("/api/profile")` e `fetch("/api/resumes")` para derivar as **contagens
da sidebar** (itens da base e nº de currículos). Quando a resposta é um **307 → /login (HTML)**, o
`fetch` segue o redirect e o `res.json()` **estoura** (HTML não é JSON) → o `catch` zera o contador →
**as contagens somem**. Confirmado por `curl` (sem sessão, `/api/profile` → `307 → /login`).

Conceitualmente: uma rota de **API** não deve responder uma **página de login em HTML** a um cliente
que espera JSON. O contrato de erro do projeto já define um envelope `{ error: { code, message } }`
com status apropriado (401 para não-autenticado).

## Decisão

O middleware passa a **diferenciar API de página**, implementado como **função explícita** (em vez do
callback `authorized`), mantendo a `authConfig` Edge-safe (sem Prisma):

- **Autenticado:** segue.
- **`/login`:** segue (público).
- **`/api/*` sem sessão:** responde **`401` com JSON** no envelope padrão
  `{ error: { code: "UNAUTHENTICATED", message } }` — **não** redireciona.
- **Página sem sessão:** **redireciona** para `/login` (comportamento anterior, correto para navegação).

O callback `authorized` sai do `auth.config.ts` (a decisão de acesso vive agora no middleware). A
proteção em si **não enfraquece** — o seam `getCurrentUserId()` continua barrando no acesso a dados
(401), e o middleware segue cortando na borda; só muda a **forma da resposta** para `/api/*`.

## Consequências

- O `fetch` client recebe uma resposta **parseável** (JSON 401) em vez de HTML — as contagens da
  sidebar voltam a funcionar e a UI pode tratar 401 de forma graciosa.
- Respostas de API ficam **consistentes com o envelope de erro** do projeto (mesma forma de 400/404/422/502).
- Navegação por página continua com o redirect amigável para `/login`.
- O middleware vira uma função (um pouco mais de código que o callback declarativo), porém mais claro e
  correto.

## Alternativas consideradas

- **Manter o redirect para tudo e tratar HTML no cliente:** rejeitado — frágil (depende de inspecionar
  `res.redirected`/conteúdo) e semanticamente errado para uma API.
- **Excluir `/api/*` do matcher do middleware:** rejeitado — deixaria as rotas de API sem corte na
  borda; o seam barraria no acesso a dados, mas perderíamos a defesa em profundidade e a resposta 401
  precoce.
- **Não proteger `/api/*` no middleware e responder 401 só no handler:** equivalente em segurança (o
  seam lança), mas exigiria mapear `UnauthenticatedError → 401` em cada rota; a checagem central no
  middleware é mais simples e uniforme.
