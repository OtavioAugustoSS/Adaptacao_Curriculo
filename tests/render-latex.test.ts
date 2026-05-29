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
    expect(tex).not.toContain("OBJECTIVE");
    expect(tex).not.toContain("EXPERIENCE");
    // Ainda assim é um documento compilável.
    expect(tex).toContain("\\begin{document}");
    expect(tex).toContain("\\end{document}");
  });
});

describe("renderResume — omissão de seções vazias", () => {
  it("deve omitir EXPERIENCE quando não há experiências", () => {
    const tex = renderSections(makeContent({ objective: "Objetivo qualquer" }));
    expect(tex).not.toContain("rSection}{EXPERIENCE}");
  });

  it("deve omitir OBJECTIVE quando o objetivo é só espaços em branco", () => {
    const tex = renderSections(makeContent({ objective: "   " }));
    expect(tex).not.toContain("OBJECTIVE");
  });

  it("deve omitir SKILLS quando todos os grupos estão sem itens", () => {
    const tex = renderSections(
      makeContent({ skills: [{ category: "Linguagens", items: [] }] }),
    );
    expect(tex).not.toContain("rSection}{SKILLS}");
  });

  it("deve omitir as listas Extra-Curricular e Leadership quando ausentes ou vazias", () => {
    const tex = renderSections(
      makeContent({ extras: [], leadership: undefined }),
    );
    expect(tex).not.toContain("Extra-Curricular Activities");
    expect(tex).not.toContain("Leadership");
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
    // A seção EXPERIENCE existe (há uma experiência), mas sem itemize.
    expect(tex).toContain("rSection}{EXPERIENCE}");
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
  it("deve emitir as seções na ordem do template: OBJECTIVE, Education, SKILLS, EXPERIENCE, PROJECTS, Extra-Curricular, Leadership", () => {
    const tex = renderSections(
      makeContent({
        objective: "Objetivo",
        education: [
          { institution: "USP", degree: "BSc", period: "2018-2022" },
        ],
        skills: [{ category: "Linguagens", items: ["TypeScript"] }],
        experience: [SAMPLE_EXPERIENCE],
        projects: [{ title: "Proj", description: "Descrição do projeto" }],
        extras: ["Voluntariado"],
        leadership: ["Líder de equipe"],
      }),
    );

    const order = [
      "OBJECTIVE",
      "Education",
      "SKILLS",
      "EXPERIENCE",
      "PROJECTS",
      "Extra-Curricular Activities",
      "Leadership",
    ].map((title) => tex.indexOf(title));

    // Cada seção existe (índice >= 0) e aparece depois da anterior.
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
  it("deve renderizar apenas OBJECTIVE e EXPERIENCE quando só esses estão presentes", () => {
    const tex = renderSections(
      makeContent({
        objective: "Busco posição de backend",
        experience: [SAMPLE_EXPERIENCE],
      }),
    );

    expect(tex).toContain("rSection}{OBJECTIVE}");
    expect(tex).toContain("Busco posição de backend");
    expect(tex).toContain("rSection}{EXPERIENCE}");
    expect(tex).toContain("\\textbf{Acme Corp}");

    // As seções não preenchidas devem estar ausentes.
    expect(tex).not.toContain("rSection}{Education}");
    expect(tex).not.toContain("rSection}{SKILLS}");
    expect(tex).not.toContain("rSection}{PROJECTS}");
  });
});
