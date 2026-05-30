# 0014 — Geração Modo 1: pré-requisito da base, `traceabilityReport` pré-US-07, nome do `.tex`

- **Status:** Accepted
- **Data:** 2026-05-30

## Contexto

As US-05 (fluxo de geração Modo 1) e US-06 (download/preview) tinham três pendências de
decisão que precisam estar fechadas antes de codar (workflow: contrato antes de código):
qual o pré-requisito mínimo da base para gerar; o que gravar em
`GeneratedResume.traceabilityReport` enquanto a US-07 (guardrail) não existe; e a convenção
do nome do arquivo `.tex` baixado. O contrato (api-contract.md) está congelado; os schemas
não mudam — aqui só decisões de comportamento/semântica.

## Decisão

1. **Pré-requisito mínimo do Modo 1:** a base precisa ter `Profile.fullName` não-vazio
   **e** pelo menos **uma experiência OU uma formação**. Se não atender, a rota
   `POST /api/resumes/generate` responde **HTTP 422** com `code: "PREREQUISITE_NOT_MET"`
   e mensagem orientando preencher a base — não chama o LLM. (Spec §2.2.)
2. **`traceabilityReport` antes da US-07:** gravar **`null`** (= "não avaliado"), nunca
   `{ errors: [], warnings: [] }` — um relatório vazio mentiria "checado e limpo". Quando a
   US-07 entrar, ela passa a preencher o relatório de verdade. O schema já permite
   (`TraceabilityReportSchema.nullable().optional()`).
3. **Nome do arquivo `.tex`:** `curriculo-<slug>-<AAAA-MM-DD>.tex`, onde `<slug>` é o
   `Profile.fullName` normalizado (minúsculas, sem acento, não-alfanumérico → `-`, colapsado).
   Fallback `curriculo-<id>.tex` se o slug ficar vazio. Servido com
   `Content-Disposition: attachment; filename="..."`.

## Consequências

- O usuário recebe um erro claro e acionável (422) em vez de um currículo vazio ou uma falha
  obscura do LLM quando a base está insuficiente.
- O histórico distingue "ainda não avaliado" (null) de "avaliado e limpo" (US-07) — sem dívida
  semântica quando o guardrail chegar.
- Nome de arquivo legível e estável para levar ao Overleaf, sem depender de id opaco.
- Uso de 422 para pré-requisito amplia (não muda) a semântica do contrato §2 — registrado como
  nota datada no api-contract.md; schemas inalterados (contrato segue congelado).

## Alternativas consideradas

- **Pré-requisito só "Profile existe":** rejeitado — geraria currículo sem nenhuma seção de
  conteúdo, sem valor e propenso a o LLM "preencher" (risco anti-invariante).
- **`traceabilityReport = {}` vazio:** rejeitado — falso "checado e limpo" (ver decisão 2).
- **400 em vez de 422 para pré-requisito:** rejeitado — o request é bem-formado (passa no Zod);
  o impedimento é estado da base, semântica de 422 (Unprocessable), não de 400 (validação Zod).
- **Nome `curriculo-<id>.tex` fixo:** mantido só como fallback — id opaco é pior para o usuário.
