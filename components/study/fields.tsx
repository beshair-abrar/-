"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

/** Number input that allows clearing/typing freely and commits a finite number (empty → 0). */
export function NumInput({ value, onChange, min = 0, step = "any", ariaLabel, id }: { value: number; onChange: (n: number) => void; min?: number; step?: string; ariaLabel?: string; id?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = e.target.value === "" ? 0 : Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

export function NumField({ label, hint, value, onChange, step }: { label: string; hint?: string; value: number; onChange: (n: number) => void; step?: string }) {
  return (
    <label className="field">
      {label}
      <NumInput value={value} onChange={onChange} step={step} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export interface Col<T> {
  key: keyof T & string;
  label: string;
  type: "text" | "number";
  fr?: number;
}

export function RowsEditor<T extends Record<string, string | number>>({
  rows,
  cols,
  onChange,
  newRow,
  addLabel,
  emptyText,
}: {
  rows: T[];
  cols: Col<T>[];
  onChange: (rows: T[]) => void;
  newRow: () => T;
  addLabel: string;
  emptyText?: string;
}) {
  const template = `${cols.map((c) => `${c.fr ?? 1}fr`).join(" ")} 40px`;
  const set = (i: number, key: keyof T, v: string | number) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <div className="rows-editor">
      {rows.length > 0 && (
        <div className="r r-head" style={{ gridTemplateColumns: template }} aria-hidden>
          {cols.map((c) => (
            <span key={c.key}>{c.label}</span>
          ))}
          <span />
        </div>
      )}
      {rows.length === 0 && emptyText && <div className="muted small">{emptyText}</div>}
      {rows.map((r, i) => (
        <div className="r" key={i} style={{ gridTemplateColumns: template }}>
          {cols.map((c) =>
            c.type === "text" ? (
              <input key={c.key} className="r-name" type="text" aria-label={`${c.label} ${i + 1}`} value={String(r[c.key])} onChange={(e) => set(i, c.key, e.target.value)} />
            ) : (
              <NumInput key={c.key} ariaLabel={`${c.label} ${i + 1}`} value={Number(r[c.key])} onChange={(n) => set(i, c.key, n)} />
            ),
          )}
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`حذف البند ${i + 1}`}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" onClick={() => onChange([...rows, newRow()])}>
          <Plus size={14} aria-hidden />
          {addLabel}
        </button>
      </div>
    </div>
  );
}

export function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="card form-section" id={id} aria-labelledby={`${id}-t`}>
      <div className="card-head">
        <div>
          <h3 id={`${id}-t`}>{title}</h3>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
      </div>
      <div className="card-body stack">{children}</div>
    </section>
  );
}
