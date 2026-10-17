"use client";

import Link from "next/link";
import { Download, FileX, Printer } from "lucide-react";
import { ProjectFrame } from "@/components/ProjectHeader";
import { EmptyState } from "@/components/ui/primitives";
import { DemoBadge, StatusBadge } from "@/components/ui/Badges";
import type { FeasibilityTable } from "@/lib/feasibility-engine";
import { fmtDate, fmtDateTime, fmtDecimal } from "@/lib/format";
import { sectorLabel } from "@/lib/projects/types";
import type { Project } from "@/lib/projects/types";

export default function ReportPage() {
  return <ProjectFrame>{(p) => <Report project={p} />}</ProjectFrame>;
}

const cell = (v: string | number) => (typeof v === "number" ? fmtDecimal(v) : v);

/** CSV with UTF-8 BOM so Excel opens Arabic text correctly. */
function tablesToCsv(project: Project, tables: FeasibilityTable[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [esc(project.name), `${esc("القطاع")},${esc(sectorLabel(project.sector))}`, ""];
  for (const t of tables) {
    lines.push(esc(t.title), t.columns.map(esc).join(","), ...t.rows.map((r) => r.map(esc).join(",")), "");
  }
  return "﻿" + lines.join("\r\n");
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Report({ project: p }: { project: Project }) {
  const o = p.result?.output;
  if (!o) {
    return (
      <div className="card">
        <EmptyState icon={FileX} title="التقرير غير متاح" text="يُنشأ التقرير من نتائج محسوبة صالحة. أكمل بيانات الدراسة واحفظها أولًا.">
          <Link href={`/projects/${p.id}/study`} className="btn btn-primary">
            بيانات الدراسة
          </Link>
        </EmptyState>
      </div>
    );
  }
  // ASCII file name: some browsers drop non-Latin download names.
  const fileName = `jadwa-study-${p.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;

  return (
    <>
      <div className="row no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} aria-hidden />
          طباعة / حفظ PDF
        </button>
        <button className="btn" onClick={() => download(fileName, tablesToCsv(p, o.tables), "text/csv;charset=utf-8")}>
          <Download size={16} aria-hidden />
          تنزيل الجداول (CSV لبرنامج Excel)
        </button>
        {p.status !== "completed" && <span className="small muted">الدراسة غير معتمدة بعد — التقرير مسودة.</span>}
      </div>

      <article className="card card-pad report">
        <header className="row-between" style={{ borderBottom: "2px solid var(--brand-600)", paddingBottom: 12, marginBottom: 8 }}>
          <div>
            <div className="small" style={{ color: "var(--gold-700)", fontWeight: 600 }}>جدوى تك — تقرير دراسة الجدوى</div>
            <h2 style={{ fontSize: 22 }}>{p.name}</h2>
            <div className="meta">
              <span>القطاع: {sectorLabel(p.sector)}</span>
              <span>تاريخ الإنشاء: <span className="num">{fmtDate(p.createdAt)}</span></span>
              <span>احتُسبت النتائج: <span className="num">{fmtDateTime(p.result!.computedAt)}</span></span>
            </div>
          </div>
          <div className="row">
            <StatusBadge status={p.status} />
            {p.isDemo && <DemoBadge />}
          </div>
        </header>
        {p.isDemo && <div className="alert alert-warn">تقرير لمشروع تجريبي — الأرقام توضيحية وليست بيانات فعلية.</div>}
        {p.description && <p style={{ color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{p.description}</p>}
        {o.warnings.length > 0 && (
          <div className="alert alert-warn">
            <ul style={{ margin: 0 }}>{o.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        )}

        {o.tables.map((t) => (
          <section key={t.id}>
            <h3>{t.title}</h3>
            <div className="table-wrap">
              <table className="data compact">
                <thead>
                  <tr>{t.columns.map((c, i) => <th key={i} className={i > 0 ? "n" : undefined}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {t.rows.map((r, i) => (
                    <tr key={i}>{r.map((v, j) => <td key={j} className={typeof v === "number" ? "n" : undefined}>{cell(v)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        <p className="small muted" style={{ marginTop: 18 }}>
          جميع الأرقام محسوبة آليًا بمحرك جدوى تك من المدخلات المحفوظة. الافتراضات المنهجية موثقة في docs/engine-assumptions.md.
        </p>
      </article>
    </>
  );
}
