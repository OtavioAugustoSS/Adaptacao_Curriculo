# US-01 — Renderer determinístico: ResumeContent → .tex (faangpath)

**Fatia:** 1 — Fundações sem LLM
**Dependências:** nenhuma (raiz da Fatia 1)

## História

**Como** desenvolvedor do CV-Adapter,
**quero** um renderer determinístico que monte o `.tex` do template faangpath a partir de um `ResumeContent` já validado, aplicando `escapeLatex()` em todo texto vindo do usuário,
**para** garantir LaTeX sempre válido e impedir que a IA insira seções ou itens fora da base (a IA nunca produz `.tex` cru).

## Descrição

- Implementar `escapeLatex()` (`escape-latex.ts`) como fronteira única de escape dos caracteres especiais `& % $ # _ { } ~ ^ \`.
- Implementar `renderResume()` (`render-latex.ts`) que recebe um `ResumeContent` (conforme `ResumeContentSchema`) e devolve a string `.tex`.
- O renderer mapeia o objeto nas seções do template faangpath: `OBJECTIVE`, `Education`, `SKILLS`, `EXPERIENCE`, `PROJECTS`, `Extra-Curricular` (extras) e `Leadership`.
- O `.tex` é montado a partir de `templates/faangpath/skeleton.ts` (template literal + builders de seção), usando `templates/faangpath/resume.cls.txt` apenas como referência read-only da classe.
- Seções sem dados devem ser omitidas (sem deixar comandos LaTeX órfãos).
- **Todo** texto do usuário passa por `escapeLatex()` antes de entrar no `.tex` — nenhuma exceção no call site.
- O renderer é puro e determinístico: mesmo `ResumeContent` → mesmo `.tex`, sem chamadas externas.

## Referências

- **Spec:** §3 (Modo 1, passo 4 — render); §4 (regra inegociável de origem do conteúdo).
- **Contrato de API:** §3 `ResumeContentSchema` (formato de entrada do renderer).
- **ERD:** `GeneratedResume.texOutput` (destino do `.tex` cacheado — persistência fica em US posterior).
- **Código:** `src/server/resume/render-latex.ts`, `src/server/resume/escape-latex.ts`, `templates/faangpath/skeleton.ts`, `templates/faangpath/resume.cls.txt`, `src/lib/schemas/` (`ResumeContentSchema`).
- **Arquitetura:** §5 (regra de ouro da geração; escape LaTeX centralizado), ADR-0007, ADR-0009.
- **Testes:** `tests/render-latex.test.ts`, `tests/escape-latex.test.ts` (cobertura obrigatória — ARCHITECTURE §8).

## Estados envolvidos

- `ResumeContent` mínimo (só `objective` + uma seção) → `.tex` válido com seções omitidas.
- `ResumeContent` completo (todas as seções preenchidas).
- Texto com caracteres especiais LaTeX → escapados corretamente.
- Listas vazias (`bullets`, `skills.items`) → seção/linha omitida sem resíduo.

## Fora do escopo

- Chamada ao LLM e geração do `ResumeContent` (US-04/US-05).
- Persistência do `.tex` (`GeneratedResume`) e download (US-05/US-06).
- Validação de rastreabilidade (US-07).
- Templates além do faangpath (não-objetivo do MVP — ARCHITECTURE §6).

## Pendências

- [DECISÃO PENDENTE] O `ResumeContentSchema` (§3 do contrato) lista `extras?` e `leadership?` como `string[]`, mas `experience`/`projects` como objetos com `sourceId`. Confirmar a forma exata de cada seção do `skeleton.ts` (ex.: `Education` recebe `EducationItem[]` — quais campos do ERD entram no `.tex`?).
- [DECISÃO PENDENTE] Cabeçalho do `.tex` (nome, contatos, links) vem do `Profile`, mas `ResumeContentSchema` em §3 não lista um bloco de cabeçalho. Confirmar se o renderer recebe o `Profile`/cabeçalho separadamente ou se o schema deve ganhar um campo `header`.
