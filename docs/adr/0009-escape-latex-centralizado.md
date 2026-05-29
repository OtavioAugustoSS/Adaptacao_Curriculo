# 0009 — Escape LaTeX centralizado (`escapeLatex`)

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

Texto vindo do usuário (nomes, empresas, bullets, descrições) entra no `.tex`. Caracteres
como `& % $ # _ { } ~ ^ \` têm significado especial em LaTeX e quebram a compilação se
não forem escapados. Escapar ad hoc em cada ponto do renderer é propenso a esquecimentos
e double-escaping.

## Decisão

Centralizar o escape em uma **única função `escapeLatex()`** (`escape-latex.ts`). **Todo**
texto de origem do usuário passa por ela antes de entrar no `.tex`. É a **fronteira única
e confiável** entre dados do usuário e o documento LaTeX.

## Consequências

- LaTeX não quebra por caractere especial não tratado.
- Um único lugar para corrigir/auditar regras de escape e evitar double-escaping.
- `escapeLatex` é lógica pura crítica com cobertura de teste obrigatória.
- Disciplina necessária: todo novo texto no renderer deve passar pela função (regra de revisão).

## Alternativas consideradas

- **Escapar inline em cada seção do renderer:** rejeitado por risco de esquecimento,
  inconsistência e double-escaping.
- **Confiar que o LLM já escapa o texto:** rejeitado — o LLM não emite `.tex` (ADR-0007)
  e não é fonte confiável de escape correto.
