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

import type { ProfileBundle, ResumeContent } from "@/lib/schemas";

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
- Você PODE: selecionar e priorizar os itens reais mais relevantes para a vaga, reordená-los (pôr o que casa com a vaga primeiro) e REESCREVER a redação (linguagem da vaga, foco em impacto) preservando os fatos.
- Você NÃO PODE: adicionar fatos novos, inflar números, inventar resultados, ou alterar empresas/cargos/instituições/datas para se ajustar à vaga.
- Na dúvida sobre um FATO, prefira OMITIR a inventar (isto vale para fatos — não é desculpa para encolher o currículo: veja o objetivo de qualidade abaixo).

OBJETIVO DE QUALIDADE — CURRÍCULO RICO E EQUILIBRADO (não enxugue demais):
- Este currículo precisa passar tanto na triagem automática por IA (ATS) quanto na leitura de um recrutador humano. Um currículo rico e verdadeiro é melhor que um enxuto e genérico.
- MANTENHA todas as experiências reais e a MAIORIA dos projetos. Só OMITA um item inteiro quando ele estiver CLARAMENTE fora do escopo da vaga — na dúvida sobre relevância, mantenha o item e reescreva o enquadramento para a vaga. Ter 1–2 páginas (ou mais) é normal; NÃO force caber em uma página cortando conteúdo verdadeiro relevante.
- ATENÇÃO (currículo de início de carreira / poucos itens): quando a base tem POUCAS experiências (ex.: 2) e poucos projetos (ex.: 3), MANTENHA TODOS — não remova NENHUMA experiência nem projeto. "Adaptar" aqui é reescrever a redação e priorizar a ORDEM, NUNCA reduzir o conjunto. Reduzir 2 experiências para 1, ou 3 projetos para 1, é ERRADO. A diversidade de experiência é um ATIVO para quem está começando.
- PROFUNDIDADE DOS BULLETS: preserve a riqueza dos bullets reais da base. Cada bullet importante deve deixar claro o CONTEXTO/PROBLEMA, O QUE FOI FEITO, o IMPACTO/RESULTADO e a JUSTIFICATIVA DA ESCOLHA TÉCNICA quando isso existir na base. Reescreva a redação à vontade, mas condense APENAS os itens menos relevantes para a vaga — nunca reduza um bullet rico a uma frase genérica nem descarte realizações reais.
- STACK: para cada experiência e projeto, inclua a linha de tecnologias (techStack) reais — priorizando as que a vaga pede E que o item realmente usa, sem nunca adicionar tecnologia que ele não tem.
- PALAVRAS-CHAVE: use de forma natural os termos reais da vaga que casam com itens reais da base (ajuda no ATS) — sem inventar para casar.

TAREFA:
- Leia a VAGA e a BASE. Monte um currículo adaptado à vaga usando APENAS itens reais da base.
- Priorize e reordene os itens reais que mais casam com a vaga; mantenha os demais que forem minimamente relevantes (reescrevendo o enquadramento) e omita só o que estiver claramente fora do escopo.
- Escreva o "objective" ESPECÍFICO para ESTA vaga (NÃO um resumo genérico nem cópia do currículo de referência): um resumo curto que posiciona o candidato para o cargo/área da vaga, citando a stack/área da vaga que o usuário REALMENTE domina (sem fatos novos, sem requisitos que o usuário não tenha). Se a vaga é de back-end PHP, o objetivo fala de back-end/PHP reais da base — não de "automações em geral".
- Para cada experiência selecionada, copie "sourceId", "role", "company" e o período EXATAMENTE como na base (apenas formate o período de forma legível). Reescreva os bullets alinhando a linguagem à vaga e PRESERVANDO a profundidade (problema → o que fez → impacto → porquê técnico), sem inventar conquistas nem tecnologias.
- Para cada projeto selecionado, copie "sourceId", "title" e "url" reais; reescreva a "description" alinhando à vaga; e inclua os "bullets" e o "techStack" reais do projeto na base (pode reescrever a redação dos bullets e priorizar as tecnologias que a vaga pede E que o projeto realmente usa — nunca adicionar tecnologia que o projeto não tem).
- Agrupe habilidades por categoria conforme a base, destacando as que a vaga pede E que o usuário realmente tem. Selecione projetos e formações reais. Inclua os idiomas e cursos/certificações reais relevantes (nome/proficiência, título/emissor/data exatos da base).
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
 * Monta o user prompt: o texto da vaga + a base de dados serializada como JSON + (quando
 * houver) o currículo padrão de REFERÊNCIA + a instrução final. A base vai INTEIRA (fonte
 * da verdade; inclui os `id` reais, que viram os `sourceId` da saída); a vaga é o texto
 * cru colado pelo usuário, do qual o modelo NÃO deve extrair fatos para o currículo — só
 * usá-la como filtro/prioridade.
 *
 * `baseContent` (ADR-0022) é o `ResumeContent` de um currículo padrão/completo do usuário,
 * injetado APENAS como referência de PROFUNDIDADE/ESTRUTURA/COMPLETUDE — NÃO é fonte de
 * fatos (todo fato continua vindo da BASE; o guardrail valida contra a base, não contra
 * esta referência). Ausente → sem bloco de referência (deriva só da base, como antes).
 */
export function buildJobAdaptiveCvUserPrompt(
  bundle: ProfileBundle,
  jobText: string,
  baseContent?: ResumeContent,
): string {
  // JSON compacto (ADR-0023): sem indentação — mesma informação, menos tokens (mais rápido).
  const base = JSON.stringify(bundle);
  const referenceBlock = baseContent
    ? `

CURRÍCULO PADRÃO DE REFERÊNCIA (use como referência de PROFUNDIDADE, ESTRUTURA e COMPLETUDE — é o nível de detalhe e a quantidade de itens que se espera no resultado; NÃO é fonte de fatos novos: todo fato vem da BASE acima. O resultado adaptado deve ter o MESMO CONJUNTO de itens desta referência — TODAS as experiências e TODOS os projetos dela, NÃO remova nenhum. ADAPTE a REDAÇÃO, não o conjunto: reescreva o "objective" focado NESTA vaga (não copie o objetivo genérico da referência) e alinhe a linguagem dos bullets à vaga, mantendo a profundidade E A QUANTIDADE de bullets de cada item — se um item tem 5 bullets na referência, o resultado também deve ter ~5 (NÃO reduza para 1–2)):

${JSON.stringify(baseContent)}`
    : "";
  return `VAGA (texto colado pelo usuário — use APENAS para selecionar/priorizar/reescrever itens reais da base; NÃO extraia fatos da vaga para o currículo):

${jobText}

BASE DE DADOS DO USUÁRIO (fonte da verdade — use apenas o que está aqui):

${base}${referenceBlock}

Gere agora o objeto JSON do currículo adaptado à vaga, seguindo estritamente o formato e a regra de não inventar nada (omita o que a vaga pede e o usuário não tem, mas mantenha a riqueza dos itens reais relevantes).`;
}

/**
 * Monta o par system/user do Modo 2 para passar ao `LLMProvider`. Ponto de entrada
 * preferido (o select-content usa este). O system é fixo (regras + formato); o user
 * carrega a vaga + a base serializada + (opcional) o currículo padrão de referência.
 */
export function buildJobAdaptiveCvPrompts(
  bundle: ProfileBundle,
  jobText: string,
  baseContent?: ResumeContent,
): {
  system: string;
  user: string;
} {
  return {
    system: JOB_ADAPTIVE_CV_SYSTEM_PROMPT,
    user: buildJobAdaptiveCvUserPrompt(bundle, jobText, baseContent),
  };
}
