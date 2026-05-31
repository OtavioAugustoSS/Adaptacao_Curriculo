import { describe, it, expect } from "vitest";
import { renderResume } from "@/server/resume/render-latex";
import type { ResumeContent, Profile } from "@/lib/schemas";

// Testes de COMPORTAMENTO do renderer determinístico (US-01, ARCHITECTURE §5/§8).
// A asserção é sobre o .tex faangpath ESPERADO, não sobre detalhes internos:
// - quais seções aparecem/somem, ordem do template, escape de texto de usuário,
//   bullets viram itemize, cabeçalho a partir do Profile.
//
// Helper: monta um ResumeContent mínimo válido e deixa o teste sobrescrever só
// os campos relevantes ao cenário. Mantém os testes legíveis e isolados.
function makeContent(overrides: Partial<ResumeContent> = {}): ResumeContent {
  return {
    objective: "",
    education: [],
    skills: [],
    experience: [],
    projects: [],
    languages: [],
    courses: [],
    ...overrides,
  };
}

// Uma experiência completa de exemplo (caso feliz).
const SAMPLE_EXPERIENCE = {
  sourceId: "exp-1",
  role: "Engenheiro de Software",
  company: "Acme Corp",
  location: "São Paulo, BR",
  period: "Jan 2020 — Atual",
  bullets: ["Construiu o backend", "Liderou a migração"],
};

// Header mínimo (Profile) para os casos focados em SEÇÃO. `header` é obrigatório
// no renderResume; aqui só o nome importa, e os campos de contato são opcionais.
// Sem caracteres especiais para não poluir as asserções de conteúdo das seções.
const MINIMAL_HEADER: Profile = { fullName: "Maria Silva" };

// Atalho: renderiza com o header mínimo (os testes de cabeçalho passam o seu).
function renderSections(content: ResumeContent): string {
  return renderResume(content, MINIMAL_HEADER);
}

describe("renderResume — estrutura do documento", () => {
  it("deve produzir um documento LaTeX válido (preâmbulo + begin/end document)", () => {
    const tex = renderSections(makeContent());
    expect(tex).toContain("\\documentclass{resume}");
    expect(tex).toContain("\\begin{document}");
    expect(tex).toContain("\\end{document}");
    // O begin precede o end (documento bem-formado).
    expect(tex.indexOf("\\begin{document}")).toBeLessThan(
      tex.indexOf("\\end{document}"),
    );
  });

  it("deve gerar um documento válido sem nenhuma seção de conteúdo quando tudo está vazio", () => {
    const tex = renderSections(makeContent());
    // Caso 'tudo vazio': nenhuma rSection deve aparecer (sem comandos órfãos).
    expect(tex).not.toContain("\\begin{rSection}");
    expect(tex).not.toContain("OBJETIVO");
    expect(tex).not.toContain("EXPERIÊNCIA");
    // Ainda assim é um documento compilável.
    expect(tex).toContain("\\begin{document}");
    expect(tex).toContain("\\end{document}");
  });
});

describe("renderResume — omissão de seções vazias", () => {
  it("deve omitir EXPERIÊNCIA quando não há experiências", () => {
    const tex = renderSections(makeContent({ objective: "Objetivo qualquer" }));
    expect(tex).not.toContain("rSection}{EXPERIÊNCIA}");
  });

  it("deve omitir OBJETIVO quando o objetivo é só espaços em branco", () => {
    const tex = renderSections(makeContent({ objective: "   " }));
    expect(tex).not.toContain("OBJETIVO");
  });

  it("deve omitir HABILIDADES quando todos os grupos estão sem itens", () => {
    const tex = renderSections(
      makeContent({ skills: [{ category: "Linguagens", items: [] }] }),
    );
    expect(tex).not.toContain("rSection}{HABILIDADES}");
  });

  it("deve omitir as listas Atividades Extracurriculares e Liderança quando ausentes ou vazias", () => {
    const tex = renderSections(
      makeContent({ extras: [], leadership: undefined }),
    );
    expect(tex).not.toContain("ATIVIDADES EXTRACURRICULARES");
    expect(tex).not.toContain("LIDERANÇA");
  });
});

describe("renderResume — escape de texto de usuário (guardrail LaTeX)", () => {
  it("deve escapar & no nome da empresa (R&D vira R\\&D)", () => {
    const tex = renderSections(
      makeContent({
        experience: [{ ...SAMPLE_EXPERIENCE, company: "R&D" }],
      }),
    );
    expect(tex).toContain("R\\&D");
    // O & cru NUNCA pode aparecer dentro do texto da empresa.
    expect(tex).not.toMatch(/R&D/);
  });

  it("deve escapar % nos bullets (100% vira 100\\%)", () => {
    const tex = renderSections(
      makeContent({
        experience: [
          { ...SAMPLE_EXPERIENCE, bullets: ["Cobertura de 100% nos testes"] },
        ],
      }),
    );
    expect(tex).toContain("Cobertura de 100\\% nos testes");
  });

  it("deve escapar caracteres especiais no objetivo", () => {
    const tex = renderSections(
      makeContent({ objective: "Foco em C# & dados_ML" }),
    );
    expect(tex).toContain("Foco em C\\# \\& dados\\_ML");
  });
});

describe("renderResume — bullets viram itemize", () => {
  it("deve renderizar bullets de experiência como uma lista itemize com \\item", () => {
    const tex = renderSections(
      makeContent({ experience: [SAMPLE_EXPERIENCE] }),
    );
    expect(tex).toContain("\\begin{itemize}");
    expect(tex).toContain("\\item Construiu o backend");
    expect(tex).toContain("\\item Liderou a migração");
    expect(tex).toContain("\\end{itemize}");
  });

  it("deve omitir o itemize quando a experiência não tem bullets", () => {
    const tex = renderSections(
      makeContent({ experience: [{ ...SAMPLE_EXPERIENCE, bullets: [] }] }),
    );
    // A seção EXPERIÊNCIA existe (há uma experiência), mas sem itemize.
    expect(tex).toContain("rSection}{EXPERIÊNCIA}");
    expect(tex).not.toContain("\\begin{itemize}");
  });

  it("deve ignorar bullets em branco e manter só os preenchidos", () => {
    const tex = renderSections(
      makeContent({
        experience: [{ ...SAMPLE_EXPERIENCE, bullets: ["   ", "Entregou v1"] }],
      }),
    );
    expect(tex).toContain("\\item Entregou v1");
    // O bullet em branco não vira um \item vazio.
    expect(tex).not.toMatch(/\\item\s*\n/);
  });
});

describe("renderResume — ordem das seções faangpath", () => {
  it("deve emitir as seções na ordem do template (PT-BR): OBJETIVO, FORMAÇÃO, HABILIDADES, EXPERIÊNCIA, PROJETOS, IDIOMAS, CURSOS, ATIVIDADES EXTRACURRICULARES, LIDERANÇA", () => {
    const tex = renderSections(
      makeContent({
        objective: "Objetivo",
        education: [
          { institution: "USP", degree: "BSc", period: "2018-2022" },
        ],
        skills: [{ category: "Linguagens", items: ["TypeScript"] }],
        experience: [SAMPLE_EXPERIENCE],
        projects: [
          { title: "Proj", description: "Descrição do projeto", bullets: [], techStack: [] },
        ],
        languages: [{ name: "Inglês", proficiency: "Avançado" }],
        courses: [{ title: "Curso X", issuer: "Coursera", date: "2023" }],
        extras: ["Voluntariado"],
        leadership: ["Líder de equipe"],
      }),
    );

    const order = [
      "OBJETIVO",
      "FORMAÇÃO",
      "HABILIDADES",
      "EXPERIÊNCIA",
      "PROJETOS",
      "IDIOMAS",
      "CURSOS E CERTIFICAÇÕES",
      "ATIVIDADES EXTRACURRICULARES",
      "LIDERANÇA",
    ].map((title) => tex.indexOf(title));

    // Cada seção existe (índice >= 0) e aparece depois da anterior.
    expect(order[0]).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
  });
});

describe("renderResume — cabeçalho a partir do Profile", () => {
  const profile: Profile = {
    fullName: "Otávio R&D",
    phone: "+55 11 99999-0000",
    location: "São Paulo, BR",
    email: "otavio@example.com",
    linkedin: "https://linkedin.com/in/otavio",
    github: "https://github.com/otavio",
  };

  it("deve incluir \\name escapado quando o header é passado", () => {
    const tex = renderResume(makeContent(), profile);
    expect(tex).toContain("\\name{Otávio R\\&D}");
  });

  it("deve incluir os contatos do header em linhas \\address", () => {
    const tex = renderResume(makeContent(), profile);
    expect(tex).toContain("\\address{");
    // O email vira um link mailto clicável.
    expect(tex).toContain("\\href{mailto:otavio@example.com}{otavio@example.com}");
    // Os links (LinkedIn/GitHub) aparecem como \href clicáveis.
    expect(tex).toContain("\\href{https://linkedin.com/in/otavio}{LinkedIn}");
    expect(tex).toContain("\\href{https://github.com/otavio}{GitHub}");
  });

  it("deve escapar caracteres especiais no nome do header (Maria & Cia -> Maria \\& Cia)", () => {
    // header é OBRIGATÓRIO (contrato §3): o nome vem do Profile e passa por escapeLatex.
    const tex = renderResume(makeContent(), { fullName: "Maria & Cia" });
    expect(tex).toContain("\\name{Maria \\& Cia}");
  });
});

describe("renderResume — caso mínimo", () => {
  it("deve renderizar apenas OBJETIVO e EXPERIÊNCIA quando só esses estão presentes", () => {
    const tex = renderSections(
      makeContent({
        objective: "Busco posição de backend",
        experience: [SAMPLE_EXPERIENCE],
      }),
    );

    expect(tex).toContain("rSection}{OBJETIVO}");
    expect(tex).toContain("Busco posição de backend");
    expect(tex).toContain("rSection}{EXPERIÊNCIA}");
    expect(tex).toContain("\\textbf{Acme Corp}");

    // As seções não preenchidas devem estar ausentes.
    expect(tex).not.toContain("rSection}{FORMAÇÃO}");
    expect(tex).not.toContain("rSection}{HABILIDADES}");
    expect(tex).not.toContain("rSection}{PROJETOS}");
  });
});

// --- Fatia 7 / ADR-0020: projeto enriquecido (bullets + Stack), IDIOMAS, CURSOS ---

describe("renderResume — PROJETOS: bullets em itemize + linha Stack (ADR-0020)", () => {
  // Um projeto completo da base (descrição + bullets + techStack).
  const PROJECT = {
    sourceId: "prj-1",
    title: "Compilador",
    description: "Um compilador de brinquedo",
    bullets: ["Implementou o parser", "Otimizou em 2 passes"],
    techStack: ["Rust", "LLVM"],
  };

  it("deve renderizar os bullets do projeto como itemize com \\item", () => {
    const tex = renderSections(makeContent({ projects: [PROJECT] }));
    expect(tex).toContain("rSection}{PROJETOS}");
    expect(tex).toContain("\\begin{itemize}");
    expect(tex).toContain("\\item Implementou o parser");
    expect(tex).toContain("\\item Otimizou em 2 passes");
    expect(tex).toContain("\\end{itemize}");
  });

  it("deve renderizar uma linha 'Stack:' com o techStack do projeto", () => {
    const tex = renderSections(makeContent({ projects: [PROJECT] }));
    expect(tex).toContain("\\textbf{Stack:} Rust, LLVM");
  });

  it("deve escapar caracteres especiais no techStack (C# -> C\\#)", () => {
    const tex = renderSections(
      makeContent({ projects: [{ ...PROJECT, techStack: ["C#"] }] }),
    );
    expect(tex).toContain("\\textbf{Stack:} C\\#");
  });

  it("deve omitir o itemize e a linha Stack quando bullets/techStack estão vazios", () => {
    const tex = renderSections(
      makeContent({
        projects: [{ ...PROJECT, bullets: [], techStack: [] }],
      }),
    );
    // O projeto aparece (título + descrição), mas sem bullets nem linha Stack órfã.
    expect(tex).toContain("rSection}{PROJETOS}");
    expect(tex).toContain("\\textbf{Compilador}");
    expect(tex).not.toContain("\\begin{itemize}");
    expect(tex).not.toContain("\\textbf{Stack:}");
  });

  it("deve ignorar bullets/techStack em branco e manter só os preenchidos", () => {
    const tex = renderSections(
      makeContent({
        projects: [{ ...PROJECT, bullets: ["   ", "Bom"], techStack: ["", "Go"] }],
      }),
    );
    expect(tex).toContain("\\item Bom");
    expect(tex).toContain("\\textbf{Stack:} Go");
  });
});

describe("renderResume — seção IDIOMAS (ADR-0020)", () => {
  it("deve renderizar a seção IDIOMAS com cada idioma como 'Nome — Proficiência'", () => {
    const tex = renderSections(
      makeContent({
        languages: [
          { name: "Português", proficiency: "Nativo" },
          { name: "Inglês", proficiency: "Avançado" },
        ],
      }),
    );
    expect(tex).toContain("rSection}{IDIOMAS}");
    expect(tex).toContain("Português — Nativo");
    expect(tex).toContain("Inglês — Avançado");
  });

  it("deve omitir a seção IDIOMAS quando não há idiomas", () => {
    const tex = renderSections(makeContent({ languages: [] }));
    expect(tex).not.toContain("rSection}{IDIOMAS}");
  });

  it("deve escapar caracteres especiais no idioma/proficiência", () => {
    const tex = renderSections(
      makeContent({ languages: [{ name: "C&Cia", proficiency: "100%" }] }),
    );
    expect(tex).toContain("C\\&Cia");
    expect(tex).toContain("100\\%");
  });
});

describe("renderResume — seção CURSOS E CERTIFICAÇÕES (ADR-0020)", () => {
  it("deve renderizar a seção CURSOS com título, emissor e data", () => {
    const tex = renderSections(
      makeContent({
        courses: [
          { title: "AWS Certified", issuer: "Amazon", date: "2023" },
        ],
      }),
    );
    expect(tex).toContain("rSection}{CURSOS E CERTIFICAÇÕES}");
    expect(tex).toContain("\\textbf{AWS Certified}");
    expect(tex).toContain("Amazon");
    expect(tex).toContain("2023");
  });

  it("deve incluir um \\href clicável quando o curso tem url", () => {
    const tex = renderSections(
      makeContent({
        courses: [
          {
            title: "Curso X",
            issuer: "Coursera",
            date: "2022",
            url: "https://coursera.org/x",
          },
        ],
      }),
    );
    expect(tex).toContain("\\href{https://coursera.org/x}{https://coursera.org/x}");
  });

  it("deve omitir a seção CURSOS quando não há cursos", () => {
    const tex = renderSections(makeContent({ courses: [] }));
    expect(tex).not.toContain("rSection}{CURSOS E CERTIFICAÇÕES}");
  });
});

describe("renderResume — preâmbulo: cor de link discreta (ADR-0020)", () => {
  it("deve definir a cor cvlink azul-marinho (#1F3A5F), não a rosa padrão do hyperref", () => {
    const tex = renderSections(makeContent());
    expect(tex).toContain("\\definecolor{cvlink}{HTML}{1F3A5F}");
    expect(tex).toContain("\\hypersetup{");
    expect(tex).toContain("urlcolor=cvlink");
    expect(tex).toContain("linkcolor=cvlink");
  });
});
