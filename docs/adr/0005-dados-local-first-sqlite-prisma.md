# 0005 — Dados local-first (SQLite/Prisma) migráveis para Postgres; `userId` em tudo

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

O MVP roda local e single-user; não há necessidade de um servidor de banco dedicado.
Mas o produto pretende migrar para multiusuário (Postgres na nuvem). A migração não pode
exigir reescrever queries nem o schema. O risco clássico é "adicionar `userId` depois" e
ter que retrabalhar todo o acesso a dados.

## Decisão

Usar **Prisma ORM** com **SQLite** no MVP, **migrável para Postgres** trocando o
`provider` do datasource + `DATABASE_URL`, sem reescrever queries. **Toda entidade de
domínio carrega `userId` desde o início**. Campos de lista (`bullets`, `techStack`, etc.)
são JSON, com o mesmo formato em SQLite e Postgres.

## Consequências

- Setup local trivial (arquivo SQLite), sem servidor de banco no MVP.
- Migração para Postgres é troca de provider/URL + migration, sem mexer em queries.
- `userId` presente desde já elimina o retrabalho de multi-tenant; combina com o seam
  `getCurrentUserId()` (ADR-0006).
- Recursos específicos de Postgres ficam fora de uso enquanto o alvo for SQLite (denominador comum).

## Alternativas consideradas

- **Drizzle ORM:** ORM válido, porém o time prefere a maturidade de migrations e o
  tooling do Prisma para este projeto.
- **Adicionar `userId` só na fase multiusuário:** rejeitado por gerar retrabalho em todo
  o acesso a dados e risco de vazamento entre usuários no futuro.
- **Postgres já no MVP:** infraestrutura desnecessária para um app local single-user.
