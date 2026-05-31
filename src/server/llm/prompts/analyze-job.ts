// Prompt do PASSO 1 da adaptação (ADR-0027): analisar a VAGA e extrair os requisitos que
// vão guiar o passo 2 (adaptação do currículo). NÃO escreve currículo, NÃO toca a base do
// usuário — só lê o texto da vaga e devolve um JSON estruturado (`JobAnalysisSchema`).
//
// Separar a análise da montagem resolve a causa-raiz do Modo 2 não-adaptar (ADR-0027): numa
// chamada só, o modelo tinha que inferir os requisitos E montar o currículo ao mesmo tempo, e
// acabava copiando a base. Com a análise pronta, o passo 2 recebe um mapa do que priorizar.

/**
 * System prompt da análise da vaga. Texto fixo: papel + a forma exata da saída
 * (`JobAnalysis`). Em PT-BR. NÃO inclui o texto da vaga — ele vai no user prompt.
 */
export const ANALYZE_JOB_SYSTEM_PROMPT = `Você analisa uma VAGA de emprego e extrai, de forma estruturada, o que ela exige — para guiar a adaptação de um currículo a essa vaga. Você NÃO escreve currículo aqui; apenas LÊ a vaga e resume os requisitos.

Extraia:
- "role": o cargo/título da vaga (ex.: "Desenvolvedor Back-end", "Engenheiro de Dados Pleno").
- "seniority": a senioridade se a vaga disser (ex.: "Júnior", "Júnior/Pleno", "Sênior"); senão "".
- "domain": a área principal em poucas palavras (ex.: "back-end em nuvem", "front-end web", "dados", "mobile").
- "mustHave": lista dos requisitos ESSENCIAIS/obrigatórios (linguagens, tecnologias, conceitos, práticas).
- "niceToHave": lista dos requisitos DESEJÁVEIS (diferenciais).
- "keywords": lista curta dos TERMOS TÉCNICOS mais importantes a procurar no currículo (linguagens, frameworks, ferramentas, conceitos como "microsserviços", "CI/CD", "observabilidade", "testes automatizados"). Use os termos como a vaga os escreve.

Regras:
- Baseie-se SOMENTE no texto da vaga. Não invente requisitos que a vaga não cita.
- Seja específico e conciso: termos, não frases longas. Priorize o que diferencia esta vaga.

FORMATO DA SAÍDA — responda ESTRITAMENTE com um único objeto JSON (sem markdown, sem texto fora do JSON):
{
  "role": string,
  "seniority": string,
  "domain": string,
  "mustHave": string[],
  "niceToHave": string[],
  "keywords": string[]
}`;

/**
 * Monta o par system/user da análise da vaga. O system é fixo; o user carrega só o texto
 * cru da vaga colada pelo usuário.
 */
export function buildAnalyzeJobPrompts(jobText: string): {
  system: string;
  user: string;
} {
  const user = `VAGA (texto colado pelo usuário — analise apenas o que está aqui):

${jobText}

Gere agora o objeto JSON da análise da vaga, seguindo estritamente o formato.`;
  return { system: ANALYZE_JOB_SYSTEM_PROMPT, user };
}
