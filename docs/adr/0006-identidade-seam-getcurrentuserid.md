# 0006 — Identidade via seam `getCurrentUserId()`; autenticação real adiada

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

O MVP é single-user e local; implementar autenticação completa agora seria esforço sem
retorno imediato. Porém o acesso a dados já é por `userId` (ADR-0005) e o produto vai
ganhar autenticação depois. É preciso um ponto único de obtenção da identidade para
encaixar Auth.js mais tarde sem espalhar mudanças.

## Decisão

Resolver a identidade por um **seam único `getCurrentUserId()`**
(`src/server/auth/getCurrentUserId.ts`). No MVP ele retorna `LOCAL_USER_ID` (usuário
semeado). **Autenticação real fica adiada.** Nenhum handler recebe `userId` no request;
todos chamam o seam. Não há `userId` hardcoded espalhado pelo código.

## Consequências

- MVP sem login, mas com acesso a dados já escopado por usuário.
- Adicionar Auth.js depois = implementar o seam (ler a sessão), sem tocar nos call sites.
- Ponto único para testar e para evitar vazamento entre usuários no futuro.
- No MVP, qualquer um com acesso ao app é o usuário local (aceitável: app local).

## Alternativas consideradas

- **Implementar Auth.js já no MVP:** esforço sem valor para um app local single-user.
- **Ler `LOCAL_USER_ID` diretamente em cada handler (sem seam):** rejeitado por espalhar
  a lógica de identidade e dificultar a futura troca para autenticação real.
