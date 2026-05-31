# 0024 — Autenticação real (Auth.js / OAuth) e seam de identidade assíncrono

- **Status:** Accepted
- **Data:** 2026-05-31
- **Supersede:** [[0006-identidade-seam-getcurrentuserid]] (a parte "autenticação real fica adiada";
  o **padrão de seam** daquele ADR é mantido e agora implementado de verdade)
- **Relaciona:** [[0005-dados-local-first-sqlite-prisma]] (multi-tenant por `userId`),
  [[0025-migracao-sqlite-postgres-multiusuario]] (banco para deploy público)

## Contexto

O MVP era single-user local: `getCurrentUserId()` devolvia um `LOCAL_USER_ID` fixo
([[0006-identidade-seam-getcurrentuserid]]) e não havia login. O dono agora quer **compartilhar o
produto com outras pessoas para testarem por si mesmas**, numa URL pública. Isso exige
**autenticação real** e **isolamento por usuário**.

O terreno já estava preparado: o acesso a dados é **sempre por `userId`** ([[0005-dados-local-first-sqlite-prisma]])
e passa por um **ponto único** — o seam `getCurrentUserId()`. Era exatamente esse o motivo do seam:
ligar autenticação depois **sem espalhar mudanças** pelos call sites. Hoje o seam é chamado em ~11
lugares, **todos dentro de funções `async`** dos repositórios (`resume-repo`, `profile-repo`,
`job-repo`); as rotas não o chamam diretamente.

Restrição de produto: o login não pode introduzir gerência de senha/reset/verificação de e-mail
para uma fase de teste com conhecidos — atrito alto e superfície de segurança maior sem valor agora.

## Decisão

### 1. Auth.js (NextAuth v5) com OAuth Google/GitHub
Adotar **Auth.js (NextAuth v5)** no App Router como provedor de autenticação, com **OAuth
Google e GitHub** (sem senha local nesta fase). Persistência de sessão/contas via
**`@auth/prisma-adapter`** (modelos `Account`/`Session`/`VerificationToken` — ver
[[0025-migracao-sqlite-postgres-multiusuario]]). Configuração central em `src/auth.ts`;
handler em `src/app/api/auth/[...nextauth]/route.ts`. Segredos por env
(`AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_GITHUB_ID/SECRET`), mesmo padrão das envs da LLM.

### 2. Seam de identidade assíncrono (refina o ADR-0006, mantém o padrão)
`getCurrentUserId()` passa de **síncrono retornando `LOCAL_USER_ID`** para
**`async function getCurrentUserId(): Promise<string>`** que lê a sessão (`await auth()`) e
devolve `session.user.id`. Se não houver sessão, **lança** um erro tipado de não-autenticado
(`UnauthenticatedError`) — mapeável a **401** nas rotas. **O padrão do seam não muda:** continua o
**ponto único** de identidade; nenhum handler recebe `userId` no request; os call sites só ganham
`await`.

### 3. Fallback de teste/dev controlado por ambiente
Fora de produção (`NODE_ENV !== "production"`) e **somente** quando `LOCAL_USER_ID` estiver
definido, o seam pode devolver esse id como **fallback** (sessão ausente). Isso preserva os testes
atuais e o fluxo de desenvolvimento sem mockar auth em todo lugar. **Em produção o fallback é
inerte** — sem sessão, lança 401. (Decisão de teste: os testes de repositório que dependem de
identidade usam esse fallback OU `vi.mock` do seam; padroniza-se o fallback por ser menos invasivo.)

### 4. Proteção de rotas via middleware
`middleware.ts` exige sessão para `/perfil`, `/gerar`, `/curriculos` e `/api/*` — **exceto**
`/api/auth/*` (o próprio fluxo OAuth) e as rotas públicas (`/`, login). Defesa em profundidade: o
seam já barra no acesso a dados (401); o middleware corta antes, na borda.

### 5. UI mínima
Botão **"Entrar com Google/GitHub"** e **"Sair"** no shell existente (`src/app/layout.tsx`/header);
estado de não-autenticado. **Sem telas de cadastro** — o OAuth cuida do provisionamento do usuário
(o adapter cria o `User` no primeiro login).

### O que NÃO muda
- O **modelo de acesso a dados** (sempre por `userId`, sempre via seam) — [[0005-dados-local-first-sqlite-prisma]].
- O **invariante anti-alucinação**, o guardrail, o `ResumeContentSchema`, o renderer e os contratos
  de geração/import: **intactos**. Esta é uma mudança de **identidade/transporte**, não de domínio.

## Consequências

- O produto deixa de ser single-user: cada pessoa entra com a própria conta e **vê apenas os
  próprios dados** (isolamento já garantido pelo `userId` em toda query).
- **Ripple mínimo**: ~11 call sites ganham `await`; nenhum recebe `userId`. O seam continua o único
  ponto a tocar se trocarmos o provedor de auth de novo.
- Surge a necessidade de **persistir contas/sessões** → modelos do adapter e **Postgres**
  ([[0025-migracao-sqlite-postgres-multiusuario]]).
- A base de teste atual do dono (sob `LOCAL_USER_ID`) **não migra automaticamente** para a conta
  OAuth: aceitável (re-importar é trivial e o dado é descartável).
- Novo código exige segredos OAuth (Google/GitHub) por ambiente — documentado em `fatia-9.md`.

## Alternativas consideradas

- **E-mail + senha (credenciais):** rejeitado nesta fase — exige hash, "esqueci a senha" e
  verificação de e-mail; atrito e superfície de segurança sem valor para um teste fechado.
- **Magic link por e-mail:** bom UX, mas exige provedor de e-mail (SMTP/serviço) configurado; adiado.
- **Código de convite simples (sem OAuth):** mais leve, porém menos seguro e sem identidade real
  (e-mail/nome/foto) — pior para um produto que vai além do teste fechado.
- **Manter o seam síncrono e ler a sessão de outra forma:** inviável — a leitura de sessão do Auth.js
  no App Router é assíncrona; forçar sincronia traria gambiarra. O custo de `async` é só `await`.
- **Receber `userId` nas rotas:** rejeitado (de novo, como no ADR-0006) — espalha identidade e
  reabre risco de vazamento entre usuários.
