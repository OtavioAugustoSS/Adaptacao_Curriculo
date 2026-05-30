// Prompt do import de perfil por dump (US-11, ADR-0018).
//
// Monta o par system/user enviado ao LLM para ESTRUTURAR um texto livre do próprio
// usuário (currículo antigo, perfil do LinkedIn, anotações) num rascunho de
// `ProfileBundle`. O provider (US-04) só transporta estas strings; o conteúdo
// (instruções anti-invenção + formato-alvo) vive aqui.
//
// EXTRAÇÃO ≠ GERAÇÃO (ADR-0018 §4): aqui a IA estrutura o PRÓPRIO texto do usuário na
// base; não há base de referência, então o guardrail de rastreabilidade NÃO se aplica.
// A 1ª proteção é ESTE prompt restritivo ("não invente; deixe vazio o que faltar"); a
// 2ª é a revisão humana antes de persistir (o import NÃO salva — devolve rascunho).

/**
 * System prompt do import. Texto fixo: papel, regra anti-invenção (espelho do espírito
 * do Modo 1) e a forma exata da saída (`ProfileBundle` SEM ids). Em PT-BR (idioma do
 * produto). NÃO inclui o texto do usuário — ele vai no user prompt (`buildParseDumpPrompts`).
 */
export const PARSE_DUMP_SYSTEM_PROMPT = `Você ESTRUTURA o texto livre do PRÓPRIO usuário (currículo antigo, perfil do LinkedIn, anotações) na base de dados pessoal dele. Não é geração de currículo: é apenas organizar, em campos, o que o usuário já escreveu.

REGRA INEGOCIÁVEL — NÃO INVENTE NADA:
- Use SOMENTE o que está no texto fornecido. Nunca crie empresas, cargos, formações, projetos, habilidades, idiomas, cursos, datas, números ou tecnologias que não apareçam no texto.
- NÃO infira nem complete: se um campo não aparece no texto, deixe-o VAZIO (string vazia "" para campos de texto, listas vazias [] para as listas) — não chute.
- Na dúvida, prefira deixar VAZIO a preencher com algo que o texto não diz.
- Apenas distribua a informação real do texto nos campos certos; pode normalizar a redação (corrigir capitalização, separar itens), nunca adicionar fatos.

FORMATO DA SAÍDA — responda ESTRITAMENTE com um único objeto JSON (sem markdown, sem comentários, sem texto fora do JSON), SEM nenhum id (não inclua "id", "userId" nem "profileId" em lugar algum), neste formato:
{
  "profile": { "fullName": string, "phone"?: string, "location"?: string, "email"?: string, "linkedin"?: string, "github"?: string, "website"?: string, "summary"?: string },
  "experiences": [ { "company": string, "role": string, "location"?: string, "startDate": string, "endDate"?: string, "current"?: boolean, "bullets"?: string[] } ],
  "educations": [ { "institution": string, "degree": string, "field"?: string, "startDate": string, "endDate"?: string, "current"?: boolean, "gpa"?: string, "details"?: string } ],
  "skills": [ { "category": string, "name": string, "level"?: string } ],
  "projects": [ { "name": string, "description": string, "bullets"?: string[], "techStack"?: string[], "url"?: string } ],
  "languages": [ { "name": string, "proficiency": string } ],
  "courses": [ { "title": string, "issuer": string, "date": string, "url"?: string } ]
}

Em "experiences" e "educations", use "current": true APENAS quando o texto indicar que o item está EM ANDAMENTO (ex.: "atual", "até o momento", "presente", "cursando"). Se o texto não trouxer o nome do usuário, deixe "fullName" como "". Não inclua campos fora deste formato.`;

/**
 * Monta o par system/user do import para passar ao `LLMProvider`. O system é fixo
 * (regras + formato-alvo); o user carrega o texto livre colado pelo usuário, do qual
 * o modelo só DISTRIBUI a informação real nos campos — sem inventar nem inferir.
 */
export function buildParseDumpPrompts(rawText: string): {
  system: string;
  user: string;
} {
  const user = `TEXTO DO USUÁRIO (estruture apenas o que está aqui — não invente, não infira, deixe vazio o que não aparecer):

${rawText}

Gere agora o objeto JSON do perfil, seguindo estritamente o formato (sem ids) e a regra de não inventar nada.`;
  return { system: PARSE_DUMP_SYSTEM_PROMPT, user };
}
