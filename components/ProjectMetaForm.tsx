"use client";

import { useState } from "react";
import { NewProject, SECTORS, SectorId } from "@/lib/projects/types";

export function ProjectMetaForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<NewProject>;
  submitLabel: string;
  onSubmit: (data: NewProject) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sector, setSector] = useState<SectorId | "">(initial?.sector ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("أدخل اسمًا للمشروع (حرفان على الأقل)");
    if (!sector) return setError("اختر قطاع المشروع");
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name, sector, description });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الحفظ");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack" noValidate>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div className="grid grid-2">
        <label className="field">
          اسم المشروع *
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus placeholder="مثال: مصنع تعبئة مياه" />
        </label>
        <label className="field">
          القطاع *
          <select value={sector} onChange={(e) => setSector(e.target.value as SectorId)} required>
            <option value="" disabled>
              اختر القطاع
            </option>
            {SECTORS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        وصف مختصر
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="فكرة المشروع، الموقع، المنتجات أو الخدمات الرئيسية" />
      </label>
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "جارٍ الحفظ…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
}
