"use client";

// Tela /curriculos/[id]/editar — edição MANUAL do conteúdo de um currículo gerado
// (ADR-0030). Edita o ResumeContent (contentJson) daquele currículo e, ao salvar, o
// servidor re-renderiza o `.tex` pelo renderer puro (sem IA) e zera o traceabilityReport.
//
// Reusa o editor visual do /perfil (ListSection + FieldDef + Bullets) — mesmo DS. NÃO
// edita o cabeçalho (nome/contato): isso é dado de /perfil (a edição aqui é só do conteúdo
// do currículo). O guardrail NÃO roda: é o dono dos dados editando, não a IA — o invariante
// anti-alucinação (sobre a IA) segue intacto. As adaptações à vaga continuam lendo /perfil
// (ADR-0027), então editar aqui NÃO muda futuras adaptações — apenas pole este currículo.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ResumeContentSchema,
  type ResumeContent,
  type ResumeEducationItem,
  type ResumeSkillGroup,
  type ResumeExperienceItem,
  type ResumeProjectItem,
  type ResumeLanguageItem,
  type ResumeCourseItem,
  type GeneratedResume,
} from "@/lib/schemas";
import { ListSection, Bullets, type FieldDef } from "@/components/perfil/ListSection";
import { Icon } from "@/components/Icon";

type Status = "loading" | "ready" | "saving" | "saved" | "error" | "notfound";

interface FieldError {
  path: string;
  message: string;
}

// Itens novos de experiência precisam de um sourceId (o schema exige min(1)). Como o
// guardrail não roda na edição manual, é só um id sintético inerte (ADR-0030).
const manualSourceId = () => `manual-${crypto.randomUUID()}`;

const EXPERIENCE_FIELDS: FieldDef<ResumeExperienceItem>[] = [
  { key: "role", label: "Cargo", required: true },
  { key: "company", label: "Empresa", required: true },
  { key: "location", label: "Local", placeholder: "Cidade, UF ou Remoto" },
  { key: "period", label: "Período", required: true, placeholder: "Jan 2020 — Atual" },
  { key: "bullets", label: "Realizações", type: "list", span2: true, placeholder: "Uma conquista por linha" },
];

const EDUCATION_FIELDS: FieldDef<ResumeEducationItem>[] = [
  { key: "institution", label: "Instituição", required: true, span2: true },
  { key: "degree", label: "Grau", required: true, placeholder: "Bacharelado" },
  { key: "field", label: "Área", placeholder: "Ciência da Computação" },
  { key: "period", label: "Período", placeholder: "2017 — 2021" },
  { key: "details", label: "Detalhes", type: "textarea", span2: true, placeholder: "TCC, atividades, honrarias…" },
];

const SKILL_FIELDS: FieldDef<ResumeSkillGroup>[] = [
  { key: "category", label: "Categoria", required: true, placeholder: "Linguagens" },
  { key: "items", label: "Itens", type: "list", span2: true, placeholder: "Uma habilidade por linha" },
];

const PROJECT_FIELDS: FieldDef<ResumeProjectItem>[] = [
  { key: "title", label: "Título", required: true },
  { key: "url", label: "URL", type: "url", placeholder: "github.com/voce/projeto" },
  { key: "description", label: "Descrição", required: true, type: "textarea", span2: true },
  { key: "bullets", label: "Destaques", type: "list", span2: true, placeholder: "Um destaque por linha" },
  { key: "techStack", label: "Stack", type: "tags", span2: true },
];

const LANGUAGE_FIELDS: FieldDef<ResumeLanguageItem>[] = [
  { key: "name", label: "Idioma", required: true, placeholder: "Inglês" },
  { key: "proficiency", label: "Proficiência", required: true, placeholder: "Avançado (C1)" },
];

const COURSE_FIELDS: FieldDef<ResumeCourseItem>[] = [
  { key: "title", label: "Título", required: true, span2: true },
  { key: "issuer", label: "Emissor", required: true, placeholder: "Amazon Web Services" },
  { key: "date", label: "Data", required: true, placeholder: "2024" },
  { key: "url", label: "URL", type: "url", span2: true, placeholder: "credencial.com/..." },
];

// Limpa strings vazias das listas (o usuário pode deixar um bullet em branco) e dá trim,
// antes da validação — evita erro à toa (ex.: skills.items exige item não-vazio).
function cleanContent(c: ResumeContent): ResumeContent {
  const cleanArr = (a?: string[]) => (a ?? []).map((s) => s.trim()).filter(Boolean);
  return {
    ...c,
    objective: c.objective.trim(),
    skills: c.skills
      .map((g) => ({ ...g, category: g.category.trim(), items: cleanArr(g.items) }))
      .filter((g) => g.category.length > 0 || g.items.length > 0),
    experience: c.experience.map((e) => ({ ...e, bullets: cleanArr(e.bullets) })),
    projects: c.projects.map((p) => ({
      ...p,
      bullets: cleanArr(p.bullets),
      techStack: cleanArr(p.techStack),
    })),
    extras: c.extras ? cleanArr(c.extras) : c.extras,
    leadership: c.leadership ? cleanArr(c.leadership) : c.leadership,
  };
}

export default function EditarCurriculoPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [content, setContent] = useState<ResumeContent | null>(null);
  const [resumeName, setResumeName] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/resumes/${id}`);
        if (res.status === 404) {
          if (active) setStatus("notfound");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as GeneratedResume;
        if (!active) return;
        setContent(data.contentJson);
        setResumeName(data.name);
        setStatus("ready");
      } catch {
        if (!active) return;
        setErrorMsg("Não foi possível carregar o currículo.");
        setStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  function touch() {
    if (status === "saved" || status === "error") setStatus("ready");
  }

  function updateSection<K extends keyof ResumeContent>(key: K, value: ResumeContent[K]) {
    setContent((prev) => (prev ? { ...prev, [key]: value } : prev));
    touch();
  }

  async function handleSave() {
    if (!content) return;
    setFieldErrors([]);
    setErrorMsg(null);

    const candidate = cleanContent(content);
    const localCheck = ResumeContentSchema.safeParse(candidate);
    if (!localCheck.success) {
      setFieldErrors(
        localCheck.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      );
      setStatus("error");
      setErrorMsg("Corrija os campos destacados antes de salvar.");
      return;
    }

    setStatus("saving");
    try {
      const res = await fetch(`/api/resumes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentJson: localCheck.data }),
      });

      if (res.status === 400) {
        const body = await res.json();
        const details = body?.error?.details;
        if (Array.isArray(details)) {
          setFieldErrors(
            details.map((d: { path?: (string | number)[]; message?: string }) => ({
              // o servidor valida sob `contentJson` — removemos esse prefixo para casar
              // com os caminhos relativos que o ListSection usa (ex.: "experience.0.role").
              path: (d.path ?? []).filter((p) => p !== "contentJson").join("."),
              message: d.message ?? "Inválido",
            })),
          );
        }
        setErrorMsg(body?.error?.message ?? "Dados inválidos.");
        setStatus("error");
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setStatus("saved");
      router.push("/curriculos");
    } catch {
      setErrorMsg("Falha ao salvar. Tente novamente.");
      setStatus("error");
    }
  }

  // Mapa de erros por caminho relativo (`<prefix>.<idx>.<field>`), consumido pelo ListSection.
  const errorMap: Record<string, string> = {};
  for (const e of fieldErrors) errorMap[e.path] = e.message;

  if (status === "loading") {
    return (
      <>
        <div className="page-head">
          <h1>Editar currículo</h1>
          <p className="sub">Carregando o conteúdo do currículo…</p>
        </div>
        <div aria-busy="true" aria-label="Carregando o currículo">
          <div className="skel" style={{ height: 120, width: "100%", borderRadius: 14, marginBottom: 18 }} />
          <div className="skel" style={{ height: 120, width: "100%", borderRadius: 12, marginBottom: 14 }} />
          <div className="skel" style={{ height: 120, width: "100%", borderRadius: 12 }} />
        </div>
      </>
    );
  }

  if (status === "notfound") {
    return (
      <>
        <div className="page-head">
          <h1>Editar currículo</h1>
        </div>
        <div className="note note-danger" role="alert">
          <Icon name="alert" />
          <div className="note-body">
            <p className="note-title">Currículo não encontrado</p>
            <p>Ele pode ter sido excluído ou não pertence à sua conta.</p>
            <div style={{ marginTop: 12 }}>
              <Link className="btn btn-secondary btn-sm" href="/curriculos" style={{ textDecoration: "none" }}>
                <Icon name="arrow" /> Voltar para Meus currículos
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!content) {
    return (
      <>
        <div className="page-head">
          <h1>Editar currículo</h1>
        </div>
        <div className="note note-danger" role="alert">
          <Icon name="alert" />
          <div className="note-body">
            <p className="note-title">Não foi possível carregar o currículo</p>
            <p>{errorMsg ?? "Tente novamente em instantes."}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Editar currículo</h1>
        <p className="sub">
          Edite o conteúdo de <strong>{resumeName}</strong>. Ao salvar, o{" "}
          <span className="mono">.tex</span> é regenerado automaticamente — sem usar a IA.
        </p>
      </div>

      <div className="note note-accent" style={{ marginBottom: 24 }} role="note">
        <Icon name="info" />
        <div className="note-body">
          <p className="note-title">Sobre esta edição</p>
          <p>
            Aqui você ajusta o conteúdo <em>deste</em> currículo. O nome e os contatos do cabeçalho
            vêm da sua base — edite-os em{" "}
            <Link href="/perfil">Perfil</Link>. As adaptações à vaga também usam a sua base, então
            esta edição não altera futuras adaptações; ela serve para deixar este currículo do jeito
            que você quer.
          </p>
        </div>
      </div>

      {/* Objetivo (parágrafo único) */}
      <section className="sec" style={{ marginTop: 0 }} aria-labelledby="objetivo-heading">
        <div className="sec-head2">
          <h2 id="objetivo-heading">
            <span className="sec-ic">
              <Icon name="spark" />
            </span>
            Objetivo
          </h2>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="field span2">
            <label className="label" htmlFor="objective">
              Resumo / objetivo
            </label>
            <textarea
              id="objective"
              className="input"
              style={{ minHeight: 110 }}
              value={content.objective}
              placeholder="Breve objetivo profissional — pode reescrever, sem inventar fatos."
              onChange={(e) => updateSection("objective", e.target.value)}
            />
          </div>
        </div>
      </section>

      <ListSection<ResumeExperienceItem>
        title="Experiência"
        icon="briefcase"
        singular="experiência"
        pathPrefix="experience"
        emptyHint="Nenhuma experiência neste currículo."
        items={content.experience}
        fields={EXPERIENCE_FIELDS}
        makeEmpty={() => ({ sourceId: manualSourceId(), role: "", company: "", period: "", bullets: [] })}
        summarize={(e) => ({ title: e.role, meta: [e.company, e.period].filter(Boolean).join(" · ") })}
        onChange={(items) => updateSection("experience", items)}
        errors={errorMap}
      />

      <ListSection<ResumeEducationItem>
        title="Formação"
        icon="cap"
        singular="formação"
        pathPrefix="education"
        emptyHint="Nenhuma formação neste currículo."
        items={content.education}
        fields={EDUCATION_FIELDS}
        makeEmpty={() => ({ institution: "", degree: "" })}
        summarize={(e) => ({
          title: [e.degree, e.field].filter(Boolean).join(", "),
          meta: [e.institution, e.period].filter(Boolean).join(" · "),
        })}
        onChange={(items) => updateSection("education", items)}
        errors={errorMap}
      />

      <ListSection<ResumeSkillGroup>
        title="Habilidades"
        icon="chip"
        singular="grupo"
        pathPrefix="skills"
        emptyHint="Nenhum grupo de habilidades. Agrupe por categoria."
        items={content.skills}
        fields={SKILL_FIELDS}
        makeEmpty={() => ({ category: "", items: [] })}
        summarize={(s) => ({ title: s.category, meta: s.items.join(", ") })}
        onChange={(items) => updateSection("skills", items)}
        errors={errorMap}
      />

      <ListSection<ResumeProjectItem>
        title="Projetos"
        icon="folder"
        singular="projeto"
        pathPrefix="projects"
        emptyHint="Nenhum projeto neste currículo."
        items={content.projects}
        fields={PROJECT_FIELDS}
        makeEmpty={() => ({ title: "", description: "", bullets: [], techStack: [] })}
        summarize={(p) => ({ title: p.title, meta: p.techStack.join(", ") })}
        onChange={(items) => updateSection("projects", items)}
        errors={errorMap}
      />

      <ListSection<ResumeLanguageItem>
        title="Idiomas"
        icon="globe"
        singular="idioma"
        pathPrefix="languages"
        emptyHint="Nenhum idioma neste currículo."
        items={content.languages}
        fields={LANGUAGE_FIELDS}
        makeEmpty={() => ({ name: "", proficiency: "" })}
        summarize={(l) => ({ title: l.name, meta: l.proficiency })}
        onChange={(items) => updateSection("languages", items)}
        errors={errorMap}
      />

      <ListSection<ResumeCourseItem>
        title="Cursos / Certificações"
        icon="award"
        singular="certificação"
        pathPrefix="courses"
        emptyHint="Nenhum curso ou certificação neste currículo."
        items={content.courses}
        fields={COURSE_FIELDS}
        makeEmpty={() => ({ title: "", issuer: "", date: "" })}
        summarize={(c) => ({ title: c.title, meta: [c.issuer, c.date].filter(Boolean).join(" · ") })}
        onChange={(items) => updateSection("courses", items)}
        errors={errorMap}
      />

      {/* Atividades extracurriculares (lista de linhas simples) */}
      <section className="sec" aria-labelledby="extras-heading">
        <div className="sec-head2">
          <h2 id="extras-heading">
            <span className="sec-ic">
              <Icon name="spark" />
            </span>
            Atividades extracurriculares
          </h2>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <Bullets
            items={content.extras ?? []}
            onChange={(v) => updateSection("extras", v)}
            placeholder="Uma atividade por linha"
          />
        </div>
      </section>

      {/* Liderança (lista de linhas simples) */}
      <section className="sec" aria-labelledby="lideranca-heading">
        <div className="sec-head2">
          <h2 id="lideranca-heading">
            <span className="sec-ic">
              <Icon name="user" />
            </span>
            Liderança
          </h2>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <Bullets
            items={content.leadership ?? []}
            onChange={(v) => updateSection("leadership", v)}
            placeholder="Um item por linha"
          />
        </div>
      </section>

      {/* Barra de salvar fixa */}
      <div className="savebar">
        <div className="left">
          {status === "error" ? (
            <span style={{ color: "var(--danger)" }}>
              {errorMsg ?? "Corrija os campos destacados antes de salvar."}
            </span>
          ) : (
            "As mudanças regeneram o .tex deste currículo (sem IA). Sua base não é alterada."
          )}
        </div>
        {status === "saving" && (
          <span className="sb-status" role="status">
            <span className="spin" /> Salvando…
          </span>
        )}
        {status === "error" && (
          <span className="badge badge-danger">
            <Icon name="alert" size={13} /> Erro de validação
          </span>
        )}
        <Link className="btn btn-secondary" href="/curriculos" style={{ textDecoration: "none" }}>
          Cancelar
        </Link>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={status === "saving"}>
          {status === "saving" ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>
    </>
  );
}
