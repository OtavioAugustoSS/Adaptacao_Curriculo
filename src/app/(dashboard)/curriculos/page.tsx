"use client";

// Tela /curriculos — histórico de currículos gerados (US-09, spec §2.3).
// Lista os GeneratedResume do usuário (GET /api/resumes), do mais recente ao mais
// antigo. Por item: modo (Padrão / Adaptado à vaga), data, nº de avisos do
// traceabilityReport, botão "Baixar .tex" (reusa GET /api/resumes/[id]/download —
// SEM nova chamada ao LLM, é o .tex cacheado) e um toggle para ver o relatório de
// rastreabilidade. Estados: carregando, erro, vazio (CTA para /gerar), populado.
//
// ADR-0016: o histórico NÃO exibe o título/texto da vaga (exigiria denormalizar o
// contrato congelado) e não há exclusão de itens no MVP.

import { useEffect, useState } from "react";
import type { GeneratedResume } from "@/lib/schemas";

type Status = "loading" | "error" | "ready";

const MODE_LABEL: Record<GeneratedResume["mode"], string> = {
  STANDARD: "Currículo padrão",
  JOB_ADAPTIVE: "Adaptado à vaga",
};

function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CurriculosPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [resumes, setResumes] = useState<GeneratedResume[]>([]);
  // Id do item cujo relatório de rastreabilidade está expandido (ou null).
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/resumes");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as GeneratedResume[];
        if (!active) return;
        setResumes(data);
        setStatus("ready");
      } catch {
        if (!active) return;
        setStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <main style={styles.main}>
        <h1>Meus currículos</h1>
        <p>Carregando seu histórico…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main style={styles.main}>
        <h1>Meus currículos</h1>
        <div style={styles.errorBox} role="alert">
          Não foi possível carregar o histórico. Recarregue a página para tentar de novo.
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <h1>Meus currículos</h1>
      <p style={styles.subtitle}>
        Histórico dos currículos que você gerou. Baixe o <code>.tex</code> cacheado
        sem gastar uma nova geração e revise os avisos de rastreabilidade.
      </p>

      {resumes.length === 0 ? (
        <div style={styles.emptyBox} role="status">
          <p style={{ marginTop: 0 }}>Você ainda não gerou nenhum currículo.</p>
          <a href="/gerar" style={styles.cta}>
            Gerar meu primeiro currículo
          </a>
        </div>
      ) : (
        <ul style={styles.list}>
          {resumes.map((resume) => {
            const warnings = resume.traceabilityReport?.warnings ?? [];
            const evaluated = resume.traceabilityReport != null;
            const isOpen = openReportId === resume.id;
            return (
              <li key={resume.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <span style={styles.modeBadge}>{MODE_LABEL[resume.mode]}</span>
                    <span style={styles.date}>{formatDate(resume.createdAt)}</span>
                  </div>
                  <a
                    href={`/api/resumes/${resume.id}/download`}
                    style={styles.downloadLink}
                    download
                  >
                    Baixar .tex
                  </a>
                </div>

                <div style={styles.cardMeta}>
                  {!evaluated ? (
                    <span style={styles.muted}>Sem relatório de rastreabilidade.</span>
                  ) : warnings.length === 0 ? (
                    <span style={styles.okBadge}>Sem avisos de rastreabilidade</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenReportId(isOpen ? null : resume.id)}
                      style={styles.reportToggle}
                      aria-expanded={isOpen}
                    >
                      {warnings.length}{" "}
                      {warnings.length === 1 ? "aviso" : "avisos"} de rastreabilidade
                      {isOpen ? " ▲" : " ▼"}
                    </button>
                  )}
                </div>

                {isOpen && warnings.length > 0 && (
                  <div style={styles.warningsBox}>
                    <p style={styles.warningsHint}>
                      A IA usou apenas itens da sua base; estes pontos merecem revisão
                      antes de enviar.
                    </p>
                    <ul style={styles.warningsList}>
                      {warnings.map((w, i) => (
                        <li key={i}>
                          <code>{w.value}</code> — {w.reason}{" "}
                          <span style={styles.muted}>({w.field})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 820, margin: "0 auto" },
  subtitle: { color: "#555", marginTop: "-0.25rem" },
  list: { listStyle: "none", padding: 0, margin: "1.5rem 0 0", display: "flex", flexDirection: "column", gap: "1rem" },
  card: {
    border: "1px solid #e2e2e2",
    borderRadius: 10,
    padding: "1rem 1.25rem",
    background: "#fff",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    flexWrap: "wrap",
  },
  modeBadge: {
    display: "inline-block",
    padding: "0.2rem 0.6rem",
    background: "#eaf0ff",
    color: "#1a5cff",
    borderRadius: 999,
    fontSize: "0.8rem",
    fontWeight: 600,
    marginRight: "0.75rem",
  },
  date: { color: "#555", fontSize: "0.85rem" },
  cardMeta: { marginTop: "0.75rem", fontSize: "0.85rem" },
  okBadge: { color: "#1a7f37" },
  reportToggle: {
    background: "none",
    border: "none",
    color: "#7a5b00",
    fontSize: "0.85rem",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  },
  downloadLink: {
    padding: "0.4rem 0.9rem",
    background: "#1a5cff",
    color: "#fff",
    borderRadius: 6,
    fontSize: "0.85rem",
    textDecoration: "none",
  },
  muted: { color: "#777" },
  emptyBox: {
    marginTop: "1.5rem",
    padding: "1.5rem",
    background: "#f7f9ff",
    border: "1px dashed #b9c8ff",
    borderRadius: 10,
    textAlign: "center",
  },
  cta: {
    display: "inline-block",
    padding: "0.6rem 1.25rem",
    background: "#1a5cff",
    color: "#fff",
    borderRadius: 8,
    fontSize: "0.95rem",
    textDecoration: "none",
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
    marginTop: "0.75rem",
    padding: "0.75rem 1rem",
    background: "#fff7e6",
    border: "1px solid #ffe0a3",
    borderRadius: 8,
    fontSize: "0.85rem",
  },
  warningsHint: { margin: "0 0 0.5rem", color: "#7a5b00" },
  warningsList: { margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" },
};
