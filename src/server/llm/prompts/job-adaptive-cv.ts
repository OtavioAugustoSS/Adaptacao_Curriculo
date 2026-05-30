// Prompt do Modo 2 (currículo adaptativo à vaga) — US-08.
//
// Espelha o standard-cv.ts (Modo 1): monta o par system/user enviado ao LLM para
// gerar o `ResumeContent`, mas agora recebendo DUAS entradas — a base de dados do
// usuário (fonte da verdade) e o TEXTO DA VAGA colado pelo usuário. O modelo deve
// adaptar o currículo à vaga: priorizar, reordenar e reescrever a redação APENAS de
// itens reais da base que casam com a vaga, e OMITIR o que a vaga pede e o usuário
// não tem.
//
// INVARIANTE DE PRODUTO (ARCHITECTURE §1/§6, ADR-0008/0016): a IA NUNCA inventa. No
// Modo 2 o risco é maior — a vaga "puxa" o modelo a preencher requisitos que ele não
// tem na base (criar experiência/skill/tecnologia para casar com a vaga). O prompt
// reforça isso explicitamente; a garantia dura continua arquitetural (saída JSON
// validada por Zod + renderer determinístico + guardrail da US-07, que aqui é
// reutilizado SEM mudança). O prompt é a 2ª camada.

import type { ProfileBundle } from "@/lib/schemas";

/**
 * System prompt do Modo 2. Texto fixo: papel, invariante anti-alucinação reforçado
 * com a regra de OMISSÃO (nunca preencher o que falta para casar com a vaga) e a
 * forma exata da saída (`ResumeContent`, idêntica à do Modo 1). Em PT-BR (idioma do
 * produto). NÃO inclui base nem vaga — ambas vão no user prompt.
 */
export const JOB_ADAPTIVE_CV_SYSTEM_PROMPT = `Você é um assistente que adapta o conteúdo de um currículo profissional a uma VAGA específica, a partir da BASE DE DADOS pessoal de um usuário.

REGRA INEGOCIÁVEL — NÃO INVENTE NADA:
- Use SOMENTE informações que existem na base fornecida. Nunca crie empresas, cargos, formações, projetos, habilidades, datas, números ou tecnologias que não estejam na base — NEM MESMO se a vaga pedir.
- A vaga vai citar requisitos que o usuário talvez NÃO tenha. Quando isso acontecer, OMITA — nunca preencha, nunca invente experiência, skill ou tecnologia para "casar" com a vaga. Não adapte um item real para fingir que atende um requisito que ele não atende.
- Você PODE: selecionar os itens reais mais relevantes para a vaga, priorizá-los, reordená-los (pôr o que casa com a vaga primeiro), omitir itens irrelevantes, e REESCREVER a redação (linguagem da vaga, foco em impacto) preservando os fatos.
- Você NÃO PODE: adicionar fatos novos, inflar números, inventar resultados, ou alterar empresas/cargos/instituições/datas para se ajustar à vaga.
- Na dúvida, prefira OMITIR a inventar. Um currículo mais curto e 100% verdadeiro é melhor que um inflado.

TAREFA:
- Leia a VAGA e a BASE. Monte um currículo adaptado à vaga usando APENAS itens reais da base.
- Priorize e reordene os itens reais que mais casam com a vaga; omita os que não agregam para esta vaga.
- Escreva o "objective" como um resumo profissional curto, orientado à vaga, baseado SOMENTE no resumo/itens reais da base (sem fatos novos, sem requisitos da vaga que o usuário não tenha).
- Para cada experiência selecionada, copie "sourceId", "role", "company" e o período EXATAMENTE como na base (apenas formate o período de forma legível). Reescreva apenas os bullets, alinhando a linguagem à vaga, sem inventar conquistas nem tecnologias.
- Agrupe habilidades por categoria conforme a base, destacando as que a vaga pede E que o usuário realmente tem. Selecione projetos e formações reais.
- Para cada formação, monte o "period" a partir das datas reais da base (ex.: "2017 – 2021"). Quando a formação tiver "current": true, formate o "period" terminando em "– Atual" (ex.: "2022 – Atual"); não invente datas (espelha o tratamento do período de experiência).

FORMATO DA SAÍDA — responda ESTRITAMENTE com um único objeto JSON (sem markdown, sem comentários, sem texto fora do JSON) neste formato:
{
  "objective": string,
  "education": [ { "sourceId"?: string, "institution": string, "degree": string, "field"?: string, "period"?: string, "details"?: string } ],
  "skills": [ { "category": string, "items": string[] } ],
  "experience": [ { "sourceId": string, "role": string, "company": string, "location"?: string, "period": string, "bullets": string[] } ],
  "projects": [ { "sourceId"?: string, "title": string, "description": string, "url"?: string } ],
  "extras"?: string[],
  "leadership"?: string[]
}

Em "experience", "sourceId" é OBRIGATÓRIO e deve ser o id do item correspondente na base (campo "id"). Em "education"/"projects", inclua "sourceId" com o id real sempre que possível. Não inclua campos fora deste formato.`;

/**
 * Monta o user prompt: o texto da vaga + a base de dados serializada como JSON + a
 * instrução final. A base vai INTEIRA (fonte da verdade; inclui os `id` reais, que
 * viram os `sourceId` da saída); a vaga é o texto cru colado pelo usuário, do qual o
 * modelo NÃO deve extrair fatos para o currículo — só usá-la como filtro/prioridade.
 */
export function buildJobAdaptiveCvUserPrompt(
  bundle: ProfileBundle,
  jobText: string,
): string {
  const base = JSON.stringify(bundle, null, 2);
  return `VAGA (texto colado pelo usuário — use APENAS para selecionar/priorizar/reescrever itens reais da base; NÃO extraia fatos da vaga para o currículo):

${jobText}

BASE DE DADOS DO USUÁRIO (fonte da verdade — use apenas o que está aqui):

${base}

Gere agora o objeto JSON do currículo adaptado à vaga, seguindo estritamente o formato e a regra de não inventar nada (omita o que a vaga pede e o usuário não tem).`;
}

/**
 * Monta o par system/user do Modo 2 para passar ao `LLMProvider`. Ponto de entrada
 * preferido (o select-content usa este). O system é fixo (regras + formato); o user
 * carrega a vaga + a base serializada.
 */
export function buildJobAdaptiveCvPrompts(
  bundle: ProfileBundle,
  jobText: string,
): {
  system: string;
  user: string;
} {
  return {
    system: JOB_ADAPTIVE_CV_SYSTEM_PROMPT,
    user: buildJobAdaptiveCvUserPrompt(bundle, jobText),
  };
}
