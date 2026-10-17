"use client";

import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Table2, BarChart3 } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  accent?: "gold" | "brand";
  href?: string;
}) {
  const inner = (
    <>
      <div className="kpi-label">
        <span className="kpi-icon" aria-hidden>
          <Icon size={16} />
        </span>
        {label}
      </div>
      <div className="kpi-value num">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card kpi" data-accent={accent}>
      {inner}
    </Link>
  ) : (
    <div className="card kpi" data-accent={accent}>
      {inner}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        <Icon size={26} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="row" style={{ justifyContent: "center", marginTop: 6 }}>{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-error" role="alert">
      <AlertTriangle size={18} aria-hidden />
      <div style={{ flex: 1 }}>
        <strong>تعذّر تحميل البيانات.</strong> {message}
      </div>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

export function LoadingBlock({ height = 120, count = 1 }: { height?: number; count?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

/** Card with a chart ⇄ table toggle so every chart has an accessible table view. */
export function ChartCard({
  title,
  subtitle,
  actions,
  chart,
  table,
  empty,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  chart: React.ReactNode;
  table: React.ReactNode;
  empty?: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="card" aria-label={title}>
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <div className="card-sub">{subtitle}</div>}
        </div>
        <div className="row">
          {actions}
          {!empty && (
            <button className="btn btn-sm btn-ghost" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} title={asTable ? "عرض كرسم" : "عرض كجدول"}>
              {asTable ? <BarChart3 size={15} aria-hidden /> : <Table2 size={15} aria-hidden />}
              <span>{asTable ? "رسم" : "جدول"}</span>
            </button>
          )}
        </div>
      </div>
      <div className="card-body">{empty ? empty : asTable ? <div className="table-wrap">{table}</div> : chart}</div>
    </section>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SmallEmpty({ text }: { text: string }) {
  return (
    <div className="muted small" style={{ padding: "36px 8px", textAlign: "center" }}>
      {text}
    </div>
  );
}
