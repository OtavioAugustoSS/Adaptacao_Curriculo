# US-17 — Currículo padrão: definir, basear a adaptação e destacar

**Fatia:** 8 — Currículo padrão + seleção na geração + adaptação mais rica
**Dependências:** US-05 (geração → `GeneratedResume`), US-08 (Modo 2 adaptativo), US-09/US-15 (histórico `/curriculos`). Depende do **ADR-0022** (`isDefault` + adaptação ancorada em referência de profundidade).

## História

**Como** usuário,
**quero** marcar um currículo como **padrão**, vê-lo **destacado** e **selecioná-lo como base** quando adapto à vaga,
**para** que a adaptação parta de um currículo completo (e não re-derive do zero) e eu reconheça de relance qual é o padrão e qual está em uso.

## Descrição

### Definir o currículo padrão
- Em `/curriculos`, cada card não-padrão ganha a ação **"Definir como padrão"** → `PATCH /api/resumes/[id]` com `{ isDefault: true }`. No máximo **um** padrão por usuário (o anterior é desmarcado na escrita).
- O **primeiro** currículo gerado vira padrão automaticamente (garante "pelo menos um padrão"; ADR-0022 §1).

### Destaque visual (padrão + em uso)
- O card do currículo **padrão** aparece com **badge "★ Padrão"** e tratamento de destaque (borda/acento — `.cv-item.is-default`). No card já-padrão, mostra o **estado** em vez do botão.
- Em `/gerar` (Modo 2), o currículo **selecionado como base** aparece destacado como **"em uso"**.

### Selecionar a base na geração
- Em `/gerar`, no **Modo 2**, um seletor **"Basear no currículo padrão"** lista os currículos **STANDARD** do usuário, com o **padrão pré-selecionado** (ou o STANDARD mais recente). A seleção vai no `POST /api/resumes/generate` como **`baseResumeId`**.
- Sem nenhum STANDARD: hint "Gere primeiro um Currículo padrão (Modo 1) para servir de base" e **fallback** = comportamento atual (deriva só da base).

## Referências

- **Contrato:** ADITIVO (ADR-0022): `GeneratedResumeSchema.isDefault: boolean`; `PATCH /api/resumes/[id]` aceita `{ name?, isDefault?: true }`; `GenerateRequestSchema.baseResumeId?: string`. `GET /api/resumes` devolve `isDefault`.
- **Código:** `prisma/schema.prisma` (`isDefault` + migração/backfill), `src/lib/schemas/generate.ts`, `src/server/data/resume-repo.ts` (`setDefaultResume`/`getDefaultResume`/auto-default + mapping), `src/app/api/resumes/[id]/route.ts` (PATCH `isDefault`), `src/app/api/resumes/generate/route.ts` (`baseResumeId`), `src/app/(dashboard)/gerar/page.tsx` (seletor + destaque "em uso"), `src/app/(dashboard)/curriculos/page.tsx` (badge ★ + "Definir como padrão"), `src/app/globals.css`.
- **Arquitetura/ADRs:** **ADR-0022**; ADR-0011 (contrato — nota datada); ADR-0006 (identidade).
- **Testes:** `resume-repo` (setDefault zera os outros/escopo userId/404; getDefault fallback; auto-default quando zero); `schemas` (`isDefault`, `baseResumeId`); rota PATCH (`isDefault` → setDefault); rota generate (carrega `baseResumeId`).

## Critérios de aceite

- **Dado** um card não-padrão, **quando** clico "Definir como padrão", **então** ele vira o padrão (badge ★) e o anterior deixa de ser.
- **Dado** que nunca defini padrão, **então** o **primeiro** currículo gerado já aparece como padrão.
- **Dado** o Modo 2, **então** vejo o seletor com o padrão **pré-selecionado** e, ao gerar, a base escolhida vai como `baseResumeId`.
- **Dado** que não tenho STANDARD, **então** vejo o hint e a geração ainda funciona (fallback).
- **Dado** id alheio/inexistente no PATCH `isDefault`, **então** **404** e nenhum padrão é alterado.

## Fora do escopo

- Editar o conteúdo do currículo base (só seleção/realce).
- Constraint única de banco para `isDefault` (garantido na escrita; ver ADR-0022).
- Basear o **Modo 1** num currículo (o Modo 1 é como se cria o padrão a partir da base).
