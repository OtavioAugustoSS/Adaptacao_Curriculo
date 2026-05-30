# US-12 — Formação "em andamento"

**Fatia:** 5 — Import por dump (IA) + Formação em andamento
**Dependências:** US-02, US-03 (CRUD do perfil — formulário e lista de Formação); US-01 (renderer determinístico do `.tex`). Depende do **ADR-0018** (campo `Education.current`).

## História

**Como** usuário,
**quero** marcar uma formação como "Cursando / em andamento",
**para** registrar uma faculdade/curso que ainda estou cursando e que o `.tex` gerado mostre "Atual" no período.

## Descrição

- Adicionar o campo `current: boolean` ao `EducationSchema` (`src/lib/schemas/profile.ts`) e ao modelo `Education` do Prisma — **espelhando** o que já existe em `ExperienceSchema.current` ("Emprego atual"). Default `false`.
- Na lista **Formação** do `/perfil`, adicionar um **toggle "Cursando / em andamento"** por item, igual ao "Emprego atual" da Experiência. Quando ligado, **desabilita o campo "Fim"** (reusa o `disabledWhen` que o `ListSection` ganhou na Fatia 4).
- O `current` flui na base serializada que vai ao prompt do LLM. No `.tex` gerado, uma formação com `current = true` mostra **"Atual"** (ou "em andamento") no período — **da mesma forma que a Experiência já faz hoje**. A garantia do texto "Atual" vem do **LLM formatando o `period`** (como em Experience), **não** de uma regra nova no renderer determinístico.
- **Cursos NÃO mudam:** a seção Cursos/Certificações segue com o campo `date` livre (string), que já aceita "Em andamento". Esta US só toca a **Formação**.

## Referências

- **Spec:** §2.1 (Perfil — lista de Formação e seus campos). §3 (geração base→.tex). O comportamento espelha o "Emprego atual" da Experiência já especificado.
- **Contrato de API:** `EducationSchema` ganha `current: boolean` (default `false`) — mudança no contrato congelado registrada por nota datada + **ADR-0018**. Sem rota nova; flui por `GET`/`PUT /api/profile` e por `POST /api/resumes/generate`.
- **ERD:** entidade `Education` ganha `current Boolean @default(false)` (espelha `Experience.current`). Requer migração Prisma.
- **Código:** `src/lib/schemas/profile.ts` (`EducationSchema`), `prisma/schema.prisma` (modelo `Education` + migração), `prisma/seed.ts` (ajustar se semeia formação), `src/server/data/profile-repo.ts` ((de)serialize/upsert de `current`), `src/app/(dashboard)/perfil/page.tsx` (toggle + `disabledWhen` em `EDUCATION_FIELDS`), `src/components/perfil/ListSection.tsx` (conferir `type:"boolean"` + `disabledWhen`), prompts de CV se preciso para formatar "Atual".
- **Arquitetura/ADRs:** **ADR-0018** (campo `Education.current`). ADR-0001/0007 (renderer determinístico — **não** introduz regra nova; o "Atual" vem do `period` formatado pelo LLM, como em Experience).

## Decisões de produto travadas nesta US

1. **"Em andamento" só na Formação.** Cursos seguem com `date` livre (já aceita "Em andamento"). (Decisão do dono, plano da Fatia 5.)
2. **Espelha "Emprego atual" da Experiência.** Mesmo padrão de toggle + "Fim" desabilitado, para consistência da UI e da base.
3. **"Atual" no `.tex` vem do LLM formatando o `period`**, igual à Experiência. Sem nova lógica no renderer determinístico.

## Critérios de aceite (por estado)

### Toggle na Formação (UI)
- **Dado** um item de Formação no `/perfil`, **quando** abro o card de edição, **então** vejo um toggle **"Cursando / em andamento"** (mesmo padrão do "Emprego atual" da Experiência).
- **Dado** o toggle **ligado**, **quando** ele é marcado, **então** o campo **"Fim"** fica **desabilitado** (não editável) — via `disabledWhen`, como na Experiência.
- **Dado** o toggle **desligado**, **então** o campo "Fim" volta a ser editável.

### Persistência (base)
- **Dado** uma formação marcada como "em andamento", **quando** clico em **Salvar** (`PUT /api/profile`), **então** `current = true` é persistido; ao recarregar o `/perfil`, o toggle continua ligado e o "Fim" desabilitado.
- **Dado** uma formação não marcada, **então** `current = false` (default) é persistido — comportamento atual inalterado.

### Renderização (.tex)
- **Dado** uma formação com `current = true` na base, **quando** gero um currículo (Modo 1 ou Modo 2), **então** o `.tex` mostra **"Atual"** (ou "em andamento") no período daquela formação — análogo à Experiência atual.
- **Dado** uma formação com `endDate` preenchido e `current = false`, **então** o período mostra a data de fim normalmente (sem "Atual").

### Cursos inalterados
- **Dado** a seção Cursos/Certificações, **então** **não** há toggle "em andamento" — o campo `date` continua livre e já aceita texto como "Em andamento".

## Estados envolvidos

- **Toggle desligado (default):** "Fim" editável; `.tex` mostra a data de fim.
- **Toggle ligado:** "Fim" desabilitado; `.tex` mostra "Atual".
- **Persistido:** `current` round-trip via `GET`/`PUT /api/profile`.

## Fora do escopo

- "Em andamento" na seção **Cursos** (segue com `date` livre).
- Validação de coerência entre `current` e `endDate` (se o usuário preencher ambos, prevalece o comportamento espelhado da Experiência — não inventar regra nova nesta US).
- Mudar a lógica do renderer determinístico ou o guardrail de geração.
- Cálculo de duração/semestres da formação.

## Pendências

- [DECISÃO PENDENTE — RESOLVIDA] **Onde marcar "em andamento"?** → Só na **Formação** (Cursos seguem com `date` livre). Decisão do dono no plano da Fatia 5.
- [DECISÃO PENDENTE] **Rótulo exato no `.tex`:** "Atual" (como na Experiência hoje) ou "em andamento"? **Sugestão:** manter **"Atual"** para consistência com a Experiência já renderizada. Confirmar com o architect/dono ao fechar o prompt.
