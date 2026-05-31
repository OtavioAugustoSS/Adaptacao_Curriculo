# Deploy — Forja de Currículo (Render + Neon, teste fechado)

Guia para hospedar de graça num **host persistente** (Render) + **Postgres gerenciado** (Neon).
Decisões em `docs/adr/0028-deploy-producao-host-persistente-rate-limit-seguranca.md`.

## Pré-requisitos
- Repositório no GitHub com a branch `main` (já está).
- Contas: **Neon** (neon.tech), **Render** (render.com), **NVIDIA NIM** (build.nvidia.com), e o
  **app OAuth do GitHub** (já criado para o dev).

## 1) Rotacionar segredos (importante — alguns foram expostos durante o desenvolvimento)
- **NIM:** gere uma **nova chave** em build.nvidia.com (revogue a antiga).
- **GitHub OAuth:** no app OAuth, **gere um novo client secret** (revogue o antigo).
- **AUTH_SECRET:** gere um novo: `npx auth secret` (ou `openssl rand -base64 33`).
- Esses valores vão **só nas env vars do Render** — nunca no código/git.

## 2) Banco — Neon (produção)
1. Crie um projeto no Neon (região mais perto dos usuários).
2. Copie **duas** connection strings:
   - **`DATABASE_URL`** = a **pooled** (tem `-pooler` no host, ou a opção "Pooled connection").
   - **`DIRECT_URL`** = a **direct** (sem pooler). Usada só pelas migrações.
   Ambas terminam com `?sslmode=require`.

## 3) GitHub OAuth — produção
No app OAuth (github.com/settings/developers), adicione/garanta:
- **Homepage URL:** a URL do Render (ex.: `https://forja-curriculo.onrender.com`).
- **Authorization callback URL:** `https://forja-curriculo.onrender.com/api/auth/callback/github`.
  (Pode manter o callback de localhost também, pro dev.)

## 4) Render — Web Service
1. **New → Web Service** → conecte o repositório GitHub → branch `main`.
2. **Runtime:** Node. **Region:** a mesma do Neon.
3. **Build Command:**
   ```
   npm install && npx prisma migrate deploy && npm run build
   ```
4. **Start Command:**
   ```
   npm run start
   ```
5. **Health Check Path:** `/api/health`
6. **Environment Variables** (Add):
   - `DATABASE_URL` = pooled do Neon
   - `DIRECT_URL` = direct do Neon
   - `AUTH_SECRET` = o gerado no passo 1
   - `AUTH_URL` = a URL pública do Render (ex.: `https://forja-curriculo.onrender.com`)
   - `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` = do app OAuth (secret rotacionado)
   - `LLM_BASE_URL` = `https://integrate.api.nvidia.com/v1`
   - `LLM_API_KEY` = a **nova** chave `nvapi-...`
   - `MODEL_ID` = `meta/llama-3.3-70b-instruct`
   - `NODE_ENV` = `production`
   - *(Google OAuth é opcional; deixe sem `AUTH_GOOGLE_*` que o botão fica inerte.)*
7. **Create Web Service.** O primeiro deploy roda o `prisma migrate deploy` (cria as tabelas no Neon)
   e o `next build`.

## 5) Verificar (em produção)
- Abrir a URL → cai no `/login`. Entrar com GitHub → volta logado.
- **Isolamento:** logar com **2 contas** → cada uma vê só a própria base/currículos.
- **Geração e2e:** colar uma vaga e gerar → completa (sem timeout) e o `.tex` aparece.
- **Health:** `GET /api/health` → `{"ok":true}`.
- **Headers:** `curl -I https://<app>` mostra `Strict-Transport-Security`, `X-Frame-Options: DENY`, etc.
- **Rate limit:** mais de 5 gerações em 5min pelo mesmo usuário → `429` (mensagem amigável).

## Notas / limites (free tier)
- **Cold start:** o Render free **dorme após ~15min** de inatividade → a 1ª requisição demora ~30-60s.
  Se incomodar, configure um ping periódico em `/api/health` (ex.: cron-job.org) ou suba pro tier pago.
- **512MB RAM:** suficiente; o maior consumidor é o import de PDF grande (limite de 8MB).
- **NIM free:** ~40 req/min + créditos limitados na chave compartilhada. O **rate limit por usuário**
  (5 gerações / 5min) segura. Cada geração = 2-3 chamadas à NIM. Se esgotar, é plano NIM pago.
- **Postgres do Render é free por 90 dias** — por isso usamos **Neon** (não expira).
