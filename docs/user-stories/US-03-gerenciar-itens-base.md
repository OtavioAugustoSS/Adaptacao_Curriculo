# US-03 — Gerenciar itens da base com ordenação

**Fatia:** 1 — Fundações sem LLM
**Dependências:** US-02 (Profile/`ProfileBundleSchema` e rota `/api/profile`)

## História

**Como** usuário,
**quero** adicionar, editar, remover e reordenar os itens das seções da minha base (experiência, formação, habilidades, projetos, idiomas, cursos) na tela `/perfil`,
**para** manter a fonte da verdade completa e na ordem que eu quiser, pronta para a geração de currículos.

## Descrição

- Implementar as entidades de lista (Prisma): `Experience`, `Education`, `Skill`, `Project`, `Language`, `Course` — todas com `userId`, `profileId`, campos do ERD e `order` para ordenação manual.
- Campos de array (`bullets`, `techStack`) armazenados como JSON (mesma forma em SQLite e Postgres).
- Schemas Zod por entidade: `ExperienceSchema`, `EducationSchema`, `SkillSchema`, `ProjectSchema`, `LanguageSchema`, `CourseSchema` (cada um com `order`), agregados em `ProfileBundleSchema`.
- Estender `GET /api/profile` e `PUT /api/profile` para ler/persistir (upsert) o bundle completo, incluindo todas as listas, respeitando `order`.
- Tela `/perfil`: cada seção é uma lista de itens reordenáveis (adicionar/editar/remover/reordenar), com os mesmos estados da US-02.
- Pré-requisito de produto registrado aqui: Modo 1 exige cabeçalho + pelo menos 1 experiência **ou** formação (consumido pela US-05).

## Referências

- **Spec:** §2.1 (Perfil — todas as seções de lista; reordenação via `order`); §2.2 (pré-requisito de base preenchida).
- **Contrato de API:** `GET`/`PUT /api/profile`; `ExperienceSchema`, `EducationSchema`, `SkillSchema`, `ProjectSchema`, `LanguageSchema`, `CourseSchema`, `ProfileBundleSchema`.
- **ERD:** `Experience`, `Education`, `Skill`, `Project`, `Language`, `Course` (campos, `order`, relações com `Profile`/`User`).
- **Código:** `src/app/(dashboard)/perfil/page.tsx`, `src/app/api/profile/route.ts`, `src/server/data/`, `src/lib/schemas/`, `prisma/schema.prisma`, `prisma/seed.ts` (base de exemplo).
- **Arquitetura:** §4 (entidades de lista, JSON arrays), ADR-0005, ADR-0011.

## Estados envolvidos

- Seção vazia → CTA para adicionar o primeiro item.
- Item em edição / adição / remoção.
- Reordenação (alteração de `order`).
- Salvando, erro de validação (Zod), salvo com sucesso.

## Fora do escopo

- Geração de currículo / chamada ao LLM.
- `JobPosting` (insumo do Modo 2 — US-08).
- Cabeçalho/resumo isolado (já em US-02).

## Pendências

- [DECISÃO PENDENTE] O `PUT /api/profile` faz upsert do bundle inteiro (substitui todas as listas) ou há operações por item? O contrato sugere bundle completo; confirmar a estratégia de diff/remoção de itens ausentes no payload.
- [DECISÃO PENDENTE] Reordenação: o cliente envia `order` recalculado de todos os itens no `PUT`, ou existe interação dedicada? Definir a convenção de reindexação.
