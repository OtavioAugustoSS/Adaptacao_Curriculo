"use client";

// Tela /perfil — edição da base de dados pessoal (a fonte da verdade).
// US-02: bloco Cabeçalho/Resumo. US-03: as listas (experiência, formação,
// habilidades, projetos, idiomas, cursos) com adicionar/editar/remover/reordenar.
//
// A tela mantém todo o bundle em estado e envia o ProfileBundle COMPLETO no PUT;
// o repositório persiste tudo num upsert transacional, reindexando `order` pela
// posição. Estados (spec §2.1): carregando, vazio (CTA), preenchido, salvando,
// erro de validação (400 com details do Zod), salvo, erro.
//
// Fatia 4 (US-10): só a camada visual mudou — Tailwind + componentes do DS
// (cabeçalho em .card, 6 listas via ListSection, savebar fixa, estados visuais).
// A lógica de load/save/validação e o contrato congelado permanecem idênticos.

import { useEffect, useRef, useState } from "react";
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
import { Icon } from "@/components/Icon";
import { countBaseItems } from "@/lib/presentation/base-stats";
import {
  IMPORT_FILE_ACCEPT,
  MAX_IMPORT_FILE_BYTES,
  isAcceptedImportFile,
} from "@/lib/import-file";

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
  span2?: boolean;
}[] = [
  { key: "fullName", label: "Nome completo", required: true, placeholder: "Ex.: Maria Silva", span2: true },
  { key: "email", label: "E-mail", type: "email", placeholder: "voce@email.com" },
  { key: "phone", label: "Telefone", placeholder: "+55 11 90000-0000" },
  { key: "location", label: "Localização", placeholder: "Cidade, UF" },
  { key: "website", label: "Website", type: "url", placeholder: "site.com" },
  { key: "linkedin", label: "LinkedIn", type: "url", placeholder: "linkedin.com/in/voce" },
  { key: "github", label: "GitHub", type: "url", placeholder: "github.com/voce" },
  {
    key: "summary",
    label: "Resumo / objetivo",
    type: "textarea",
    placeholder: "Breve descrição profissional — a IA pode reescrever, nunca inventar.",
    span2: true,
  },
];

// Definições de campos de cada lista (rótulos PT-BR). `makeEmpty` usa os defaults
// do schema (current=false, bullets/techStack=[], order=0 — o order é reindexado
// no servidor pela posição, então o valor aqui é irrelevante).
const EXPERIENCE_FIELDS: FieldDef<Experience>[] = [
  { key: "role", label: "Cargo", required: true },
  { key: "company", label: "Empresa", required: true },
  { key: "location", label: "Local", placeholder: "Cidade, UF ou Remoto" },
  { key: "current", label: "Emprego atual", type: "boolean" },
  { key: "startDate", label: "Início", required: true, placeholder: "2023" },
  { key: "endDate", label: "Fim", placeholder: "2024", disabledWhen: (e) => Boolean(e.current) },
  { key: "bullets", label: "Realizações", type: "list", span2: true, placeholder: "Uma conquista por linha" },
];

const EDUCATION_FIELDS: FieldDef<Education>[] = [
  { key: "institution", label: "Instituição", required: true, span2: true },
  { key: "degree", label: "Grau", required: true, placeholder: "Bacharelado" },
  { key: "field", label: "Área", placeholder: "Ciência da Computação" },
  { key: "current", label: "Cursando (em andamento)", type: "boolean" },
  { key: "startDate", label: "Início", required: true, placeholder: "2017" },
  { key: "endDate", label: "Fim", placeholder: "2021", disabledWhen: (e) => Boolean(e.current) },
  { key: "gpa", label: "Nota / CR", placeholder: "8.7/10" },
  { key: "details", label: "Detalhes", type: "textarea", span2: true, placeholder: "TCC, atividades, honrarias…" },
];

const SKILL_FIELDS: FieldDef<Skill>[] = [
  { key: "category", label: "Categoria", required: true, placeholder: "Linguagens" },
  { key: "level", label: "Nível", placeholder: "Avançado" },
  { key: "name", label: "Habilidade", required: true, span2: true, placeholder: "Go, TypeScript, SQL…" },
];

const PROJECT_FIELDS: FieldDef<Project>[] = [
  { key: "name", label: "Nome", required: true },
  { key: "url", label: "URL", type: "url", placeholder: "github.com/voce/projeto" },
  { key: "description", label: "Descrição", required: true, type: "textarea", span2: true },
  { key: "bullets", label: "Destaques", type: "list", span2: true, placeholder: "Um destaque por linha" },
  { key: "techStack", label: "Stack", type: "tags", span2: true },
];

const LANGUAGE_FIELDS: FieldDef<Language>[] = [
  { key: "name", label: "Idioma", required: true, placeholder: "Inglês" },
  { key: "proficiency", label: "Proficiência", required: true, placeholder: "Avançado (C1)" },
];

const COURSE_FIELDS: FieldDef<Course>[] = [
  { key: "title", label: "Título", required: true, span2: true },
  { key: "issuer", label: "Emissor", required: true, placeholder: "Amazon Web Services" },
  { key: "date", label: "Data", required: true, placeholder: "2024" },
  { key: "url", label: "URL", type: "url", span2: true, placeholder: "credencial.com/..." },
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

// Estado do painel "Importar com IA" (US-11). O import NÃO persiste — devolve um
// rascunho que MESCLAMOS no formulário; o usuário revisa e usa o "Salvar" normal.
type ImportStatus = "idle" | "sending" | "error";

export default function PerfilPage() {
  const [bundle, setBundle] = useState<ProfileBundle>(emptyBundle());
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);

  // Painel de import por dump (US-11): colapsável, texto livre, estados próprios.
  const [importOpen, setImportOpen] = useState(false);
  const [dumpText, setDumpText] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importError, setImportError] = useState<string | null>(null);

  // Import por ARQUIVO (US-13): mesmo painel, entrada paralela à textarea. Estados
  // próprios para não interferir no fluxo de texto. O ref permite limpar o input no sucesso.
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<ImportStatus>("idle");
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    status !== "loading" && !bundle.profile.fullName.trim() && countBaseItems(bundle) === 0;

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

  // US-11 — importa um rascunho da IA e MESCLA no bundle atual (nada é apagado):
  // - listas: ACRESCENTA os itens do rascunho aos existentes (concatena);
  // - cabeçalho: preenche cada campo só se o atual estiver VAZIO (não sobrescreve).
  // O resultado fica no formulário para o usuário revisar e usar o "Salvar" normal.
  async function handleImport() {
    const rawText = dumpText.trim();
    if (!rawText || importStatus === "sending") return;
    setImportStatus("sending");
    setImportError(null);

    try {
      const res = await fetch("/api/profile/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });

      if (!res.ok) {
        let msg = "Não foi possível interpretar o texto. Tente novamente.";
        try {
          const body = await res.json();
          if (typeof body?.error?.message === "string") msg = body.error.message;
        } catch {
          /* resposta sem corpo JSON: mantém a mensagem padrão */
        }
        setImportError(msg);
        setImportStatus("error");
        return; // em erro NÃO altera o bundle
      }

      const draft = (await res.json()) as ProfileBundle;
      setBundle((prev) => mergeDraft(prev, draft));
      setDumpText("");
      setImportStatus("idle");
      setImportOpen(false);
      touch(); // marca como alterado para o usuário revisar e salvar
    } catch {
      setImportError("Falha de conexão ao importar. Tente novamente.");
      setImportStatus("error");
    }
  }

  // US-13 — importa a partir de um ARQUIVO (PDF/DOCX/TXT): pré-valida tipo/tamanho no
  // cliente (erro amigável imediato), envia o arquivo em multipart e, no sucesso, MESCLA
  // o rascunho com o MESMO mergeDraft do fluxo de texto. Em erro NÃO altera o bundle.
  async function handleImportFile(file: File) {
    if (fileStatus === "sending") return;
    setFileError(null);

    if (!isAcceptedImportFile(file.name, file.type)) {
      setFileError("Tipo de arquivo não suportado. Envie um PDF, DOCX ou TXT.");
      setFileStatus("error");
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setFileError("Arquivo muito grande (limite de 8 MB).");
      setFileStatus("error");
      return;
    }

    setFileStatus("sending");
    try {
      const fd = new FormData();
      fd.append("file", file);
      // NÃO setar Content-Type manualmente: o browser monta o boundary do multipart.
      const res = await fetch("/api/profile/import/file", { method: "POST", body: fd });

      if (!res.ok) {
        let msg = "Não foi possível interpretar o arquivo. Tente novamente.";
        try {
          const body = await res.json();
          if (typeof body?.error?.message === "string") msg = body.error.message;
        } catch {
          /* resposta sem corpo JSON: mantém a mensagem padrão */
        }
        setFileError(msg);
        setFileStatus("error");
        return; // em erro NÃO altera o bundle
      }

      const draft = (await res.json()) as ProfileBundle;
      setBundle((prev) => mergeDraft(prev, draft));
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFileStatus("idle");
      setImportOpen(false);
      touch(); // marca como alterado para o usuário revisar e salvar
    } catch {
      setFileError("Falha de conexão ao importar. Tente novamente.");
      setFileStatus("error");
    }
  }

  function headerErrorFor(key: string): string | undefined {
    return fieldErrors.find((e) => e.path === `profile.${key}`)?.message;
  }

  // Mapa de erros por caminho relativo da lista (`<prefix>.<idx>.<field>`),
  // consumido pelo ListSection para destacar campos.
  const errorMap: Record<string, string> = {};
  for (const e of fieldErrors) errorMap[e.path] = e.message;

  if (status === "loading") {
    return (
      <>
        <div className="page-head">
          <h1>Perfil</h1>
          <p className="sub">
            Esta é a sua base — a fonte da verdade que alimenta a geração. Tudo que aparece nos
            currículos sai daqui.
          </p>
        </div>
        <div aria-busy="true" aria-label="Carregando sua base">
          <div className="skel" style={{ height: 200, width: "100%", borderRadius: 14, marginBottom: 28 }} />
          <div className="skel" style={{ height: 120, width: "100%", borderRadius: 12, marginBottom: 14 }} />
          <div className="skel" style={{ height: 120, width: "100%", borderRadius: 12 }} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Perfil</h1>
        <p className="sub">
          Esta é a sua base — a fonte da verdade que alimenta a geração. Tudo que aparece nos
          currículos sai daqui.
        </p>
      </div>

      {isEmptyBase && (
        <div className="note note-accent" style={{ marginBottom: 26 }} role="status">
          <Icon name="info" />
          <div className="note-body">
            <p className="note-title">Sua base ainda está vazia</p>
            <p>Preencha o nome e ao menos uma experiência ou formação, depois salve.</p>
          </div>
        </div>
      )}

      {/* Importar com IA (US-11): cola um texto livre, a IA estrutura um rascunho que
          MESCLAMOS no formulário. Não persiste — o usuário revisa e usa o "Salvar". */}
      <section className="sec" style={{ marginTop: 0, marginBottom: 26 }} aria-labelledby="import-heading">
        <div className="sec-head2">
          <h2 id="import-heading">
            <span className="sec-ic">
              <Icon name="spark" />
            </span>
            Importar com IA
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setImportOpen((v) => !v)}
            aria-expanded={importOpen}
          >
            {importOpen ? "Recolher" : "Colar texto ou enviar arquivo"}
          </button>
        </div>

        {importOpen && (
          <div className="card" style={{ padding: 20 }}>
            <p className="sub" style={{ marginTop: 0 }}>
              Cole um texto (currículo antigo, perfil do LinkedIn, anotações) ou envie um arquivo
              (PDF, DOCX ou TXT). A IA estrutura essas informações no formulário abaixo para você
              revisar. Nada é salvo automaticamente, e a IA usa apenas o que está no conteúdo
              enviado — não inventa.
            </p>
            <div className="field">
              <label className="label" htmlFor="import-dump">
                Seu texto
              </label>
              <textarea
                id="import-dump"
                className="input"
                style={{ minHeight: 160 }}
                value={dumpText}
                placeholder="Cole aqui o texto com suas experiências, formação, habilidades…"
                onChange={(e) => setDumpText(e.target.value)}
                disabled={importStatus === "sending"}
              />
            </div>
            {importStatus === "error" && importError && (
              <div className="note note-danger" style={{ marginTop: 14 }} role="alert">
                <Icon name="alert" />
                <div className="note-body">
                  <p>{importError}</p>
                </div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importStatus === "sending" || dumpText.trim().length === 0}
              >
                {importStatus === "sending" ? "Preenchendo…" : "Preencher com IA"}
              </button>
              {importStatus === "sending" && (
                <span className="sb-status" role="status">
                  <span className="spin" /> Interpretando o texto…
                </span>
              )}
            </div>

            {/* Entrada por ARQUIVO (US-13): paralela à textarea, mesmo pipeline de IA. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "20px 0 16px",
                color: "var(--muted)",
                fontSize: 13,
              }}
              aria-hidden="true"
            >
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              ou
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <div className="field">
              <label className="label" htmlFor="import-file">
                Enviar um arquivo (PDF, DOCX ou TXT)
              </label>
              <input
                id="import-file"
                ref={fileInputRef}
                type="file"
                className="input"
                accept={IMPORT_FILE_ACCEPT}
                disabled={fileStatus === "sending"}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFileName(f ? f.name : null);
                  setFileError(null);
                  if (fileStatus === "error") setFileStatus("idle");
                }}
              />
            </div>
            {fileStatus === "error" && fileError && (
              <div className="note note-danger" style={{ marginTop: 14 }} role="alert">
                <Icon name="alert" />
                <div className="note-body">
                  <p>{fileError}</p>
                </div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const f = fileInputRef.current?.files?.[0];
                  if (f) void handleImportFile(f);
                }}
                disabled={fileStatus === "sending" || !fileName}
              >
                {fileStatus === "sending" ? "Enviando…" : "Enviar arquivo"}
              </button>
              {fileName && fileStatus !== "sending" && (
                <span className="sub" style={{ margin: 0 }}>
                  {fileName}
                </span>
              )}
              {fileStatus === "sending" && (
                <span className="sb-status" role="status">
                  <span className="spin" /> Lendo o arquivo e interpretando…
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Cabeçalho e resumo */}
      <section className="sec" style={{ marginTop: 0 }} aria-labelledby="cabecalho-heading">
        <div className="sec-head2">
          <h2 id="cabecalho-heading">
            <span className="sec-ic">
              <Icon name="user" />
            </span>
            Cabeçalho e resumo
          </h2>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="field-grid">
            {HEADER_FIELDS.map((f) => {
              const value = (bundle.profile[f.key] ?? "") as string;
              const err = headerErrorFor(f.key);
              const inputId = `field-${f.key}`;
              return (
                <div key={f.key} className={"field" + (f.span2 ? " span2" : "")}>
                  <label className="label" htmlFor={inputId}>
                    {f.label}
                    {f.required && <span className="req">*</span>}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      id={inputId}
                      className={"input" + (err ? " err" : "")}
                      value={value}
                      placeholder={f.placeholder}
                      onChange={(e) => updateProfile(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      id={inputId}
                      className={"input" + (err ? " err" : "")}
                      type={f.type ?? "text"}
                      value={value}
                      placeholder={f.placeholder}
                      onChange={(e) => updateProfile(f.key, e.target.value)}
                    />
                  )}
                  {err && (
                    <span className="help err" role="alert">
                      {err}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <ListSection<Experience>
        title="Experiência"
        icon="briefcase"
        singular="experiência"
        pathPrefix="experiences"
        emptyHint="Nenhuma experiência adicionada. Comece pela mais recente."
        items={bundle.experiences}
        fields={EXPERIENCE_FIELDS}
        makeEmpty={() => ({ company: "", role: "", startDate: "", current: false, bullets: [], order: 0 })}
        summarize={(e) => ({
          title: e.role,
          meta: [e.company, period(e.startDate, e.endDate, e.current)].filter(Boolean).join(" · "),
        })}
        onChange={(items) => updateList("experiences", items)}
        errors={errorMap}
      />

      <ListSection<Education>
        title="Formação"
        icon="cap"
        singular="formação"
        pathPrefix="educations"
        emptyHint="Nenhuma formação adicionada."
        items={bundle.educations}
        fields={EDUCATION_FIELDS}
        makeEmpty={() => ({ institution: "", degree: "", startDate: "", current: false, order: 0 })}
        summarize={(e) => ({
          title: [e.degree, e.field].filter(Boolean).join(", "),
          meta: [e.institution, period(e.startDate, e.endDate, e.current)].filter(Boolean).join(" · "),
        })}
        onChange={(items) => updateList("educations", items)}
        errors={errorMap}
      />

      <ListSection<Skill>
        title="Habilidades"
        icon="chip"
        singular="habilidade"
        pathPrefix="skills"
        emptyHint="Nenhuma habilidade adicionada. Agrupe por categoria."
        items={bundle.skills}
        fields={SKILL_FIELDS}
        makeEmpty={() => ({ category: "", name: "", order: 0 })}
        summarize={(s) => ({ title: s.name, meta: [s.category, s.level].filter(Boolean).join(" · ") })}
        onChange={(items) => updateList("skills", items)}
        errors={errorMap}
      />

      <ListSection<Project>
        title="Projetos"
        icon="folder"
        singular="projeto"
        pathPrefix="projects"
        emptyHint="Nenhum projeto adicionado."
        items={bundle.projects}
        fields={PROJECT_FIELDS}
        makeEmpty={() => ({ name: "", description: "", bullets: [], techStack: [], order: 0 })}
        summarize={(p) => ({ title: p.name, meta: (p.techStack ?? []).join(", ") })}
        onChange={(items) => updateList("projects", items)}
        errors={errorMap}
      />

      <ListSection<Language>
        title="Idiomas"
        icon="globe"
        singular="idioma"
        pathPrefix="languages"
        emptyHint="Nenhum idioma adicionado."
        items={bundle.languages}
        fields={LANGUAGE_FIELDS}
        makeEmpty={() => ({ name: "", proficiency: "", order: 0 })}
        summarize={(l) => ({ title: l.name, meta: l.proficiency })}
        onChange={(items) => updateList("languages", items)}
        errors={errorMap}
      />

      <ListSection<Course>
        title="Cursos / Certificações"
        icon="award"
        singular="certificação"
        pathPrefix="courses"
        emptyHint="Nenhum curso ou certificação adicionado."
        items={bundle.courses}
        fields={COURSE_FIELDS}
        makeEmpty={() => ({ title: "", issuer: "", date: "", order: 0 })}
        summarize={(c) => ({ title: c.title, meta: [c.issuer, c.date].filter(Boolean).join(" · ") })}
        onChange={(items) => updateList("courses", items)}
        errors={errorMap}
      />

      {/* Barra de salvar fixa */}
      <div className="savebar">
        <div className="left">
          {status === "error" ? (
            <span style={{ color: "var(--danger)" }}>
              {errorMsg ?? "Corrija os campos destacados antes de salvar."}
            </span>
          ) : (
            "Alterações são salvas na sua base local (fonte da verdade)."
          )}
        </div>
        {status === "saving" && (
          <span className="sb-status" role="status">
            <span className="spin" /> Salvando…
          </span>
        )}
        {status === "saved" && (
          <span className="badge badge-success" role="status">
            <Icon name="check" size={13} /> Salvo com sucesso
          </span>
        )}
        {status === "error" && (
          <span className="badge badge-danger">
            <Icon name="alert" size={13} /> Erro de validação
          </span>
        )}
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={status === "saving"}>
          {status === "saving" ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </>
  );
}

// Monta o período "Início – Fim" / "Início – Atual" para o meta do card (apenas UI).
function period(start?: string, end?: string, current?: boolean): string {
  if (!start) return "";
  if (current) return `${start} – Atual`;
  if (end) return `${start} – ${end}`;
  return start;
}

// MESCLA o rascunho do import (US-11) no bundle atual, sem perder nada:
// - as 6 listas: concatena (os itens do rascunho vão DEPOIS dos existentes);
// - o cabeçalho: cada campo só é preenchido se o atual estiver vazio (não sobrescreve).
function mergeDraft(current: ProfileBundle, draft: ProfileBundle): ProfileBundle {
  // Preenche um campo opcional do cabeçalho só quando o atual está vazio/ausente.
  const fillIfEmpty = (cur?: string, next?: string): string | undefined => {
    const c = (cur ?? "").trim();
    if (c) return cur;
    const n = (next ?? "").trim();
    return n ? next : cur;
  };

  const profile: Profile = {
    ...current.profile,
    fullName: current.profile.fullName.trim()
      ? current.profile.fullName
      : draft.profile.fullName ?? current.profile.fullName,
    phone: fillIfEmpty(current.profile.phone, draft.profile.phone),
    location: fillIfEmpty(current.profile.location, draft.profile.location),
    email: fillIfEmpty(current.profile.email, draft.profile.email),
    linkedin: fillIfEmpty(current.profile.linkedin, draft.profile.linkedin),
    github: fillIfEmpty(current.profile.github, draft.profile.github),
    website: fillIfEmpty(current.profile.website, draft.profile.website),
    summary: fillIfEmpty(current.profile.summary, draft.profile.summary),
  };

  return {
    profile,
    experiences: [...current.experiences, ...draft.experiences],
    educations: [...current.educations, ...draft.educations],
    skills: [...current.skills, ...draft.skills],
    projects: [...current.projects, ...draft.projects],
    languages: [...current.languages, ...draft.languages],
    courses: [...current.courses, ...draft.courses],
  };
}
