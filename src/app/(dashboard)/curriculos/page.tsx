"use client";

// Tela /curriculos — histórico de currículos gerados (US-09, spec §2.3).
// Lista os GeneratedResume do usuário (GET /api/resumes), do mais recente ao mais
// antigo. Por item: rótulo do modo (ADR-0016), data, nº de avisos do
// traceabilityReport, botão "Baixar .tex" (reusa GET /api/resumes/[id]/download —
// SEM nova chamada ao LLM, é o .tex cacheado) e um toggle para ver o relatório de
// rastreabilidade. Estados: carregando, erro (retry), vazio (CTA para /gerar), populado.
//
// ADR-0016: o histórico NÃO exibe o título/texto da vaga (exigiria denormalizar o
// contrato congelado). O título do card é SEMPRE o rótulo do modo.
//
// Fatia 4 (US-10): só a camada visual mudou — Tailwind + componentes do DS (cards,
// emblema por modo, avisos expansíveis). A leitura e o contrato congelado seguem iguais.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GeneratedResume } from "@/lib/schemas";
import { Icon } from "@/components/Icon";
import {
  resumeModeLabel,
  resumeModeBadge,
  visibleWarnings,
  formatResumeDate,
} from "@/lib/presentation/resume-meta";

type Status = "loading" | "error" | "ready";

export default function CurriculosPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [resumes, setResumes] = useState<GeneratedResume[]>([]);
  // Id do item cujo relatório de rastreabilidade está expandido (ou null).
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/resumes");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GeneratedResume[];
      setResumes(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <h1>Meus currículos</h1>
        <p className="sub">
          Histórico dos currículos gerados. Baixe o <span className="mono">.tex</span> cacheado sem
          gastar nova geração e revise os avisos.
        </p>
      </div>

      {status === "loading" && (
        <div className="cv-list" aria-busy="true" aria-label="Carregando histórico">
          {[0, 1, 2].map((i) => (
            <div className="cv-item" key={i} style={{ padding: "16px 18px" }}>
              <div className="skel" style={{ height: 18, width: "45%", borderRadius: 6, marginBottom: 10 }} />
              <div className="skel" style={{ height: 13, width: "30%", borderRadius: 6 }} />
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="note note-danger" role="alert">
          <Icon name="alert" />
          <div className="note-body">
            <p className="note-title">Não foi possível carregar o histórico</p>
            <p>Houve uma falha ao buscar seus currículos. Tente novamente em instantes.</p>
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
                <Icon name="retry" /> Tentar novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {status === "ready" && resumes.length === 0 && (
        <div className="empty-state">
          <div className="ic">
            <Icon name="files" />
          </div>
          <h3>Nenhum currículo ainda</h3>
          <p>Você ainda não gerou nenhum currículo. Gere o primeiro a partir da sua base.</p>
          <Link className="btn btn-primary" href="/gerar" style={{ textDecoration: "none" }}>
            <Icon name="spark" /> Gerar meu primeiro currículo
          </Link>
        </div>
      )}

      {status === "ready" && resumes.length > 0 && (
        <div className="cv-list">
          {resumes.map((resume) => {
            const warnings = visibleWarnings(resume.traceabilityReport);
            const adaptado = resume.mode === "JOB_ADAPTIVE";
            const isOpen = openReportId === resume.id;
            return (
              <article className="cv-item" key={resume.id}>
                <div className="cv-top">
                  <div className={"cv-emblem " + (adaptado ? "adaptado" : "padrao")}>
                    <Icon name="file" />
                    <span className="ext">.tex</span>
                  </div>
                  <div className="cv-info">
                    <div className="cv-title-row">
                      <span className="cv-title">{resumeModeLabel(resume.mode)}</span>
                      <span className={"badge " + (adaptado ? "badge-accent" : "badge-neutral")}>
                        <span className="dot" />
                        {resumeModeBadge(resume.mode)}
                      </span>
                    </div>
                    <div className="cv-date">
                      <Icon name="clock" /> {formatResumeDate(resume.createdAt)}
                    </div>
                  </div>
                  <a
                    className="btn btn-secondary btn-sm cv-dl"
                    href={`/api/resumes/${resume.id}/download`}
                    download
                  >
                    <Icon name="download" /> Baixar .tex
                  </a>
                </div>

                <div className="cv-meta">
                  <span className="cv-src">
                    <Icon name="cap" /> template faangpath · pronto para o Overleaf
                  </span>
                  {warnings.length === 0 ? (
                    <span className="cv-clean">
                      <Icon name="check" /> Sem avisos de rastreabilidade
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="cv-warnbtn"
                      aria-expanded={isOpen}
                      onClick={() => setOpenReportId(isOpen ? null : resume.id)}
                    >
                      <Icon name="alert" /> {warnings.length}{" "}
                      {warnings.length === 1 ? "aviso" : "avisos"} de rastreabilidade
                      <Icon name="down" size={13} className="chev" />
                    </button>
                  )}
                </div>

                {isOpen && warnings.length > 0 && (
                  <div className="cv-avisos">
                    <div className="note note-warning">
                      <Icon name="alert" />
                      <div className="note-body">
                        <p className="note-title">Itens a revisar</p>
                        <p>
                          A IA reescreveu ou condensou estes trechos. Nada foi inventado — confira
                          antes de enviar.
                        </p>
                        <ul className="aviso-list">
                          {warnings.map((w, i) => (
                            <li className="aviso" key={i}>
                              <span className="av-num">{String(i + 1).padStart(2, "0")}</span>
                              <div>
                                <span className="av-val">{w.value}</span>
                                <p className="av-reason">{w.reason}</p>
                                <div className="av-field">{w.field}</div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
