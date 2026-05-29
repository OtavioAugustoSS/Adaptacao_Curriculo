# US-02 — CRUD do Perfil (cabeçalho + resumo)

**Fatia:** 1 — Fundações sem LLM
**Dependências:** nenhuma (pode andar em paralelo com US-01)

## História

**Como** usuário,
**quero** editar e salvar o cabeçalho e o resumo/objetivo da minha base de dados na tela `/perfil`,
**para** ter a fonte da verdade dos meus dados pessoais que alimentará a geração dos currículos.

## Descrição

- Implementar a entidade `Profile` (Prisma) com os campos do ERD: `fullName`, `phone`, `location`, `email`, `linkedin?`, `github?`, `website?`, `summary`, `updatedAt`, ligada a `userId` (1:1 com `User` no MVP).
- Implementar `ProfileSchema` (Zod) como contrato canônico de cabeçalho + resumo.
- Rota `GET /api/profile` — lê a base completa do usuário atual (response `ProfileBundleSchema`; nesta US apenas o bloco `Profile` precisa estar populado, as listas podem vir vazias).
- Rota `PUT /api/profile` — cria/atualiza (upsert) o `Profile` do usuário atual; valida com Zod e retorna `ProfileBundleSchema`.
- Tela `/perfil`: seção de cabeçalho/resumo com formulário editável (campos opcionais marcados como tais), com estados de carregamento, salvando, erro de validação e salvo com sucesso.
- Acesso a dados sempre via `getCurrentUserId()` — sem `userId` no request.

## Referências

- **Spec:** §2.1 (Perfil — bloco Cabeçalho/Resumo); estados: vazio, preenchido, salvando, erro de validação, salvo.
- **Contrato de API:** `GET /api/profile`, `PUT /api/profile`; `ProfileSchema`, `ProfileBundleSchema`; envelope de erro `{ error: { code, message, details? } }`.
- **ERD:** `Profile` (campos e relação 1:1 com `User`).
- **Código:** `src/app/(dashboard)/perfil/page.tsx`, `src/app/api/profile/route.ts`, `src/server/data/` (repositório de profile), `src/server/auth/getCurrentUserId.ts`, `src/lib/schemas/` (`ProfileSchema`, `ProfileBundleSchema`).
- **Arquitetura:** §4 (Profile 1:1), §5 (identidade via seam), ADR-0005, ADR-0006, ADR-0011.

## Estados envolvidos

- Vazio (sem `Profile` ainda) → CTA para começar a preencher.
- Preenchido.
- Salvando.
- Erro de validação (Zod) → 400 com `details`.
- Salvo com sucesso.

## Fora do escopo

- Itens de lista da base (experiência, formação, etc.) — US-03.
- Autenticação real (seam `getCurrentUserId()` retorna `LOCAL_USER_ID`).
- Geração/preview de currículo.

## Pendências

- [DECISÃO PENDENTE] `PUT /api/profile` recebe `ProfileBundleSchema` completo (cabeçalho + todas as listas) segundo o contrato. Confirmar se nesta US o `PUT` deve aceitar bundle parcial (só cabeçalho) ou se US-02 e US-03 compartilham o mesmo handler `PUT` que persiste tudo de uma vez.
