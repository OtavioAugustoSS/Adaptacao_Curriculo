"use client";

// Tela /perfil — edição da base de dados pessoal (a fonte da verdade).
// US-02: bloco Cabeçalho/Resumo. US-03: as listas (experiência, formação,
// habilidades, projetos, idiomas, cursos) com adicionar/editar/remover/reordenar.
//
// A tela mantém todo o bundle em estado e envia o ProfileBundle COMPLETO no PUT;
// o repositório persiste tudo num upsert transacional, reindexando `order` pela
// posição. Estados (spec §2.1): carregando, vazio (CTA), preenchido, salvando,
// erro de validação (400 com details do Zod), salvo, erro.

import { useEffect, useState } from "react";
import {
  ProfileBundleSchema,
  type ProfileBundle,
  type Profile,
  type Experience,
  type Education,
  type Skill,
  type Project,
  type Language,
  type Course,
} from "@/lib/schemas";
import { ListSection, type FieldDef } from "@/components/perfil/ListSection";

type Status = "loading" | "ready" | "saving" | "saved" | "error";

interface FieldError {
  path: string;
  message: string;
}

const HEADER_FIELDS: {
  key: keyof Omit<Profile, "id" | "userId">;
  label: string;
  required?: boolean;
  type?: "text" | "email" | "url" | "textarea";
  placeholder?: string;
}[] = [
  { key: "fullName", label: "Nome completo", required: true, placeholder: "Maria da Silva" },
  { key: "email", label: "E-mail", type: "email", placeholder: "maria@exemplo.com" },
  { key: "phone", label: "Telefone", placeholder: "(11) 99999-0000" },
  { key: "location", label: "Localização", placeholder: "São Paulo, SP" },
  { key: "linkedin", label: "LinkedIn", type: "url", placeholder: "https://linkedin.com/in/maria" },
  { key: "github", label: "GitHub", type: "url", placeholder: "https://github.com/maria" },
  { key: "website", label: "Website", type: "url", placeholder: "https://maria.dev" },
  { key: "summary", label: "Resumo / objetivo", type: "textarea", placeholder: "Breve resumo profissional…" },
];

// Definições de campos de cada lista (rótulos PT-BR). `makeEmpty` usa os defaults
// do schema (current=false, bullets/techStack=[], order=0 — o order é reindexado
// no servidor pela posição, então o valor aqui é irrelevante).
const EXPERIENCE_FIELDS: FieldDef<Experience>[] = [
  { key: "company", label: "Empresa", required: true },
  { key: "role", label: "Cargo", required: true },
  { key: "location", label: "Local" },
  { key: "startDate", label: "Início", required: true, placeholder: "Jan 2022" },
  { key: "endDate", label: "Fim", placeholder: "Atual" },
  { key: "current", label: "Emprego atual", type: "boolean" },
  { key: "bullets", label: "Realizações", type: "list" },
];

const EDUCATION_FIELDS: FieldDef<Education>[] = [
  { key: "institution", label: "Instituição", required: true },
  { key: "degree", label: "Grau", required: true, placeholder: "Bacharelado" },
  { key: "field", label: "Área", placeholder: "Ciência da Computação" },
  { key: "startDate", label: "Início", required: true, placeholder: "2018" },
  { key: "endDate", label: "Fim", placeholder: "2022" },
  { key: "gpa", label: "Nota / CR" },
  { key: "details", label: "Detalhes", type: "textarea" },
];

const SKILL_FIELDS: FieldDef<Skill>[] = [
  { key: "category", label: "Categoria", required: true, placeholder: "Técnicas" },
  { key: "name", label: "Habilidade", required: true, placeholder: "TypeScript" },
  { key: "level", label: "Nível", placeholder: "Avançado" },
];

const PROJECT_FIELDS: FieldDef<Project>[] = [
  { key: "name", label: "Nome", required: true },
  { key: "description", label: "Descrição", required: true, type: "textarea" },
  { key: "bullets", label: "Destaques", type: "list" },
  { key: "techStack", label: "Stack", type: "list" },
  { key: "url", label: "URL", type: "url" },
];

const LANGUAGE_FIELDS: FieldDef<Language>[] = [
  { key: "name", label: "Idioma", required: true, placeholder: "Inglês" },
  { key: "proficiency", label: "Proficiência", required: true, placeholder: "Fluente" },
];

const COURSE_FIELDS: FieldDef<Course>[] = [
  { key: "title", label: "Título", required: true },
  { key: "issuer", label: "Emissor", required: true },
  { key: "date", label: "Data", required: true, placeholder: "Mar 2024" },
  { key: "url", label: "URL", type: "url" },
];

// Estado inicial da tela: bundle vazio. NÃO passa pelo schema porque `fullName: ""`
// é placeholder de UI (inválido de propósito até o usuário preencher); a validação
// acontece no save. Construído como literal para casar com o tipo ProfileBundle.
function emptyBundle(): ProfileBundle {
  return {
    profile: { fullName: "" },
    experiences: [],
    educations: [],
    skills: [],
    projects: [],
    languages: [],
    courses: [],
  };
}

export default function PerfilPage() {
  const [bundle, setBundle] = useState<ProfileBundle>(emptyBundle());
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ProfileBundle;
        if (!active) return;
        setBundle(data);
        setStatus("ready");
      } catch {
        if (!active) return;
        setErrorMsg("Não foi possível carregar a base. Tente recarregar a página.");
        setStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const isEmptyBase =
    status === "ready" &&
    !bundle.profile.fullName.trim() &&
    bundle.experiences.length === 0 &&
    bundle.educations.length === 0 &&
    bundle.skills.length === 0 &&
    bundle.projects.length === 0 &&
    bundle.languages.length === 0 &&
    bundle.courses.length === 0;

  function touch() {
    if (status === "saved" || status === "error") setStatus("ready");
  }

  function updateProfile(key: keyof Profile, value: string) {
    setBundle((prev) => ({ ...prev, profile: { ...prev.profile, [key]: value } }));
    touch();
  }

  function updateList<K extends keyof ProfileBundle>(key: K, items: ProfileBundle[K]) {
    setBundle((prev) => ({ ...prev, [key]: items }));
    touch();
  }

  async function handleSave() {
    setFieldErrors([]);
    setErrorMsg(null);

    // Normaliza strings vazias de campos opcionais do cabeçalho para undefined.
    const profile: Profile = { ...bundle.profile };
    for (const { key } of HEADER_FIELDS) {
      const v = profile[key];
      if (typeof v === "string" && v.trim() === "" && key !== "fullName") {
        profile[key] = undefined;
      }
    }

    const candidate = { ...bundle, profile };
    const localCheck = ProfileBundleSchema.safeParse(candidate);
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
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localCheck.data),
      });

      if (res.status === 400) {
        const body = await res.json();
        const details = body?.error?.details;
        if (Array.isArray(details)) {
          setFieldErrors(
            details.map((d: { path?: (string | number)[]; message?: string }) => ({
              path: (d.path ?? []).join("."),
              message: d.message ?? "Inválido",
            })),
          );
        }
        setErrorMsg(body?.error?.message ?? "Dados inválidos.");
        setStatus("error");
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as ProfileBundle;
      setBundle(data);
      setStatus("saved");
    } catch {
      setErrorMsg("Falha ao salvar. Tente novamente.");
      setStatus("error");
    }
  }

  function headerErrorFor(key: string): string | undefined {
    return fieldErrors.find((e) => e.path === `profile.${key}`)?.message;
  }

  if (status === "loading") {
    return (
      <main style={styles.main}>
        <h1>Perfil</h1>
        <p>Carregando sua base de dados…</p>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <h1>Perfil</h1>
      <p style={styles.subtitle}>
        Esta é a sua base de dados — a fonte da verdade que alimenta a geração dos
        currículos. Tudo que aparece nos currículos sai daqui.
      </p>

      {isEmptyBase && (
        <div style={styles.emptyCta} role="status">
          Sua base ainda está vazia. Preencha o nome completo e ao menos uma experiência ou
          formação, depois salve para começar.
        </div>
      )}

      <section aria-labelledby="cabecalho-heading" style={styles.headerSection}>
        <h2 id="cabecalho-heading" style={styles.h2}>
          Cabeçalho e resumo
        </h2>
        <div style={styles.fields}>
          {HEADER_FIELDS.map((f) => {
            const value = (bundle.profile[f.key] ?? "") as string;
            const err = headerErrorFor(f.key);
            const inputId = `field-${f.key}`;
            return (
              <div key={f.key} style={styles.field}>
                <label htmlFor={inputId} style={styles.label}>
                  {f.label}
                  {f.required ? <span style={styles.required}> *</span> : null}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    id={inputId}
                    value={value}
                    placeholder={f.placeholder}
                    onChange={(e) => updateProfile(f.key, e.target.value)}
                    rows={4}
                    style={{ ...styles.input, ...(err ? styles.inputError : {}) }}
                  />
                ) : (
                  <input
                    id={inputId}
                    type={f.type ?? "text"}
                    value={value}
                    placeholder={f.placeholder}
                    onChange={(e) => updateProfile(f.key, e.target.value)}
                    style={{ ...styles.input, ...(err ? styles.inputError : {}) }}
                  />
                )}
                {err ? (
                  <span role="alert" style={styles.errorText}>
                    {err}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <ListSection<Experience>
        title="Experiência profissional"
        emptyHint="Nenhuma experiência adicionada ainda."
        items={bundle.experiences}
        fields={EXPERIENCE_FIELDS}
        makeEmpty={() => ({ company: "", role: "", startDate: "", current: false, bullets: [], order: 0 })}
        summarize={(e) => [e.company, e.role].filter(Boolean).join(" — ")}
        onChange={(items) => updateList("experiences", items)}
      />

      <ListSection<Education>
        title="Formação"
        emptyHint="Nenhuma formação adicionada ainda."
        items={bundle.educations}
        fields={EDUCATION_FIELDS}
        makeEmpty={() => ({ institution: "", degree: "", startDate: "", order: 0 })}
        summarize={(e) => [e.institution, e.degree].filter(Boolean).join(" — ")}
        onChange={(items) => updateList("educations", items)}
      />

      <ListSection<Skill>
        title="Habilidades"
        emptyHint="Nenhuma habilidade adicionada ainda."
        items={bundle.skills}
        fields={SKILL_FIELDS}
        makeEmpty={() => ({ category: "", name: "", order: 0 })}
        summarize={(s) => [s.category, s.name].filter(Boolean).join(": ")}
        onChange={(items) => updateList("skills", items)}
      />

      <ListSection<Project>
        title="Projetos"
        emptyHint="Nenhum projeto adicionado ainda."
        items={bundle.projects}
        fields={PROJECT_FIELDS}
        makeEmpty={() => ({ name: "", description: "", bullets: [], techStack: [], order: 0 })}
        summarize={(p) => p.name}
        onChange={(items) => updateList("projects", items)}
      />

      <ListSection<Language>
        title="Idiomas"
        emptyHint="Nenhum idioma adicionado ainda."
        items={bundle.languages}
        fields={LANGUAGE_FIELDS}
        makeEmpty={() => ({ name: "", proficiency: "", order: 0 })}
        summarize={(l) => [l.name, l.proficiency].filter(Boolean).join(" — ")}
        onChange={(items) => updateList("languages", items)}
      />

      <ListSection<Course>
        title="Cursos e certificações"
        emptyHint="Nenhum curso adicionado ainda."
        items={bundle.courses}
        fields={COURSE_FIELDS}
        makeEmpty={() => ({ title: "", issuer: "", date: "", order: 0 })}
        summarize={(c) => [c.title, c.issuer].filter(Boolean).join(" — ")}
        onChange={(items) => updateList("courses", items)}
      />

      <div style={styles.actions}>
        <button type="button" onClick={handleSave} disabled={status === "saving"} style={styles.saveButton}>
          {status === "saving" ? "Salvando…" : "Salvar"}
        </button>
        {status === "saved" && (
          <span role="status" style={styles.savedMsg}>
            Salvo com sucesso.
          </span>
        )}
        {status === "error" && errorMsg && (
          <span role="alert" style={styles.errorMsg}>
            {errorMsg}
          </span>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 760, margin: "0 auto" },
  subtitle: { color: "#555", marginTop: "-0.25rem" },
  headerSection: { marginTop: "1.5rem" },
  h2: { fontSize: "1.15rem" },
  fields: { display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.75rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.25rem" },
  label: { fontWeight: 600, fontSize: "0.9rem" },
  required: { color: "#c0392b" },
  input: {
    padding: "0.5rem 0.625rem",
    border: "1px solid #ccc",
    borderRadius: 6,
    fontSize: "0.95rem",
    fontFamily: "inherit",
  },
  inputError: { borderColor: "#c0392b" },
  errorText: { color: "#c0392b", fontSize: "0.8rem" },
  emptyCta: {
    marginTop: "1rem",
    padding: "0.75rem 1rem",
    background: "#eef4ff",
    border: "1px solid #cdddff",
    borderRadius: 8,
    fontSize: "0.9rem",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginTop: "2rem",
    position: "sticky",
    bottom: 0,
    background: "#fff",
    padding: "1rem 0",
    borderTop: "1px solid #eee",
  },
  saveButton: {
    padding: "0.6rem 1.25rem",
    background: "#1a5cff",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: "0.95rem",
    cursor: "pointer",
  },
  savedMsg: { color: "#1e7e34", fontSize: "0.9rem" },
  errorMsg: { color: "#c0392b", fontSize: "0.9rem" },
};
