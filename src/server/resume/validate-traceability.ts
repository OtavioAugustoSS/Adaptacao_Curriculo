// Guardrail de rastreabilidade — 3ª camada anti-alucinação (US-07, ADR-0008/0015).
//
// Compara o `ResumeContent` gerado contra o `ProfileBundle` (a base, fonte da
// verdade) e produz um `TraceabilityReport` { errors, warnings }:
//
// - ERROS FORTES (rastreabilidade de ENTIDADE): experiência/formação/projeto que
//   não casa com a base. Estrito — bloqueia (dispara regeneração; persistente → 422).
// - AVISOS (conteúdo revisável): número/data ou skill nova não encontrada no corpus
//   da base. Conservador — surfa ao usuário, NÃO bloqueia.
//
// Função PURA e determinística (sem rede/IO) — cobertura de teste obrigatória
// (ARCHITECTURE §8). As regras exatas (o que é erro vs. aviso, normalização) são
// as congeladas no ADR-0015; este módulo as implementa literalmente.

import type {
  ResumeContent,
  ProfileBundle,
  TraceabilityReport,
  Issue,
} from "@/lib/schemas";

/**
 * Normalização comum (ADR-0015): minúsculas + remoção de diacríticos (NFD) +
 * colapso de espaços. Preserva as palavras (diferente do `slugify`, que troca
 * não-alfanumérico por `-`). É a base de toda comparação textual do guardrail.
 */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos combinantes
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Regex de tokens numéricos (ADR-0015): inteiros/decimais com `.`/`,` e `%` opcional. */
const NUMBER_TOKEN = /\d+(?:[.,]\d+)?%?/g;

// ---------------------------------------------------------------------------
// Erros fortes — rastreabilidade de entidade
// ---------------------------------------------------------------------------

/**
 * Valida as experiências da saída contra a base (ADR-0015):
 * cada item DEVE ter `sourceId` que exista nos ids das experiências da base, e a
 * `company` normalizada DEVE casar com a do item real referenciado por esse id.
 */
function checkExperience(
  content: ResumeContent,
  bundle: ProfileBundle,
): Issue[] {
  const issues: Issue[] = [];
  // Index id -> experiência da base (só itens com id são rastreáveis).
  const byId = new Map(
    bundle.experiences.filter((e) => e.id).map((e) => [e.id as string, e]),
  );

  content.experience.forEach((exp, i) => {
    const source = exp.sourceId ? byId.get(exp.sourceId) : undefined;
    if (!source) {
      issues.push({
        field: `experience[${i}].sourceId`,
        value: exp.sourceId ?? "",
        reason: "experiência sem item de origem rastreável na base",
      });
      return;
    }
    if (normalize(exp.company) !== normalize(source.company)) {
      issues.push({
        field: `experience[${i}].company`,
        value: exp.company,
        reason: "empresa divergente do item da base referenciado",
      });
    }
  });

  return issues;
}

/**
 * Valida as formações da saída contra a base (ADR-0015): casar `institution`
 * (normalizada) via `sourceId` quando presente; senão por igualdade normalizada
 * de `institution` contra alguma formação da base. Sem match → erro.
 */
function checkEducation(content: ResumeContent, bundle: ProfileBundle): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(
    bundle.educations.filter((e) => e.id).map((e) => [e.id as string, e]),
  );
  const institutions = new Set(
    bundle.educations.map((e) => normalize(e.institution)),
  );

  content.education.forEach((edu, i) => {
    const viaSource = edu.sourceId ? byId.get(edu.sourceId) : undefined;
    const matches = viaSource
      ? normalize(viaSource.institution) === normalize(edu.institution)
      : institutions.has(normalize(edu.institution));
    if (!matches) {
      issues.push({
        field: `education[${i}].institution`,
        value: edu.institution,
        reason: "formação não encontrada na base",
      });
    }
  });

  return issues;
}

/**
 * Valida os projetos da saída contra a base (ADR-0015): casar `title` (normalizado)
 * via `sourceId` quando presente; senão por `title` contra o `name` de algum projeto
 * da base. Sem match → erro.
 */
function checkProjects(content: ResumeContent, bundle: ProfileBundle): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(
    bundle.projects.filter((p) => p.id).map((p) => [p.id as string, p]),
  );
  const names = new Set(bundle.projects.map((p) => normalize(p.name)));

  content.projects.forEach((proj, i) => {
    const viaSource = proj.sourceId ? byId.get(proj.sourceId) : undefined;
    const matches = viaSource
      ? normalize(viaSource.name) === normalize(proj.title)
      : names.has(normalize(proj.title));
    if (!matches) {
      issues.push({
        field: `projects[${i}].title`,
        value: proj.title,
        reason: "projeto não encontrado na base",
      });
    }
  });

  return issues;
}

// ---------------------------------------------------------------------------
// Avisos — conteúdo revisável (comparação literal normalizada)
// ---------------------------------------------------------------------------

/**
 * Corpus da base = normalize da concatenação de TODO texto da base (ADR-0015):
 * summary, company/role/location/bullets de experiências, instituições/graus/área/
 * detalhes, skills, projetos/descrição/techStack, idiomas, cursos. É contra este
 * corpus que checamos números "novos" por substring.
 */
function buildBaseCorpus(bundle: ProfileBundle): string {
  const parts: string[] = [];
  const p = bundle.profile;
  if (p.summary) parts.push(p.summary);

  for (const e of bundle.experiences) {
    parts.push(e.company, e.role, e.startDate);
    if (e.location) parts.push(e.location);
    if (e.endDate) parts.push(e.endDate);
    parts.push(...e.bullets);
  }
  for (const e of bundle.educations) {
    parts.push(e.institution, e.degree, e.startDate);
    if (e.field) parts.push(e.field);
    if (e.endDate) parts.push(e.endDate);
    if (e.gpa) parts.push(e.gpa);
    if (e.details) parts.push(e.details);
  }
  for (const s of bundle.skills) parts.push(s.category, s.name);
  for (const pr of bundle.projects) {
    parts.push(pr.name, pr.description);
    parts.push(...pr.bullets, ...pr.techStack);
    if (pr.url) parts.push(pr.url);
  }
  for (const l of bundle.languages) parts.push(l.name, l.proficiency);
  for (const c of bundle.courses) parts.push(c.title, c.issuer, c.date);

  return normalize(parts.join(" "));
}

/**
 * Avisos de NÚMERO (ADR-0015 + ADR-0020): tokens numéricos que aparecem em `objective`,
 * nos bullets de experiência, na descrição e nos `bullets` de PROJETO da saída e NÃO
 * existem como substring no corpus normalizado da base → "número possivelmente novo"
 * (revisável). Conservador: surfa para o usuário. Os bullets de projeto entram aqui
 * (ADR-0020 §3) com a MESMA regra dos bullets de experiência — não podem ser uma zona
 * cega onde número fabricado passa sem aviso.
 */
function checkNumbers(content: ResumeContent, corpus: string): Issue[] {
  const issues: Issue[] = [];

  const scan = (text: string, field: string) => {
    const matches = text.match(NUMBER_TOKEN);
    if (!matches) return;
    for (const token of matches) {
      // O corpus já está normalizado; o token numérico não tem acento/maiúscula,
      // mas normalizamos por consistência (colapso de espaços não afeta dígitos).
      if (!corpus.includes(normalize(token))) {
        issues.push({
          field,
          value: token,
          reason: "número possivelmente novo (não encontrado na base)",
        });
      }
    }
  };

  scan(content.objective, "objective");
  content.experience.forEach((exp, i) => {
    exp.bullets.forEach((b, j) => scan(b, `experience[${i}].bullets[${j}]`));
  });
  content.projects.forEach((proj, i) => {
    scan(proj.description, `projects[${i}].description`);
    // `?? []`: bullets tem default [] no schema; protege contra ResumeContent não-parseado.
    (proj.bullets ?? []).forEach((b, j) => scan(b, `projects[${i}].bullets[${j}]`));
  });

  return issues;
}

/**
 * Avisos de SKILL (ADR-0015): `skills[].items` cujo nome normalizado NÃO está no
 * conjunto de skills da base (`Skill.name`) → "habilidade possivelmente nova".
 */
function checkSkills(content: ResumeContent, bundle: ProfileBundle): Issue[] {
  const issues: Issue[] = [];
  const baseSkills = new Set(bundle.skills.map((s) => normalize(s.name)));

  content.skills.forEach((group, i) => {
    group.items.forEach((item, j) => {
      if (!baseSkills.has(normalize(item))) {
        issues.push({
          field: `skills[${i}].items[${j}]`,
          value: item,
          reason: "habilidade possivelmente nova (não encontrada na base)",
        });
      }
    });
  });

  return issues;
}

/**
 * Avisos de TECNOLOGIA (ADR-0020 §3): cada item de `projects[].techStack` cujo nome
 * normalizado NÃO apareça no corpus da base → "tecnologia possivelmente nova". Mesmo
 * critério conservador das skills (surfa, não bloqueia). O `buildBaseCorpus` já inclui
 * o techStack da base, então técnicas reais passam sem aviso. Comparamos por substring
 * (coerente com a checagem de número), tolerando o techStack vir embutido em texto.
 */
function checkTechStack(content: ResumeContent, corpus: string): Issue[] {
  const issues: Issue[] = [];

  content.projects.forEach((proj, i) => {
    (proj.techStack ?? []).forEach((tech, j) => {
      const norm = normalize(tech);
      if (norm.length > 0 && !corpus.includes(norm)) {
        issues.push({
          field: `projects[${i}].techStack[${j}]`,
          value: tech,
          reason: "tecnologia possivelmente nova (não encontrada na base)",
        });
      }
    });
  });

  return issues;
}

/**
 * Avisos de IDIOMA (ADR-0020 §3): cada `languages[].name` cujo nome normalizado NÃO
 * case com nenhum `Language.name` da base → "idioma possivelmente novo". NÃO é erro
 * forte (ver ADR-0020: strings curtas/ruidosas; preferir surfar a bloquear). A
 * `proficiency` NÃO é rastreada como entidade.
 */
function checkLanguages(content: ResumeContent, bundle: ProfileBundle): Issue[] {
  const issues: Issue[] = [];
  const baseLanguages = new Set(bundle.languages.map((l) => normalize(l.name)));

  (content.languages ?? []).forEach((lang, i) => {
    if (!baseLanguages.has(normalize(lang.name))) {
      issues.push({
        field: `languages[${i}].name`,
        value: lang.name,
        reason: "idioma possivelmente novo (não encontrado na base)",
      });
    }
  });

  return issues;
}

/**
 * Avisos de CURSO (ADR-0020 §3): cada `courses[].title` cujo título normalizado NÃO
 * case com nenhum `Course.title` da base → "curso possivelmente novo". NÃO é erro
 * forte (ver ADR-0020). `issuer`/`date`/`url` NÃO são rastreados como entidade.
 */
function checkCourses(content: ResumeContent, bundle: ProfileBundle): Issue[] {
  const issues: Issue[] = [];
  const baseCourses = new Set(bundle.courses.map((c) => normalize(c.title)));

  (content.courses ?? []).forEach((course, i) => {
    if (!baseCourses.has(normalize(course.title))) {
      issues.push({
        field: `courses[${i}].title`,
        value: course.title,
        reason: "curso possivelmente novo (não encontrado na base)",
      });
    }
  });

  return issues;
}

// ---------------------------------------------------------------------------
// Entrada pública
// ---------------------------------------------------------------------------

/**
 * Valida a rastreabilidade do `ResumeContent` contra a base e devolve o relatório
 * (ADR-0015). `errors` não-vazio ⇒ a geração não deve ser persistida (regenera; e,
 * persistente, vira 422 no orquestrador). `warnings` é informativo (preview).
 *
 * @param content ResumeContent gerado pelo LLM (já validado pelo schema).
 * @param bundle  A base do usuário (fonte da verdade).
 */
export function validateTraceability(
  content: ResumeContent,
  bundle: ProfileBundle,
): TraceabilityReport {
  const errors: Issue[] = [
    ...checkExperience(content, bundle),
    ...checkEducation(content, bundle),
    ...checkProjects(content, bundle),
  ];

  const corpus = buildBaseCorpus(bundle);
  const warnings: Issue[] = [
    ...checkNumbers(content, corpus),
    ...checkSkills(content, bundle),
    ...checkTechStack(content, corpus),
    ...checkLanguages(content, bundle),
    ...checkCourses(content, bundle),
  ];

  return { errors, warnings };
}
