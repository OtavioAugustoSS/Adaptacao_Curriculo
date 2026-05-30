"use client";

// Tela /gerar — gerador de currículo (US-05/US-06, spec §2.2).
// Esta fatia cobre o Modo 1 (currículo padrão): botão "Gerar currículo padrão",
// pré-requisito da base, loading durante a chamada ao LLM, e preview do `.tex`
// com Copiar + Baixar. O Modo 2 (adaptativo à vaga) entra na US-08.
//
// Pré-requisito: checamos a base (GET /api/profile) só para ORIENTAR/habilitar o
// botão no cliente; a fonte da verdade é o servidor (422 PREREQUISITE_NOT_MET).
// Não duplicamos a regra de negócio aqui — apenas espelhamos o ADR-0014 para UX.

import { useEffect, useState } from "react";
import type { ProfileBundle, GeneratedResume } from "@/lib/schemas";

// Estados da tela (spec §2.2): ocioso, validando pré-requisito, gerando (loading),
// preview, erro (com retry).
type Status = "validating" | "idle" | "generating" | "preview" | "error";

export default function GerarPage() {
  const [status, setStatus] = useState<Status>("validating");
  const [canGenerate, setCanGenerate] = useState(false);
  const [resume, setResume] = useState<GeneratedResume | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Ao montar: lê a base e decide se o pré-requisito (ADR-0014) está atendido,
  // só para habilitar/orientar. O servidor revalida ao gerar.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bundle = (await res.json()) as ProfileBundle;
        if (!active) return;
        const ok =
          bundle.profile.fullName.trim().length > 0 &&
          (bundle.experiences.length > 0 || bundle.educations.length > 0);
        setCanGenerate(ok);
        setStatus("idle");
      } catch {
        if (!active) return;
        setCanGenerate(false);
        setStatus("idle");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleGenerate() {
    setErrorMsg(null);
    setCopied(false);
    setStatus("generating");
    try {
      const res = await fetch("/api/resumes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "STANDARD" }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.error?.message ?? `Falha ao gerar (HTTP ${res.status}).`;
        setErrorMsg(message);
        setStatus("error");
        return;
      }

      const data = (await res.json()) as GeneratedResume;
      setResume(data);
      setStatus("preview");
    } catch {
      setErrorMsg("Não foi possível contatar o servidor. Tente novamente.");
      setStatus("error");
    }
  }

  async function handleCopy() {
    if (!resume) return;
    try {
      await navigator.clipboard.writeText(resume.texOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (status === "validating") {
    return (
      <main style={styles.main}>
        <h1>Gerar currículo</h1>
        <p>Verificando sua base de dados…</p>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <h1>Gerar currículo</h1>
      <p style={styles.subtitle}>
        Modo padrão: a IA monta um currículo geral usando apenas itens reais da sua
        base. A saída é um arquivo <code>.tex</code> para compilar no Overleaf.
      </p>

      {!canGenerate && (
        <div style={styles.warningCta} role="status">
          Sua base ainda não atende ao mínimo para gerar: preencha o nome e ao menos
          uma experiência ou formação em <strong>Perfil</strong>.
        </div>
      )}

      <div style={styles.actions}>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || status === "generating"}
          style={{
            ...styles.primaryButton,
            ...(!canGenerate || status === "generating" ? styles.buttonDisabled : {}),
          }}
        >
          {status === "generating" ? "Gerando…" : "Gerar currículo padrão"}
        </button>

        {status === "generating" && (
          <span role="status" style={styles.muted}>
            Chamando a IA — isso pode levar alguns segundos.
          </span>
        )}
      </div>

      {status === "error" && errorMsg && (
        <div style={styles.errorBox} role="alert">
          <p style={{ margin: 0 }}>{errorMsg}</p>
          <button type="button" onClick={handleGenerate} style={styles.retryButton}>
            Tentar novamente
          </button>
        </div>
      )}

      {status === "preview" && resume && (
        <section aria-labelledby="preview-heading" style={styles.previewSection}>
          <div style={styles.previewHeader}>
            <h2 id="preview-heading" style={styles.h2}>
              Currículo gerado (.tex)
            </h2>
            <div style={styles.previewButtons}>
              <button type="button" onClick={handleCopy} style={styles.secondaryButton}>
                {copied ? "Copiado!" : "Copiar"}
              </button>
              <a
                href={`/api/resumes/${resume.id}/download`}
                style={styles.downloadLink}
                download
              >
                Baixar .tex
              </a>
            </div>
          </div>
          {resume.traceabilityReport &&
            resume.traceabilityReport.warnings.length > 0 && (
              <div style={styles.warningsBox} role="status">
                <strong>Avisos de rastreabilidade</strong>
                <p style={styles.warningsHint}>
                  A IA usou apenas itens da sua base, mas estes pontos merecem
                  revisão — confira se números/itens conferem antes de enviar.
                </p>
                <ul style={styles.warningsList}>
                  {resume.traceabilityReport.warnings.map((w, i) => (
                    <li key={i}>
                      <code>{w.value}</code> — {w.reason}{" "}
                      <span style={styles.muted}>({w.field})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          <pre style={styles.codeBlock}>
            <code>{resume.texOutput}</code>
          </pre>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 820, margin: "0 auto" },
  subtitle: { color: "#555", marginTop: "-0.25rem" },
  h2: { fontSize: "1.15rem", margin: 0 },
  actions: { display: "flex", alignItems: "center", gap: "1rem", marginTop: "1.5rem" },
  primaryButton: {
    padding: "0.6rem 1.25rem",
    background: "#1a5cff",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: "0.95rem",
    cursor: "pointer",
  },
  buttonDisabled: { background: "#9bb6ff", cursor: "not-allowed" },
  secondaryButton: {
    padding: "0.4rem 0.9rem",
    background: "#fff",
    color: "#1a5cff",
    border: "1px solid #1a5cff",
    borderRadius: 6,
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  downloadLink: {
    padding: "0.4rem 0.9rem",
    background: "#1a5cff",
    color: "#fff",
    borderRadius: 6,
    fontSize: "0.85rem",
    textDecoration: "none",
  },
  retryButton: {
    marginTop: "0.5rem",
    padding: "0.4rem 0.9rem",
    background: "#c0392b",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  muted: { color: "#777", fontSize: "0.9rem" },
  warningCta: {
    marginTop: "1rem",
    padding: "0.75rem 1rem",
    background: "#fff7e6",
    border: "1px solid #ffe0a3",
    borderRadius: 8,
    fontSize: "0.9rem",
  },
  errorBox: {
    marginTop: "1.5rem",
    padding: "0.75rem 1rem",
    background: "#fdecea",
    border: "1px solid #f5c2bb",
    borderRadius: 8,
    fontSize: "0.9rem",
    color: "#a02118",
  },
  warningsBox: {
    marginTop: "1rem",
    padding: "0.75rem 1rem",
    background: "#fff7e6",
    border: "1px solid #ffe0a3",
    borderRadius: 8,
    fontSize: "0.9rem",
  },
  warningsHint: { margin: "0.25rem 0 0.5rem", color: "#7a5b00" },
  warningsList: { margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" },
  previewSection: { marginTop: "2rem" },
  previewHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    flexWrap: "wrap",
  },
  previewButtons: { display: "flex", alignItems: "center", gap: "0.5rem" },
  codeBlock: {
    marginTop: "0.75rem",
    padding: "1rem",
    background: "#0d1117",
    color: "#e6edf3",
    borderRadius: 8,
    fontSize: "0.8rem",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    overflowX: "auto",
    maxHeight: 520,
    whiteSpace: "pre",
  },
};
