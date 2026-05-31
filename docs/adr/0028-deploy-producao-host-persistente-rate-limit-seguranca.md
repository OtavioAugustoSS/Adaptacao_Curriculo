# 0028 — Deploy de produção: host persistente, pooling, rate limit e segurança

- **Status:** Accepted
- **Data:** 2026-05-31
- **Relaciona:** [[0024-autenticacao-real-authjs-oauth-seam-async]] (auth/middleware),
  [[0025-migracao-sqlite-postgres-multiusuario]] (Postgres), [[0023-geracao-rica-timeout-prompts-tailoring]]
  (timeouts da geração)

## Contexto

As Fatias 9–10 deixaram o produto multiusuário e fiel. Agora o dono quer **hospedar para um grupo
fechado (<20 pessoas) testar**, com três exigências: **sem erros**, **seguro**, **sem pesar o servidor**
— cada pessoa vê só os próprios currículos. Faltam medidas de produção que o MVP/dev não tinha.

Restrição técnica que domina a decisão: **a geração (Modo 2) é síncrona e leva ~80–150s** (2 chamadas à
NIM + possível regeneração do guardrail; [[0023-geracao-rica-timeout-prompts-tailoring]]). Isso **briga
com o modelo serverless** (Vercel corta funções: Hobby ~60s, Pro até 300s). Restrição de custo: a **chave
da NIM é compartilhada** entre todos (free tier: ~40 req/min, créditos limitados) — um usuário não pode
estourar a cota de todos.

## Decisão

### 1. Host PERSISTENTE (Render free), não serverless
Rodar o Next.js como **servidor Node sempre-ligado** (Render free web service). A requisição longa da
geração **roda sem o limite de timeout do serverless**. Aceita-se o **spin-down/cold-start** do free tier
(1ª requisição lenta após inatividade) — adequado a um teste fechado. Banco: **Neon free Postgres**
(não expira, ao contrário do Postgres free do Render).

### 2. Pooling de conexão (Neon) — não esgotar o banco
`schema.prisma` ganha **`directUrl = env("DIRECT_URL")`**: o app usa a **`DATABASE_URL` pooled**
(PgBouncer do Neon) e as **migrações** usam a **`DIRECT_URL`** (conexão direta). Evita esgotar conexões
sob concorrência. O `PrismaClient` segue singleton ([[0025-migracao-sqlite-postgres-multiusuario]]).

### 3. Rate limit por usuário — EM MEMÓRIA
Como o host é **um único processo persistente**, um limiter **em memória** (janela deslizante por
`userId`) basta — sem Redis/infra extra. Aplicado nas rotas **caras** (`POST /api/resumes/generate` e
`POST /api/profile/import*`) → **HTTP 429** no envelope de erro padrão quando exceder. Protege a cota da
NIM, o custo e a carga. (Trade-off: o contador zera em restart/redeploy — aceitável nesta escala. Numa
arquitetura multi-instância, trocar por um store compartilhado — Upstash/Redis.)

### 4. Segurança
- **Headers** (`next.config.headers()`): HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`. CSP estrita fica fora por ora (atrito alto com Next/inline).
- **`trustHost: true`** no Auth.js (atrás do proxy do Render) + `AUTH_URL` público por env — sem isso o
  callback OAuth pode falhar.
- **Segredos só em env** (Render); os que foram expostos no chat (NIM, GitHub secret) são **rotacionados**
  antes do deploy. Stack traces **não vazam** em produção (rotas já condicionam `details` a `NODE_ENV !==
  "production"`); o fallback `LOCAL_USER_ID` é **inerte em produção** ([[0024-autenticacao-real-authjs-oauth-seam-async]]).

### 5. Geração SÍNCRONA (sem fila) — para <20
Para o teste fechado, a geração segue **síncrona** (o usuário espera ~80s na tela). **Não** se introduz
fila/background agora (YAGNI nesta escala). Para caber com folga numa requisição síncrona, os timeouts da
geração no `nim.ts` são **revisados** para manter o pior caso bounded. Se o produto crescer/abrir ao
público, a geração assíncrona (job + polling) vira o próximo ADR.

### 6. Health check
`GET /api/health` → 200 (público, fora do middleware de auth): health check do Render e ping
anti-spin-down opcional.

## Consequências
- A geração longa **funciona sem timeout** (a maior fonte potencial de erro em produção some).
- O banco aguenta concorrência sem esgotar conexões; o rate limit protege NIM/custo/carga.
- App mais seguro (headers, segredos rotacionados, sem vazamento).
- **Custo zero** (Render free + Neon free + NIM free) ao preço de **cold-start** e **512MB RAM** (o import
  de PDF grande é o maior consumidor — limite de 8MB ajuda) e dos **limites da NIM free**.
- Sem fila: requisição segura a conexão por ~80s (ok p/ <20; não p/ escala).

## Alternativas consideradas
- **Vercel (serverless):** ótima DX, mas o timeout de função briga com a geração de ~80–150s (precisa Pro +
  `maxDuration`, e o pior caso ainda arrisca). Rejeitado para esta fase — host persistente elimina a classe
  de erro de timeout.
- **Rate limit com Redis/Upstash:** mais robusto (multi-instância), mas é infra/custo extra desnecessário
  para 1 instância persistente e <20 usuários. Em memória basta; documentado o caminho de evolução.
- **Geração assíncrona (fila + polling) já agora:** robusta e a resposta certa para escala, mas é feature
  grande (estado de job, UI de polling) — YAGNI para <20. Deferida.
- **CSP estrita já agora:** alto atrito com Next (inline/styles); os demais headers cobrem o essencial.
