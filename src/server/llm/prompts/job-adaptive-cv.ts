// Prompt do Modo 2 (currículo adaptativo à vaga) — US-08, re-arquitetado pelo ADR-0027.
//
// Espelha o standard-cv.ts (Modo 1): monta o par system/user para o LLM gerar o `ResumeContent`,
// recebendo a base do usuário (fonte da verdade), o TEXTO da vaga e a ANÁLISE da vaga (passo 1,
// ADR-0027). O modelo adapta o currículo à vaga: prioriza, reordena e reescreve a redação APENAS
// de itens reais da base que casam com a vaga, e OMITE o que a vaga pede e o usuário não tem.
//
// ADR-0027 (causa-raiz corrigida): a versão anterior injetava o currículo padrão INTEIRO como
// "referência de profundidade" e mandava manter "o mesmo conjunto/contagem/profundidade" — com
// temperatura baixa, o modelo copiava a referência e NÃO adaptava. Agora: (1) NÃO se injeta um
// currículo-gabarito; o anti-encolhimento é REGRA sobre a BASE (que já tem todos os bullets); e
// (2) a ADAPTAÇÃO é exigência explícita e tão forte quanto o anti-encolhimento (reordenar por
// relevância, objetivo focado na vaga, reescrever bullets, realçar keywords).
//
// INVARIANTE DE PRODUTO (ARCHITECTURE §1/§6): a IA NUNCA inventa. A análise da vaga é só GUIA —
// não é fonte de fatos; o guardrail (US-07) valida o resultado contra a BASE, sem mudança.

import type { ProfileBundle } from "@/lib/schemas";
import type { JobAnalysis } from "@/server/llm/job-analysis";

/**
 * System prompt do Modo 2 (ADR-0027). Texto fixo: papel, invariante anti-alucinação, a
 * ADAPTAÇÃO obrigatória (reordenar/objetivo/reescrever/keywords), o anti-encolhimento como
 * regra sobre a BASE, e a forma exata da saída (`ResumeContent`, idêntica à do Modo 1).
 */
export const JOB_ADAPTIVE_CV_SYSTEM_PROMPT = `Você adapta o currículo de um candidato a UMA vaga específica, usando SOMENTE a base de dados real dele. O resultado precisa parecer FEITO PARA ESTA VAGA — não pode ser a base apenas copiada.

REGRA INEGOCIÁVEL — NÃO INVENTE NADA:
- Use SOMENTE o que existe na BASE. Nunca crie empresas, cargos, formações, projetos, habilidades, datas, números ou tecnologias que não estejam na base — NEM MESMO se a vaga pedir.
- A vaga vai citar requisitos que o candidato talvez NÃO tenha. Quando isso acontecer, OMITA — nunca preencha, nunca invente experiência, skill ou tecnologia para "casar" com a vaga. Não distorça um item real para fingir que atende um requisito que ele não atende.
- Na dúvida sobre um FATO, prefira OMITIR a inventar (isto vale para FATOS — não é desculpa para encolher o currículo: veja COMPLETUDE).
- COPIE VERBATIM (sem reescrever, encurtar nem traduzir) o NOME DA EMPRESA, o CARGO, a INSTITUIÇÃO e o TÍTULO DO PROJETO — devem sair EXATAMENTE como na base ("DruSign Placas e Comunicação Visual LTDA" NÃO pode virar "DruSign"; "Painel de Controle RaizTech (IoT)" NÃO pode virar "RaizTech"). O "sourceId" de cada item deve ser EXATAMENTE o "id" do item na base — nunca invente, nunca omita. Reescrever esses campos QUEBRA a rastreabilidade e INVALIDA o currículo inteiro. Você reescreve os BULLETS e a DESCRIÇÃO — NUNCA os nomes, títulos ou ids.

ADAPTAR É OBRIGATÓRIO (este é o objetivo principal — um currículo só "fiel" mas não-adaptado é uma FALHA):
- REORDENE por relevância à vaga: experiências, projetos e categorias de habilidades MAIS aderentes à vaga vêm PRIMEIRO, mesmo que isso mude a ordem da base. NÃO mantenha a ordem da base por inércia.
- OBJETIVO focado NA VAGA: escreva um "objective" curto que posiciona o candidato para o CARGO/ÁREA desta vaga, citando 2–3 tecnologias/competências REAIS da base que casam com a vaga. PROIBIDO: objetivo genérico; objetivo que ignore a área da vaga; e — IMPORTANTE — citar no objetivo QUALQUER termo da vaga que NÃO esteja na base. Se a vaga pede "microsserviços", "design patterns", "CI/CD", "observabilidade" e a base NÃO menciona, NÃO escreva esses termos no objetivo (isso é inventar). Posicione para o PAPEL da vaga (back-end → fala do back-end real; dados → dos dados reais), sem afirmar domínio de algo que a base não comprova. NÃO use frases de efeito vazias: é PROIBIDO escrever "soluções escaláveis e seguras", "produtos robustos", "de alto desempenho", "software robusto e eficiente" no objetivo. EXEMPLO RUIM (cara de IA, não faça): "Desenvolvedor focado em criar soluções escaláveis e seguras para entregar produtos robustos e de alto desempenho." EXEMPLO BOM (concreto e humano): "Desenvolvedor back-end com experiência em Python e FastAPI — APIs assíncronas e integrações com serviços externos — buscando atuar no desenvolvimento de produtos em nuvem." Siga o estilo do exemplo BOM: cargo + stack real + o que faz, sem buzzword empilhado.
- REESCREVA os bullets aproximando a linguagem da vaga, MAS sem inventar: realce os aspectos que o item JÁ tem e que casam com a vaga (ex.: um bullet que fala de FastAPI assíncrono pode ser enquadrado como "arquitetura escalável"; um que fala de Docker pode citar "deploy consistente"). É PROIBIDO acrescentar a um item termos que ele não tem na base — NÃO escreva "testes automatizados", "microsserviços", "CI/CD" ou "observabilidade" num bullet cujo texto original não os menciona.
- KEYWORDS (ATS): use de forma NATURAL apenas os termos reais da vaga que correspondem a itens reais da base; em cada item, priorize as tecnologias que a vaga pede E que o item realmente usa. NUNCA insira uma keyword da vaga num item que não a tem.
- ESTILO HUMANO (NÃO soar como IA): escreva o objetivo e os bullets como uma PESSOA escreveria — direto e concreto. EVITE clichês e adjetivos vazios de IA usados como enfeite: "robusto", "eficiente", "soluções escaláveis e seguras", "de alto desempenho", "garantindo a entrega de", "de ponta", "inovador". Em vez de "desenvolvimento de soluções escaláveis e seguras", diga O QUE foi feito, com QUAL tecnologia real e para QUAL resultado concreto (ex.: "back-end em FastAPI com processamento assíncrono para atender múltiplos webhooks simultâneos"). O objetivo deve citar a stack/área REAL do candidato que casa com a vaga, sem frase de efeito.

COMPLETUDE — NÃO ENCOLHA, NÃO GENERALIZE (regra sobre a BASE; não há gabarito para copiar):
- MANTENHA todas as experiências e TODOS os projetos da BASE. Em currículo de início de carreira, isto é inegociável: 2 experiências continuam 2; 3 projetos continuam 3.
- MANTENHA a MESMA QUANTIDADE de bullets de cada item que há na BASE: se uma experiência tem 5 bullets na base, entregue 5 bullets (reescritos), NUNCA 3 ou 4. NÃO descarte NENHUM bullet — nem os que parecerem menos relevantes para a vaga (ex.: um bullet de e-commerce/PHP numa vaga de back-end Python CONTINUA entrando, reescrito). Reduzir a quantidade de bullets é ERRADO.
- PRESERVE os FATOS CONCRETOS de cada bullet: tecnologias específicas, números, nomes de sistemas, o problema e o impacto reais. É PROIBIDO trocar um bullet detalhado por uma frase genérica como "desenvolvimento de soluções escaláveis e seguras" — isso esvazia o currículo. Reescreva a redação MANTENDO as especificidades.
- Em resumo: "adaptar" = REORDENAR + REESCREVER (mantendo os fatos e a QUANTIDADE de bullets) + focar o OBJETIVO. NÃO é encolher nem generalizar.

TAREFA (campo a campo):
- Para cada experiência, copie "sourceId", "role", "company" e o período EXATAMENTE como na base (apenas formate o período de forma legível). Reescreva os bullets alinhando à vaga e PRESERVANDO a profundidade (problema → o que fez → impacto → porquê técnico).
- Para cada projeto, copie "sourceId", "title" e "url" reais; reescreva a "description" alinhando à vaga; inclua os "bullets" e o "techStack" REAIS do projeto (pode reescrever a redação e priorizar as tecnologias que a vaga pede E que o projeto usa — nunca adicionar tecnologia que ele não tem).
- Agrupe habilidades por categoria conforme a base, destacando as que a vaga pede E que o candidato realmente tem. Inclua os idiomas e cursos/certificações reais relevantes (nome/proficiência, título/emissor/data exatos da base).
- Para cada formação, monte o "period" a partir das datas reais da base (ex.: "2017 – 2021"); se "current": true, termine em "– Atual"; não invente datas.

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
 * Monta o user prompt: texto da vaga + (quando houver) a ANÁLISE da vaga + a base serializada.
 * A base vai INTEIRA (fonte da verdade; inclui os `id` reais → `sourceId` da saída). A vaga é
 * texto cru (filtro/prioridade, não fonte de fatos). A análise (ADR-0027) é o mapa de requisitos
 * já extraído no passo 1; é GUIA — todo fato continua vindo da base.
 */
export function buildJobAdaptiveCvUserPrompt(
  bundle: ProfileBundle,
  jobText: string,
  analysis?: JobAnalysis,
): string {
  // JSON compacto (ADR-0023): sem indentação — menos tokens.
  const base = JSON.stringify(bundle);
  // Checklist CONCRETO de contagem de bullets por item (ADR-0027): computado da base, é
  // muito mais obedecido que um "mantenha a mesma quantidade" genérico. Combate o encolhimento.
  const bulletTargets = [
    ...bundle.experiences.map((e) => `experiência "${e.company}" = ${e.bullets.length} bullets`),
    ...bundle.projects.map((p) => `projeto "${p.name}" = ${p.bullets.length} bullets`),
  ].join("; ");
  const targetsBlock = bulletTargets
    ? `

QUANTIDADE OBRIGATÓRIA DE BULLETS (CHECKLIST — entregue EXATAMENTE esta quantidade de bullets para cada item, todos reescritos para a vaga; NUNCA menos. Confira a contagem antes de responder): ${bulletTargets}.`
    : "";
  const analysisBlock = analysis
    ? `

ANÁLISE DA VAGA (requisitos já extraídos no passo 1 — use como GUIA do que priorizar/reordenar e de quais keywords realçar; ainda assim, todo FATO vem da BASE, não desta análise):

${JSON.stringify(analysis)}`
    : "";
  return `VAGA (texto colado pelo usuário — use APENAS para selecionar/priorizar/reescrever itens reais da base; NÃO extraia fatos da vaga para o currículo):

${jobText}${analysisBlock}

BASE DE DADOS DO USUÁRIO (fonte da verdade — use apenas o que está aqui):

${base}${targetsBlock}

Gere agora o objeto JSON do currículo adaptado à vaga, seguindo estritamente o formato. ADAPTE de verdade: reordene por relevância, escreva o objetivo focado nesta vaga, reescreva os bullets na linguagem da vaga e realce as keywords reais — mantendo TODAS as experiências e projetos da base e EXATAMENTE a quantidade de bullets do checklist acima, sem inventar nada.`;
}

/**
 * Monta o par system/user do Modo 2 para passar ao `LLMProvider`. Ponto de entrada preferido
 * (o select-content usa este). O system é fixo (regras + formato); o user carrega a vaga + a
 * análise (opcional) + a base serializada.
 */
export function buildJobAdaptiveCvPrompts(
  bundle: ProfileBundle,
  jobText: string,
  analysis?: JobAnalysis,
): {
  system: string;
  user: string;
} {
  return {
    system: JOB_ADAPTIVE_CV_SYSTEM_PROMPT,
    user: buildJobAdaptiveCvUserPrompt(bundle, jobText, analysis),
  };
}
