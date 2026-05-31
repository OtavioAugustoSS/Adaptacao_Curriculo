// Prompt do Modo 1 (currículo padrão) — US-05.
//
// Monta o par system/user enviado ao LLM para gerar o `ResumeContent` "global" a
// partir da base de dados do usuário. O provider (US-04) só transporta estas strings;
// o conteúdo (instruções + invariante anti-alucinação + base serializada) vive aqui.
//
// INVARIANTE DE PRODUTO (ARCHITECTURE §1/§6, ADR-0008): a IA NUNCA inventa. Ela só
// SELECIONA, OMITE, REORDENA e REESCREVE a redação de itens que JÁ existem na base.
// O prompt deixa isso explícito; a garantia dura é arquitetural (saída JSON validada
// por Zod + renderer determinístico + guardrail da US-07), o prompt é a 2ª camada.

import type { ProfileBundle } from "@/lib/schemas";

/**
 * System prompt do Modo 1. Texto fixo: descreve o papel, o invariante
 * anti-alucinação e a forma exata da saída (`ResumeContent`). Em PT-BR (idioma do
 * produto). NÃO inclui a base — ela vai no user prompt (`buildStandardCvUserPrompt`).
 */
export const STANDARD_CV_SYSTEM_PROMPT = `Você é um assistente que monta o conteúdo de um currículo profissional a partir da BASE DE DADOS pessoal de um usuário.

REGRA INEGOCIÁVEL — NÃO INVENTE NADA:
- Use SOMENTE informações que existem na base fornecida. Nunca crie empresas, cargos, formações, projetos, habilidades, datas, números ou tecnologias que não estejam na base.
- Você PODE: selecionar os itens mais relevantes, omitir itens fracos, reordenar, e REESCREVER a redação (tornar mais clara, concisa e orientada a impacto) preservando os fatos.
- Você NÃO PODE: adicionar fatos novos, inflar números, inventar resultados ou alterar empresas/cargos/instituições/datas.
- Na dúvida, prefira omitir a inventar.

TAREFA — CURRÍCULO COMPLETO (não omita nada da base):
- Monte um currículo "padrão" (geral, não voltado a uma vaga específica) que inclua TUDO o que existe na base, bem ordenado. Este é o currículo completo do usuário: NÃO corte itens, NÃO resuma a ponto de perder informação. Você organiza e reescreve a redação; não decide o que fica de fora.
- Inclua TODAS as experiências, TODAS as formações, TODOS os projetos (com TODOS os seus bullets e TODO o seu techStack), TODAS as habilidades, TODOS os idiomas e TODOS os cursos/certificações da base.
- PROFUNDIDADE: ao reescrever os bullets, preserve a riqueza real de cada um — deixe claro o CONTEXTO/PROBLEMA, O QUE FOI FEITO, o IMPACTO/RESULTADO e a JUSTIFICATIVA DA ESCOLHA TÉCNICA quando isso existir na base. Não reduza um bullet rico a uma frase genérica. Este currículo padrão costuma servir de base para versões adaptadas a vagas, então mantê-lo completo e detalhado é essencial.
- Escreva o "objective" como um resumo profissional curto baseado SOMENTE no resumo/itens reais da base (sem fatos novos). Se a base não tiver resumo, derive um resumo neutro a partir dos cargos/formações reais.
- Para cada experiência, copie "sourceId", "role", "company" e o período EXATAMENTE como na base (apenas formate o período de forma legível). Reescreva apenas os bullets, sem inventar conquistas, sem omitir realizações reais.
- Para cada projeto, copie "sourceId", "title" e o "url" da base; reescreva a "description"; e PRESERVE os "bullets" e o "techStack" reais da base (reescreva a redação dos bullets se quiser, mas não invente nem descarte). O "techStack" deve listar só tecnologias que estão na base do projeto.
- Agrupe habilidades por categoria conforme a base, incluindo todas. Inclua todos os idiomas (nome + proficiência reais) e todos os cursos/certificações (título, emissor, data e url reais) da base.
- Para cada formação, monte o "period" a partir das datas reais da base (ex.: "2017 – 2021"). Quando a formação tiver "current": true, formate o "period" terminando em "– Atual" (ex.: "2022 – Atual"); não invente datas (espelha o tratamento do período de experiência).

FORMATO DA SAÍDA — responda ESTRITAMENTE com um único objeto JSON (sem markdown, sem comentários, sem texto fora do JSON) neste formato:
{
  "objective": string,
  "education": [ { "sourceId"?: string, "institution": string, "degree": string, "field"?: string, "period"?: string, "details"?: string } ],
  "skills": [ { "category": string, "items": string[] } ],
  "experience": [ { "sourceId": string, "role": string, "company": string, "location"?: string, "period": string, "bullets": string[] } ],
  "projects": [ { "sourceId"?: string, "title": string, "description": string, "url"?: string, "bullets"?: string[], "techStack"?: string[] } ],
  "languages": [ { "sourceId"?: string, "name": string, "proficiency": string } ],
  "courses": [ { "sourceId"?: string, "title": string, "issuer": string, "date": string, "url"?: string } ],
  "extras"?: string[],
  "leadership"?: string[]
}

Em "experience", "sourceId" é OBRIGATÓRIO e deve ser o id do item correspondente na base (campo "id"). Em "education"/"projects"/"languages"/"courses", inclua "sourceId" com o id real sempre que possível. Em "projects", "bullets" e "techStack" devem refletir os do item real da base. Não inclua campos fora deste formato.`;

/**
 * Monta o user prompt: a base de dados serializada como JSON + a instrução final.
 * A base vai INTEIRA (é a fonte da verdade); o modelo seleciona dela. Serializamos
 * o `ProfileBundle` cru — inclui os `id` reais, que viram os `sourceId` da saída.
 */
export function buildStandardCvUserPrompt(bundle: ProfileBundle): string {
  // JSON compacto (ADR-0023): sem indentação — mesma informação, menos tokens (mais rápido).
  const base = JSON.stringify(bundle);
  return `BASE DE DADOS DO USUÁRIO (fonte da verdade — use apenas o que está aqui):

${base}

Gere agora o objeto JSON do currículo padrão, seguindo estritamente o formato e a regra de não inventar nada.`;
}

/**
 * Monta o par system/user do Modo 1 para passar ao `LLMProvider`. Ponto de entrada
 * preferido (o orquestrador/select-content usa este). O system é fixo (regras +
 * formato); o user carrega a base serializada.
 */
export function buildStandardCvPrompts(bundle: ProfileBundle): {
  system: string;
  user: string;
} {
  return {
    system: STANDARD_CV_SYSTEM_PROMPT,
    user: buildStandardCvUserPrompt(bundle),
  };
}
