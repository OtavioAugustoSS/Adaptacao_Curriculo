"use client";

// Tela /gerar — gerador de currículo (US-05/US-06/US-08, spec §2.2).
// Cobre os dois modos:
//   - Modo 1 (STANDARD): botão "Gerar currículo padrão" — currículo geral da base.
//   - Modo 2 (JOB_ADAPTIVE, US-08): textarea para colar a vaga + botão "Adaptar à
//     vaga" — a IA prioriza/reordena/reescreve só itens reais da base que casam com a
//     vaga e OMITE o que falta (nunca inventa).
// Os dois compartilham os mesmos estados (validando/gerando/preview/erro/avisos); só
// muda o insumo enviado ao POST. Um seletor de modo deixa claro qual está ativo.
//
// Pré-requisito: checamos a base (GET /api/profile) só para ORIENTAR/habilitar os
// botões no cliente; a fonte da verdade é o servidor (422 PREREQUISITE_NOT_MET).
// Não duplicamos a regra de negócio aqui — apenas espelhamos o ADR-0014 para UX.
//
// Fatia 4 (US-10): só a camada visual mudou — Tailwind + componentes do DS. O .tex do
// preview é o real (resume.texOutput); os avisos vêm de traceabilityReport.warnings
// (campos reais value/reason/field) em qualquer modo. `errors` nunca aparecem aqui.

import { useEffect, useState } from "react";
import type { ProfileBundle, GeneratedResume } from "@/lib/schemas";
import { Icon } from "@/components/Icon";
import { TexCode } from "@/components/TexCode";
import { visibleWarnings } from "@/lib/presentation/resume-meta";
import { OVERLEAF_TEMPLATE_URL, OVERLEAF_BUTTON_LABEL, OVERLEAF_FLOW_HINT } from "@/lib/overleaf";

// Estados da tela (spec §2.2): ocioso, validando pré-requisito, gerando (loading),
// preview, erro (com retry).
type Status = "validating" | "idle" | "generating" | "preview" | "error";

// Modo ativo na tela. STANDARD = Modo 1; JOB_ADAPTIVE = Modo 2 (adaptativo à vaga).
type Mode = "STANDARD" | "JOB_ADAPTIVE";

export default function GerarPage() {
  const [status, setStatus] = useState<Status>("validating");
  const [canGenerate, setCanGenerate] = useState(false);
  const [mode, setMode] = useState<Mode>("STANDARD");
  const [jobText, setJobText] = useState("");
  const [name, setName] = useState("");
  // Currículos do usuário (para o seletor de base no Modo 2 — ADR-0022) + o id escolhido.
  const [resumes, setResumes] = useState<GeneratedResume[]>([]);
  const [baseResumeId, setBaseResumeId] = useState<string>("");
  const [resume, setResume] = useState<GeneratedResume | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Ao montar: lê a base e decide se o pré-requisito (ADR-0014) está atendido,
  // só para habilitar/orientar. O servidor revalida ao gerar.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Base (pré-requisito) + currículos (seletor de base do Modo 2) em paralelo.
        const [profileRes, resumesRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/resumes"),
        ]);
        if (!profileRes.ok) throw new Error(`HTTP ${profileRes.status}`);
        const bundle = (await profileRes.json()) as ProfileBundle;
        if (!active) return;
        const ok =
          bundle.profile.fullName.trim().length > 0 &&
          (bundle.experiences.length > 0 || bundle.educations.length > 0);
        setCanGenerate(ok);

        // Currículos para basear a adaptação: pré-seleciona o padrão (ou o STANDARD mais
        // recente). Falha ao listar não impede gerar — só esvazia o seletor (fallback no
        // servidor deriva da base).
        if (resumesRes.ok) {
          const list = (await resumesRes.json()) as GeneratedResume[];
          if (!active) return;
          setResumes(list);
          const standards = list.filter((r) => r.mode === "STANDARD");
          const def = standards.find((r) => r.isDefault) ?? standards[0];
          if (def) setBaseResumeId(def.id);
        }

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

  // Currículos STANDARD são os candidatos a base (os "completos"). O selecionado é o "em uso".
  const standardResumes = resumes.filter((r) => r.mode === "STANDARD");
  const selectedBase = standardResumes.find((r) => r.id === baseResumeId) ?? null;

  // No Modo 2 também é preciso ter colado a vaga (espelha o refine do contrato).
  const jobTextFilled = jobText.trim().length > 0;
  const canSubmit =
    canGenerate && status !== "generating" && (mode === "STANDARD" || jobTextFilled);

  async function handleGenerate() {
    setErrorMsg(null);
    setCopied(false);
    setStatus("generating");
    try {
      // Nome opcional: só vai no corpo se preenchido (ADR-0021 — senão default no servidor).
      const trimmedName = name.trim();
      const payload: { mode: Mode; jobText?: string; name?: string; baseResumeId?: string } =
        mode === "JOB_ADAPTIVE" ? { mode: "JOB_ADAPTIVE", jobText } : { mode: "STANDARD" };
      if (trimmedName) payload.name = trimmedName;
      // Modo 2: base da adaptação (ADR-0022). Vazio → servidor usa o padrão/fallback.
      if (mode === "JOB_ADAPTIVE" && baseResumeId) payload.baseResumeId = baseResumeId;

      const res = await fetch("/api/resumes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const generating = status === "generating";

  return (
    <>
      <div className="page-head">
        <h1>Gerar currículo</h1>
        <p className="sub">
          A IA monta um currículo usando apenas itens reais da sua base — nunca inventa. A saída é
          um arquivo <span className="mono">.tex</span> para compilar no Overleaf.
        </p>
      </div>

      {/* Validando pré-requisitos: skeleton de preview. */}
      {status === "validating" && (
        <div aria-busy="true" aria-label="Verificando sua base">
          <div className="skel" style={{ height: 44, width: 280, borderRadius: 10, marginBottom: 16 }} />
          <div className="skel" style={{ height: 16, width: "60%", borderRadius: 6, marginBottom: 28 }} />
          <div className="skel" style={{ height: 300, width: "100%", borderRadius: 10 }} />
        </div>
      )}

      {status !== "validating" && (
        <>
          {/* Base insuficiente. */}
          {!canGenerate && (
            <div className="note note-warning" style={{ marginBottom: 24 }}>
              <Icon name="alert" />
              <div className="note-body">
                <p className="note-title">Base insuficiente</p>
                <p>
                  Sua base ainda não atende ao mínimo: preencha o nome e ao menos uma experiência ou
                  formação em <a href="/perfil">Perfil</a>.
                </p>
              </div>
            </div>
          )}

          {/* Seletor de modo (Modo 1 x Modo 2). */}
          <div className="tabs" role="tablist" aria-label="Modo de geração">
            <button
              type="button"
              className="tab"
              role="tab"
              aria-selected={mode === "STANDARD"}
              onClick={() => setMode("STANDARD")}
              disabled={generating}
            >
              <Icon name="file" /> Currículo padrão
            </button>
            <button
              type="button"
              className="tab"
              role="tab"
              aria-selected={mode === "JOB_ADAPTIVE"}
              onClick={() => setMode("JOB_ADAPTIVE")}
              disabled={generating}
            >
              <Icon name="spark" /> Adaptar à vaga
            </button>
          </div>
          <p className="gen-mode-hint">
            {mode === "STANDARD"
              ? "Gera um currículo completo a partir de toda a sua base, sem foco em uma vaga específica."
              : "Reordena e prioriza os itens da sua base de acordo com a vaga — sem inventar nada."}
          </p>

          {/* Modo 2: seletor do currículo base (referência de profundidade — ADR-0022). */}
          {mode === "JOB_ADAPTIVE" && (
            <div className="gen-block">
              {standardResumes.length > 0 ? (
                <div className="field">
                  <label className="label" htmlFor="baseResume">
                    Basear no currículo padrão
                  </label>
                  <select
                    id="baseResume"
                    className="input"
                    value={baseResumeId}
                    onChange={(e) => setBaseResumeId(e.target.value)}
                    disabled={generating}
                  >
                    {standardResumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {(r.isDefault ? "★ " : "") + r.name + (r.isDefault ? " (padrão)" : "")}
                      </option>
                    ))}
                  </select>
                  <span className="help">
                    A IA usa este currículo como <strong>referência de profundidade</strong> e o adapta à
                    vaga — mantém a riqueza (projetos, bullets e stack), sem inventar nada.
                  </span>
                  {selectedBase && (
                    <div className="base-inuse">
                      <Icon name="check" /> Em uso: <strong>{selectedBase.name}</strong>
                      {selectedBase.isDefault && (
                        <span className="badge badge-default">
                          <span className="star" aria-hidden="true">★</span> Padrão
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="note note-accent">
                  <Icon name="spark" />
                  <div className="note-body">
                    <p className="note-title">Sem currículo base ainda</p>
                    <p>
                      Gere primeiro um <strong>Currículo padrão</strong> (modo ao lado) para servir de base.
                      Sem ele, a adaptação ainda funciona — a IA deriva direto da sua base.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modo 2: campo grande para colar a vaga. */}
          {mode === "JOB_ADAPTIVE" && (
            <div className="gen-block">
              <div className="field">
                <label className="label" htmlFor="jobText">
                  Texto da vaga
                </label>
                <textarea
                  id="jobText"
                  className="input"
                  style={{ minHeight: 280 }}
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  disabled={generating}
                  placeholder="Cole aqui a descrição completa da vaga (responsabilidades, requisitos, etc.)."
                />
                <span className="help">Cole a descrição da vaga para habilitar a adaptação.</span>
              </div>
            </div>
          )}

          {/* Nome opcional do currículo (ADR-0021). Vazio → default no servidor. */}
          <div className="gen-block">
            <div className="field">
              <label className="label" htmlFor="resumeName">
                Nome do currículo <span className="muted">(opcional)</span>
              </label>
              <input
                id="resumeName"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={generating}
                placeholder="Ex.: Currículo para vaga de Backend — Acme"
              />
              <span className="help">
                Se deixar em branco, usamos um nome padrão com o modo e a data.
              </span>
            </div>
          </div>

          {/* Ações. */}
          <div className="gen-actions">
            {generating ? (
              <>
                <button type="button" className="btn btn-primary btn-lg" disabled>
                  <span className="spin" /> Gerando…
                </button>
                <span className="muted" role="status">
                  Chamando a IA — pode levar alguns segundos.
                </span>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={!canSubmit}
                onClick={handleGenerate}
              >
                <Icon name="spark" /> {mode === "JOB_ADAPTIVE" ? "Adaptar à vaga" : "Gerar currículo padrão"}
              </button>
            )}
            {mode === "JOB_ADAPTIVE" && !jobTextFilled && canGenerate && !generating && (
              <span className="muted">Cole a vaga para habilitar.</span>
            )}
          </div>

          {/* Erro do LLM. */}
          {status === "error" && errorMsg && (
            <div className="note note-danger" style={{ marginTop: 24 }} role="alert">
              <Icon name="alert" />
              <div className="note-body">
                <p className="note-title">Não foi possível gerar o currículo</p>
                <p>{errorMsg} Sua base está intacta — tente novamente em alguns instantes.</p>
                <div style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleGenerate}>
                    <Icon name="retry" /> Tentar novamente
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preview do resultado. */}
          {status === "preview" && resume && (
            <section className="preview" aria-labelledby="preview-heading">
              <div className="preview-head">
                <h2 id="preview-heading">
                  <Icon name="file" /> {resume.name} (.tex)
                </h2>
                <div className="preview-actions">
                  <button type="button" className="btn btn-secondary" onClick={handleCopy}>
                    {copied ? (
                      <>
                        <Icon name="check" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Icon name="copy" /> Copiar
                      </>
                    )}
                  </button>
                  <a className="btn btn-primary" href={`/api/resumes/${resume.id}/download`} download>
                    <Icon name="download" /> Baixar .tex
                  </a>
                  <a
                    className="btn btn-secondary"
                    href={OVERLEAF_TEMPLATE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="ext" /> {OVERLEAF_BUTTON_LABEL}
                  </a>
                </div>
              </div>
              <p className="gen-mode-hint" style={{ marginTop: 8 }}>
                {OVERLEAF_FLOW_HINT} Assim o template já traz o <span className="mono">resume.cls</span>{" "}
                necessário para compilar o PDF.
              </p>

              {/* Avisos de rastreabilidade — em qualquer modo, só warnings (errors nunca). */}
              {visibleWarnings(resume.traceabilityReport).length > 0 && (
                <div className="avisos">
                  <div className="note note-warning">
                    <Icon name="alert" />
                    <div className="note-body">
                      <p className="note-title">
                        {visibleWarnings(resume.traceabilityReport).length}{" "}
                        {visibleWarnings(resume.traceabilityReport).length === 1
                          ? "item a revisar"
                          : "itens a revisar"}
                      </p>
                      <p>
                        A IA reescreveu e condensou alguns trechos. Nada foi inventado — confira se
                        cada ajuste reflete a realidade antes de enviar.
                      </p>
                      <ul className="aviso-list">
                        {visibleWarnings(resume.traceabilityReport).map((w, i) => (
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

              <TexCode tex={resume.texOutput} />
            </section>
          )}
        </>
      )}
    </>
  );
}
