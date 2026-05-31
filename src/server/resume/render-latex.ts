// Renderer determinístico (ADR-0007): ResumeContent (JSON validado pelo LLM) -> .tex
// no template faangpath-simple-template. É a fronteira que garante LaTeX válido e
// impede a IA de inserir seções/itens fora da base — o LLM NUNCA emite .tex cru.
//
// Regras (ARCHITECTURE §5, US-01):
// - Função PURA e determinística: mesmo input -> mesmo output, sem chamadas externas.
// - TODO texto vindo do usuário passa por escapeLatex() antes de entrar no .tex.
// - Seções/linhas sem dados são OMITIDAS, sem deixar comandos LaTeX órfãos.
// - Só renderiza o que está no ResumeContent (+ cabeçalho do Profile); nada inventado.

import type { ResumeContent } from "@/lib/schemas";
import type { Profile } from "@/lib/schemas";
import {
  preamble,
  rSection,
  itemize,
  DOCUMENT_BEGIN,
  DOCUMENT_END,
} from "../../../templates/faangpath/skeleton";
import { escapeLatex } from "./escape-latex";

// Títulos das seções em PT-BR (Fatia 7 / ADR-0020). O produto é PT-BR; os títulos
// antes saíam em inglês (hardcoded). Ver docs/api-contract.md §3 e resume.cls.txt.
const SECTION_TITLES = {
  objective: "OBJETIVO",
  education: "FORMAÇÃO",
  skills: "HABILIDADES",
  experience: "EXPERIÊNCIA",
  projects: "PROJETOS",
  languages: "IDIOMAS",
  // "E" (não "&"): os títulos são constantes interpoladas direto em \begin{rSection}{…}
  // e NÃO passam por escapeLatex (só o body passa). Um "&" cru quebraria a compilação no
  // Overleaf (caractere especial); títulos hardcoded usam só letras/espaço/acentos.
  courses: "CURSOS E CERTIFICAÇÕES",
  extras: "ATIVIDADES EXTRACURRICULARES",
  leadership: "LIDERANÇA",
} as const;

/**
 * Monta as linhas de \address do cabeçalho a partir do Profile.
 * Cada contato vira uma linha; vazios são omitidos. Links recebem \href para
 * ficarem clicáveis no PDF (a classe resume já usa hyperref). Texto escapado.
 */
function buildAddressLines(header: Profile): string[] {
  const lines: string[] = [];

  // Linha 1: contato textual (telefone · localização · email), juntando o que existir.
  const contactParts: string[] = [];
  if (header.phone) contactParts.push(escapeLatex(header.phone));
  if (header.location) contactParts.push(escapeLatex(header.location));
  if (header.email) {
    const email = escapeLatex(header.email);
    contactParts.push(`\\href{mailto:${email}}{${email}}`);
  }
  if (contactParts.length > 0) {
    lines.push(contactParts.join(" \\textbar\\ "));
  }

  // Linha 2: links (LinkedIn · GitHub · website), cada um clicável.
  const linkParts: string[] = [];
  if (header.linkedin) linkParts.push(linkField("LinkedIn", header.linkedin));
  if (header.github) linkParts.push(linkField("GitHub", header.github));
  if (header.website) linkParts.push(linkField("Website", header.website));
  if (linkParts.length > 0) {
    lines.push(linkParts.join(" \\textbar\\ "));
  }

  return lines;
}

/** \href{url}{Rótulo} com URL e rótulo escapados. */
function linkField(label: string, url: string): string {
  return `\\href{${escapeLatex(url)}}{${escapeLatex(label)}}`;
}

/** Seção OBJECTIVE: parágrafo único com o objetivo reescrito (sem fatos novos). */
function renderObjective(objective: string): string | null {
  const text = objective.trim();
  if (!text) return null;
  return rSection(SECTION_TITLES.objective, escapeLatex(text));
}

/**
 * Seção Education: um bloco por formação.
 * Formato faangpath: instituição em negrito à esquerda, período à direita; na linha
 * seguinte grau (+ área) e, opcionalmente, detalhes.
 */
function renderEducation(items: ResumeContent["education"]): string | null {
  if (items.length === 0) return null;

  const blocks = items.map((edu) => {
    const institution = `\\textbf{${escapeLatex(edu.institution)}}`;
    const headLine = edu.period
      ? `${institution} \\hfill ${escapeLatex(edu.period)}\\\\`
      : `${institution}\\\\`;

    const degreeParts = [edu.degree];
    if (edu.field) degreeParts.push(edu.field);
    const lines = [headLine, escapeLatex(degreeParts.join(", "))];

    if (edu.details) lines.push(`\\\\${escapeLatex(edu.details)}`);

    return lines.join("\n");
  });

  return rSection(SECTION_TITLES.education, blocks.join("\n\n"));
}

/**
 * Seção SKILLS: tabela de duas colunas (categoria | itens), padrão faangpath.
 * Grupos sem itens são omitidos. Se nenhum grupo tem itens, a seção some.
 */
function renderSkills(groups: ResumeContent["skills"]): string | null {
  const rows = groups
    .filter((g) => g.items.length > 0)
    .map((g) => {
      const category = `\\textbf{${escapeLatex(g.category)}}`;
      const items = g.items.map((it) => escapeLatex(it)).join(", ");
      return `${category} & ${items}\\\\`;
    });

  if (rows.length === 0) return null;

  const body = `\\begin{tabular}{ @{} >{\\bfseries}l @{\\hspace{6ex}} l }
${rows.join("\n")}
\\end{tabular}`;

  return rSection(SECTION_TITLES.skills, body);
}

/**
 * Seção EXPERIENCE: um bloco por experiência.
 * Formato faangpath: empresa em negrito + local (\hfill); cargo + período (\hfill);
 * bullets em itemize. Bullets vazios -> sem itemize.
 */
function renderExperience(items: ResumeContent["experience"]): string | null {
  if (items.length === 0) return null;

  const blocks = items.map((exp) => {
    const company = `\\textbf{${escapeLatex(exp.company)}}`;
    const companyLine = exp.location
      ? `${company} \\hfill ${escapeLatex(exp.location)}`
      : company;
    const roleLine = `${escapeLatex(exp.role)} \\hfill ${escapeLatex(exp.period)}`;

    const lines = [`${companyLine}\\\\`, roleLine];

    const bullets = exp.bullets.filter((b) => b.trim().length > 0);
    if (bullets.length > 0) {
      lines.push(itemize(bullets.map((b) => escapeLatex(b))));
    }

    return lines.join("\n");
  });

  return rSection(SECTION_TITLES.experience, blocks.join("\n\n"));
}

/**
 * Seção PROJETOS: um bloco por projeto.
 * Formato faangpath: título em negrito + descrição; URL clicável quando houver;
 * abaixo, os `bullets` em itemize e uma linha "Stack: …" com o `techStack` (Fatia 7 /
 * ADR-0020). Bullets/stack vazios são omitidos sem deixar comandos LaTeX órfãos.
 */
function renderProjects(items: ResumeContent["projects"]): string | null {
  if (items.length === 0) return null;

  const blocks = items.map((proj) => {
    const title = `\\textbf{${escapeLatex(proj.title)}}`;
    let head = `${title} ${escapeLatex(proj.description)}`;
    if (proj.url) {
      const url = escapeLatex(proj.url);
      head += ` \\href{${url}}{${url}}`;
    }

    const lines = [head];

    // bullets/techStack têm default [] no schema; o `?? []` protege quem passar um
    // ResumeContent não-parseado (campos ausentes não devem quebrar o renderer puro).
    const bullets = (proj.bullets ?? []).filter((b) => b.trim().length > 0);
    if (bullets.length > 0) {
      lines.push(itemize(bullets.map((b) => escapeLatex(b))));
    }

    const stack = (proj.techStack ?? []).filter((t) => t.trim().length > 0);
    if (stack.length > 0) {
      const joined = stack.map((t) => escapeLatex(t)).join(", ");
      lines.push(`\\textbf{Stack:} ${joined}`);
    }

    return lines.join("\n");
  });

  return rSection(SECTION_TITLES.projects, blocks.join("\n\n"));
}

/**
 * Seção IDIOMAS: uma linha "Idioma — Proficiência" por idioma, separadas por " · ".
 * Ex.: "Português — Nativo · Inglês — Avançado". Omite a seção se não houver idiomas.
 */
function renderLanguages(items: ResumeContent["languages"]): string | null {
  // `?? []`: o campo tem default [] no schema, mas o renderer é puro e pode receber um
  // ResumeContent não-parseado (campo ausente) — não deve quebrar nem emitir seção.
  const list = items ?? [];
  if (list.length === 0) return null;

  const parts = list
    .filter((l) => l.name.trim().length > 0)
    .map((l) => `${escapeLatex(l.name)} — ${escapeLatex(l.proficiency)}`);

  if (parts.length === 0) return null;
  return rSection(SECTION_TITLES.languages, parts.join(" $\\cdot$ "));
}

/**
 * Seção CURSOS & CERTIFICAÇÕES: um bloco por curso.
 * Formato: título em negrito · emissor · data; URL clicável quando houver. Omite a
 * seção se não houver cursos.
 */
function renderCourses(items: ResumeContent["courses"]): string | null {
  // `?? []`: idem renderLanguages — robusto a ResumeContent não-parseado.
  const list = items ?? [];
  if (list.length === 0) return null;

  const blocks = list
    .filter((c) => c.title.trim().length > 0)
    .map((c) => {
      const title = `\\textbf{${escapeLatex(c.title)}}`;
      const meta = [c.issuer, c.date]
        .filter((s) => s.trim().length > 0)
        .map((s) => escapeLatex(s))
        .join(" $\\cdot$ ");
      let line = meta ? `${title} $\\cdot$ ${meta}` : title;
      if (c.url) {
        const url = escapeLatex(c.url);
        line += ` \\href{${url}}{${url}}`;
      }
      return line;
    });

  if (blocks.length === 0) return null;
  return rSection(SECTION_TITLES.courses, blocks.join("\\\\\n"));
}

/** Seção de lista simples (Extra-Curricular / Leadership): itemize de strings. */
function renderBulletList(title: string, items: string[] | undefined): string | null {
  if (!items) return null;
  const cleaned = items.filter((i) => i.trim().length > 0);
  if (cleaned.length === 0) return null;
  return rSection(title, itemize(cleaned.map((i) => escapeLatex(i))));
}

/**
 * Renderiza um ResumeContent validado para o .tex faangpath completo.
 *
 * @param content ResumeContent (saída do LLM já validada pelo ResumeContentSchema).
 * @param header  Cabeçalho (Profile) — origem de \name e \address. O contato é FACTUAL
 *                (não conteúdo gerado pelo LLM), por isso fica fora do ResumeContent de
 *                propósito e vem do Profile, escapado por escapeLatex. OBRIGATÓRIO: em
 *                produção sempre há Profile (US-05); exigir o header torna impossível por
 *                construção emitir um currículo com \name{} vazio. Nota no contrato §3.
 * @returns string .tex pronta para compilar no Overleaf (precisa do resume.cls).
 */
export function renderResume(content: ResumeContent, header: Profile): string {
  const name = escapeLatex(header.fullName);
  const addressLines = buildAddressLines(header);

  const sections = [
    renderObjective(content.objective),
    renderEducation(content.education),
    renderSkills(content.skills),
    renderExperience(content.experience),
    renderProjects(content.projects),
    renderLanguages(content.languages),
    renderCourses(content.courses),
    renderBulletList(SECTION_TITLES.extras, content.extras),
    renderBulletList(SECTION_TITLES.leadership, content.leadership),
  ].filter((s): s is string => s !== null);

  return [
    preamble(name, addressLines),
    DOCUMENT_BEGIN,
    "",
    sections.join("\n\n"),
    "",
    DOCUMENT_END,
    "",
  ].join("\n");
}
