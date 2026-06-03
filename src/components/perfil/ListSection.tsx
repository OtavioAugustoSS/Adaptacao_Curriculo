"use client";

// Editor genérico de uma seção de lista da base (US-03): adicionar, editar,
// remover e reordenar (mover para cima/baixo) itens. A ordem na tela = ordem do
// array; o repositório reindexa `order` pela posição ao salvar.
//
// Cada seção declara seus campos via FieldDef; este componente não conhece o
// domínio específico, só renderiza inputs e devolve o array atualizado ao pai.
//
// Fatia 4 (US-10): a camada visual foi recriada com os componentes do DS
// (.sec-head2 / .item-card / .field-grid / switch / bullets / tags). A lógica de
// add/editar/remover/mover e o contrato dos callbacks permanecem idênticos.

import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";

export interface FieldDef<T> {
  key: keyof T;
  label: string;
  type?: "text" | "url" | "textarea" | "list" | "tags" | "boolean";
  placeholder?: string;
  required?: boolean;
  /** Ocupa as duas colunas do grid (full-width). */
  span2?: boolean;
  /** Desabilita este campo quando a função retorna true (ex.: "Fim" quando "atual"). */
  disabledWhen?: (item: T) => boolean;
}

interface ListSectionProps<T> {
  title: string;
  /** Ícone do cabeçalho da seção. */
  icon: IconName;
  /** Singular usado nos CTAs ("Adicionar <singular>", "Nova <singular>"). */
  singular: string;
  /** Texto curto do CTA quando a lista está vazia. */
  emptyHint: string;
  items: T[];
  fields: FieldDef<T>[];
  /** Cria um novo item em branco (com defaults do schema). */
  makeEmpty: () => T;
  /** Título + meta curtos de um item para o cabeçalho do card. */
  summarize: (item: T) => { title: string; meta?: string };
  onChange: (items: T[]) => void;
  /** Erros por caminho relativo `<sectionKey>.<idx>.<field>` (mensagens reais do Zod). */
  errors?: Record<string, string>;
  /** Prefixo do caminho desta seção no bundle (ex.: "experiences"). */
  pathPrefix: string;
}

export function ListSection<T extends Record<string, unknown>>({
  title,
  icon,
  singular,
  emptyHint,
  items,
  fields,
  makeEmpty,
  summarize,
  onChange,
  errors = {},
  pathPrefix,
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
    <section className="sec" aria-label={title}>
      <div className="sec-head2">
        <h2>
          <span className="sec-ic">
            <Icon name={icon} />
          </span>
          {title}
          {items.length > 0 && <span className="count">· {items.length}</span>}
        </h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}>
          <Icon name="plus" /> Adicionar
        </button>
      </div>

      {items.length === 0 ? (
        <div className="add-card">
          {emptyHint}
          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={add}>
              <Icon name="plus" /> Adicionar {singular}
            </button>
          </div>
        </div>
      ) : (
        items.map((item, index) => {
          const sum = summarize(item);
          return (
            <div className="item-card" key={index}>
              <div className="item-head">
                <div className="ih-main">
                  <div className={"ih-title" + (sum.title ? "" : " empty")}>
                    {sum.title || `Nova ${singular}`}
                  </div>
                  {sum.meta && <div className="ih-meta">{sum.meta}</div>}
                </div>
                <div className="item-ctrls">
                  <button
                    type="button"
                    className="ctrl"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover para cima"
                  >
                    <Icon name="up" />
                  </button>
                  <button
                    type="button"
                    className="ctrl"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Mover para baixo"
                  >
                    <Icon name="down" />
                  </button>
                  <button
                    type="button"
                    className="ctrl danger"
                    onClick={() => remove(index)}
                    aria-label={`Remover ${singular}`}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>

              <div className="item-body">
                <div className="field-grid">
                  {fields.map((f) => (
                    <Field
                      key={String(f.key)}
                      def={f}
                      value={item[f.key]}
                      error={errors[`${pathPrefix}.${index}.${String(f.key)}`]}
                      disabled={f.disabledWhen ? f.disabledWhen(item) : false}
                      onChange={(v) => update(index, { [f.key]: v } as Partial<T>)}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}

export function Bullets({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="bullets">
      {items.map((b, i) => (
        <div className="bullet-row" key={i}>
          <span className="bdot" aria-hidden="true">
            •
          </span>
          <input
            className="input"
            value={b}
            placeholder={placeholder}
            onChange={(e) => {
              const next = items.slice();
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="ctrl danger"
            aria-label="Remover item"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Icon name="trash" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm bullet-add"
        onClick={() => onChange(items.concat([""]))}
      >
        <Icon name="plus" /> Adicionar item
      </button>
    </div>
  );
}

function Tags({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v) {
      onChange(items.concat([v]));
      setDraft("");
    }
  };
  return (
    <div className="tags">
      {items.map((t, i) => (
        <span className="tag" key={i}>
          {t}
          <button
            type="button"
            aria-label={`Remover ${t}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Icon name="close" />
          </button>
        </span>
      ))}
      <input
        className="tag-input"
        value={draft}
        placeholder="Adicionar…"
        aria-label="Adicionar tecnologia"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
      />
    </div>
  );
}

function Field<T>({
  def,
  value,
  error,
  disabled,
  onChange,
}: {
  def: FieldDef<T>;
  value: unknown;
  error?: string;
  disabled: boolean;
  onChange: (v: unknown) => void;
}) {
  const id = `f-${String(def.key)}-${Math.random().toString(36).slice(2, 7)}`;
  const cls = "field" + (def.span2 ? " span2" : "");

  if (def.type === "boolean") {
    return (
      <div className={cls}>
        <div className="switch-field">
          <button
            type="button"
            id={id}
            role="switch"
            aria-checked={Boolean(value)}
            className="switch"
            onClick={() => onChange(!value)}
          />
          <label htmlFor={id} onClick={() => onChange(!value)}>
            {def.label}
          </label>
        </div>
      </div>
    );
  }

  if (def.type === "list") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className={cls}>
        <label className="label">{def.label}</label>
        <Bullets items={arr} onChange={onChange} placeholder={def.placeholder} />
      </div>
    );
  }

  if (def.type === "tags") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className={cls}>
        <label className="label">{def.label}</label>
        <Tags items={arr} onChange={onChange} />
      </div>
    );
  }

  const strValue = typeof value === "string" ? value : "";
  return (
    <div className={cls}>
      <label className="label" htmlFor={id}>
        {def.label}
        {def.required && <span className="req">*</span>}
      </label>
      {def.type === "textarea" ? (
        <textarea
          id={id}
          className={"input" + (error ? " err" : "")}
          value={strValue}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className={"input" + (error ? " err" : "")}
          type={def.type === "url" ? "url" : "text"}
          value={disabled ? "" : strValue}
          placeholder={disabled ? "Atual" : def.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && (
        <span className="help err" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
