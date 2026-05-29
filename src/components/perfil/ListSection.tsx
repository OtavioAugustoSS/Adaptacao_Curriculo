"use client";

// Editor genérico de uma seção de lista da base (US-03): adicionar, editar,
// remover e reordenar (mover para cima/baixo) itens. A ordem na tela = ordem do
// array; o repositório reindexa `order` pela posição ao salvar.
//
// Cada seção declara seus campos via FieldDef; este componente não conhece o
// domínio específico, só renderiza inputs e devolve o array atualizado ao pai.

import type { CSSProperties } from "react";

export interface FieldDef<T> {
  key: keyof T;
  label: string;
  type?: "text" | "url" | "textarea" | "list" | "boolean";
  placeholder?: string;
  required?: boolean;
}

interface ListSectionProps<T> {
  title: string;
  /** Texto curto do CTA quando a lista está vazia. */
  emptyHint: string;
  items: T[];
  fields: FieldDef<T>[];
  /** Cria um novo item em branco (com defaults do schema). */
  makeEmpty: () => T;
  /** Resumo curto de um item para o cabeçalho do card (ex.: empresa — cargo). */
  summarize: (item: T) => string;
  onChange: (items: T[]) => void;
}

export function ListSection<T extends Record<string, unknown>>({
  title,
  emptyHint,
  items,
  fields,
  makeEmpty,
  summarize,
  onChange,
}: ListSectionProps<T>) {
  function update(index: number, patch: Partial<T>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function add() {
    onChange([...items, makeEmpty()]);
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <section style={styles.section} aria-label={title}>
      <div style={styles.header}>
        <h2 style={styles.h2}>{title}</h2>
        <button type="button" onClick={add} style={styles.addBtn}>
          + Adicionar
        </button>
      </div>

      {items.length === 0 ? (
        <p style={styles.empty}>{emptyHint}</p>
      ) : (
        <ul style={styles.list}>
          {items.map((item, index) => (
            <li key={index} style={styles.card}>
              <div style={styles.cardHeader}>
                <strong style={styles.cardTitle}>
                  {summarize(item) || `Item ${index + 1}`}
                </strong>
                <div style={styles.cardActions}>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover para cima"
                    style={styles.iconBtn}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Mover para baixo"
                    style={styles.iconBtn}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label="Remover item"
                    style={{ ...styles.iconBtn, ...styles.removeBtn }}
                  >
                    Remover
                  </button>
                </div>
              </div>

              <div style={styles.fields}>
                {fields.map((f) => (
                  <Field
                    key={String(f.key)}
                    def={f}
                    value={item[f.key]}
                    onChange={(v) => update(index, { [f.key]: v } as Partial<T>)}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field<T>({
  def,
  value,
  onChange,
}: {
  def: FieldDef<T>;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `f-${String(def.key)}-${Math.random().toString(36).slice(2, 7)}`;

  if (def.type === "boolean") {
    return (
      <label style={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {def.label}
      </label>
    );
  }

  if (def.type === "list") {
    // string[] editado como textarea (uma linha por item); vazio -> [].
    const text = Array.isArray(value) ? (value as string[]).join("\n") : "";
    return (
      <div style={styles.field}>
        <label htmlFor={id} style={styles.label}>
          {def.label} <span style={styles.hint}>(um por linha)</span>
        </label>
        <textarea
          id={id}
          rows={3}
          value={text}
          placeholder={def.placeholder}
          onChange={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter((s) => s.length > 0),
            )
          }
          style={styles.input}
        />
      </div>
    );
  }

  const strValue = typeof value === "string" ? value : "";
  return (
    <div style={styles.field}>
      <label htmlFor={id} style={styles.label}>
        {def.label}
        {def.required ? <span style={styles.required}> *</span> : null}
      </label>
      {def.type === "textarea" ? (
        <textarea
          id={id}
          rows={3}
          value={strValue}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={styles.input}
        />
      ) : (
        <input
          id={id}
          type={def.type === "url" ? "url" : "text"}
          value={strValue}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={styles.input}
        />
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  section: { marginTop: "2rem", borderTop: "1px solid #eee", paddingTop: "1.25rem" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  h2: { margin: 0, fontSize: "1.15rem" },
  addBtn: {
    padding: "0.35rem 0.75rem",
    background: "#f0f4ff",
    border: "1px solid #cdddff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  empty: { color: "#777", fontSize: "0.9rem", marginTop: "0.5rem" },
  list: { listStyle: "none", padding: 0, margin: "0.75rem 0 0", display: "flex", flexDirection: "column", gap: "0.75rem" },
  card: { border: "1px solid #e2e2e2", borderRadius: 8, padding: "0.875rem" },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" },
  cardTitle: { fontSize: "0.95rem" },
  cardActions: { display: "flex", gap: "0.35rem" },
  iconBtn: {
    padding: "0.2rem 0.5rem",
    border: "1px solid #ccc",
    background: "#fafafa",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  removeBtn: { color: "#c0392b", borderColor: "#e6b0aa" },
  fields: { display: "flex", flexDirection: "column", gap: "0.625rem", marginTop: "0.75rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.2rem" },
  label: { fontWeight: 600, fontSize: "0.82rem" },
  hint: { fontWeight: 400, color: "#888", fontSize: "0.75rem" },
  required: { color: "#c0392b" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" },
  input: {
    padding: "0.45rem 0.6rem",
    border: "1px solid #ccc",
    borderRadius: 6,
    fontSize: "0.9rem",
    fontFamily: "inherit",
  },
};
