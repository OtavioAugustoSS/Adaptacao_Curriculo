# 0002 — Saída somente `.tex`; compilação no Overleaf

- **Status:** Accepted
- **Data:** 2026-05-29

## Contexto

O currículo final usa o template LaTeX **faangpath-simple-template**. Compilar LaTeX
para PDF dentro do sistema exigiria empacotar uma distribuição TeX (centenas de MB),
gerenciar timeouts, sandbox de segurança e falhas de compilação. O Overleaf já oferece
compilação confiável e é onde o usuário-alvo costuma trabalhar.

## Decisão

A saída do sistema é **somente o arquivo `.tex`**. A compilação para PDF é feita pelo
usuário no **Overleaf**. Nenhuma engine LaTeX é instalada ou executada no sistema.

## Consequências

- Sistema leve: sem dependência de distribuição TeX nem execução de processo externo.
- Sem superfície de ataque de compilação arbitrária no servidor.
- O `.tex` gerado precisa ser sempre válido (reforça ADR-0007 e ADR-0009).
- O usuário tem um passo manual (subir/colar o `.tex` no Overleaf) antes do PDF.
- Pré-visualização de PDF dentro do app fica fora do escopo.

## Alternativas consideradas

- **Compilar LaTeX no servidor (TeX Live + latexmk):** rejeitado pelo peso, custo
  operacional, risco de segurança (execução de código) e fragilidade de timeouts.
- **Serviço externo de compilação (API de terceiros):** custo e dependência extra
  sem valor no MVP; o usuário já tem Overleaf.
