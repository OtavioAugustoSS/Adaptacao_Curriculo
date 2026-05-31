"use client";

// Tela /curriculos — histórico de currículos gerados (US-09 + Fatia 7).
// Lista os GeneratedResume do usuário (GET /api/resumes), do mais recente ao mais
// antigo. Por item: NOME editável (ADR-0021, default = rótulo do modo + data), data,
// nº de avisos do traceabilityReport, e ações: Ver/copiar o .tex (WS3, reusa TexCode +
// Copiar do padrão do /gerar), Baixar .tex (cache, sem nova chamada), Abrir no Overleaf
// (WS2), Renomear (PATCH) e Excluir (DELETE, com confirmação) — WS4.
//
// ADR-0016/0021: o histórico NÃO exibe o título/texto da vaga. O NOME é um rótulo do
// usuário (não a vaga) — não arranha o invariante anti-alucinação.
//
// O .tex (texOutput) já vem no GET /api/resumes — Ver/copiar não faz nova chamada.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GeneratedResume } from "@/lib/schemas";
import { Icon } from "@/components/Icon";
import { TexCode } from "@/components/TexCode";
import { resumeModeBadge, visibleWarnings, formatResumeDate } from "@/lib/presentation/resume-meta";
import { OVERLEAF_PROJECT_URL, OVERLEAF_BUTTON_LABEL } from "@/lib/overleaf";

type Status = "loading" | "error" | "ready";

export default function CurriculosPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [resumes, setResumes] = useState<GeneratedResume[]>([]);
  // Id do item cujo relatório de rastreabilidade está expandido (ou null).
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  // Id do item cujo .tex (Ver/copiar) está expandido (ou null).
  const [openTexId, setOpenTexId] = useState<string | null>(null);
  // Id do item cujo .tex acabou de ser copiado (feedback efêmero).
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Id do item em modo de renomear + o valor do campo.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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

  // WS3 — copia o .tex cacheado do item (mesmo padrão do handleCopy do /gerar).
  async function handleCopy(resume: GeneratedResume) {
    try {
      await navigator.clipboard.writeText(resume.texOutput);
      setCopiedId(resume.id);
      setTimeout(() => setCopiedId((cur) => (cur === resume.id ? null : cur)), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  // WS4 — abre o campo de renomear preenchido com o nome atual.
  function startRename(resume: GeneratedResume) {
    setRenamingId(resume.id);
    setRenameValue(resume.name);
  }

  // WS4 — confirma o rename (PATCH /api/resumes/[id]); no sucesso recarrega a lista.
  async function confirmRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/resumes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRenamingId(null);
      setRenameValue("");
      await load();
    } catch {
      // Mantém o campo aberto; o usuário pode tentar de novo. (Erro silencioso no MVP.)
    }
  }

  // ADR-0022 — define o currículo como padrão (PATCH { isDefault: true }); recarrega a
  // lista (o padrão anterior é desmarcado no servidor — no máx. um padrão por usuário).
  async function handleSetDefault(resume: GeneratedResume) {
    try {
      const res = await fetch(`/api/resumes/${resume.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch {
      // Erro silencioso no MVP; a lista permanece como está.
    }
  }

  // WS4 — exclui o item (DELETE /api/resumes/[id]) após confirmação; recarrega a lista.
  async function handleDelete(resume: GeneratedResume) {
    const ok = window.confirm(
      `Excluir "${resume.name}"? Esta ação é permanente e não pode ser desfeita.`,
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/resumes/${resume.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch {
      // Erro silencioso no MVP; a lista permanece como está.
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Meus currículos</h1>
        <p className="sub">
          Histórico dos currículos gerados. Veja/copie ou baixe o <span className="mono">.tex</span>{" "}
          cacheado sem gastar nova geração, renomeie, exclua e revise os avisos.
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
            const isReportOpen = openReportId === resume.id;
            const isTexOpen = openTexId === resume.id;
            const isRenaming = renamingId === resume.id;
            const isDefault = resume.isDefault;
            return (
              <article className={"cv-item" + (isDefault ? " is-default" : "")} key={resume.id}>
                <div className="cv-top">
                  <div className={"cv-emblem " + (adaptado ? "adaptado" : "padrao")}>
                    <Icon name="file" />
                    <span className="ext">.tex</span>
                  </div>
                  <div className="cv-info">
                    <div className="cv-title-row">
                      {isRenaming ? (
                        <input
                          className="input"
                          style={{ maxWidth: 360 }}
                          value={renameValue}
                          autoFocus
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void confirmRename(resume.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          aria-label="Novo nome do currículo"
                        />
                      ) : (
                        <span className="cv-title">{resume.name}</span>
                      )}
                      <span className={"badge " + (adaptado ? "badge-accent" : "badge-neutral")}>
                        <span className="dot" />
                        {resumeModeBadge(resume.mode)}
                      </span>
                      {isDefault && (
                        <span className="badge badge-default" title="Currículo padrão — base das adaptações à vaga">
                          <span className="star" aria-hidden="true">★</span> Padrão
                        </span>
                      )}
                    </div>
                    <div className="cv-date">
                      <Icon name="clock" /> {formatResumeDate(resume.createdAt)}
                    </div>
                  </div>
                  {isRenaming ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => void confirmRename(resume.id)}
                        disabled={renameValue.trim().length === 0}
                      >
                        <Icon name="check" /> Salvar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setRenamingId(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <a
                      className="btn btn-secondary btn-sm cv-dl"
                      href={`/api/resumes/${resume.id}/download`}
                      download
                    >
                      <Icon name="download" /> Baixar .tex
                    </a>
                  )}
                </div>

                {/* Ações de gestão (WS2/WS3/WS4). */}
                {!isRenaming && (
                  <div className="cv-actions" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      aria-expanded={isTexOpen}
                      onClick={() => setOpenTexId(isTexOpen ? null : resume.id)}
                    >
                      <Icon name="file" /> {isTexOpen ? "Ocultar" : "Ver / copiar"}
                    </button>
                    <a
                      className="btn btn-secondary btn-sm"
                      href={OVERLEAF_PROJECT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="ext" /> {OVERLEAF_BUTTON_LABEL}
                    </a>
                    {!isDefault && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleSetDefault(resume)}
                        title="Usar este como base das adaptações à vaga"
                      >
                        <span className="star" aria-hidden="true">★</span> Definir como padrão
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => startRename(resume)}>
                      <Icon name="copy" /> Renomear
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void handleDelete(resume)}
                    >
                      <Icon name="trash" /> Excluir
                    </button>
                  </div>
                )}

                {/* WS3 — bloco de .tex expansível com Copiar. */}
                {isTexOpen && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleCopy(resume)}>
                        {copiedId === resume.id ? (
                          <>
                            <Icon name="check" /> Copiado!
                          </>
                        ) : (
                          <>
                            <Icon name="copy" /> Copiar
                          </>
                        )}
                      </button>
                    </div>
                    <TexCode tex={resume.texOutput} />
                  </div>
                )}

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
                      aria-expanded={isReportOpen}
                      onClick={() => setOpenReportId(isReportOpen ? null : resume.id)}
                    >
                      <Icon name="alert" /> {warnings.length}{" "}
                      {warnings.length === 1 ? "aviso" : "avisos"} de rastreabilidade
                      <Icon name="down" size={13} className="chev" />
                    </button>
                  )}
                </div>

                {isReportOpen && warnings.length > 0 && (
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
