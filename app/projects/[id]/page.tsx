"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, FileText, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { ProjectFrame } from "@/components/ProjectHeader";
import { useProjects } from "@/components/ProjectsProvider";
import { ProjectMetaForm } from "@/components/ProjectMetaForm";
import { EmptyState } from "@/components/ui/primitives";
import { fmtDateTime, fmtNumber, fmtPct } from "@/lib/format";
import type { Project } from "@/lib/projects/types";

export default function ProjectOverviewPage() {
  return <ProjectFrame>{(p) => <Overview project={p} />}</ProjectFrame>;
}

function Overview({ project: p }: { project: Project }) {
  const { store } = useProjects();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const o = p.result?.output;

  const complete = async () => {
    try {
      await store!.markCompleted(p.id);
      setMsg({ kind: "success", text: "تم اعتماد الدراسة كمكتملة." });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "تعذّر الاعتماد" });
    }
  };

  return (
    <>
      {msg && (
        <div className={`alert alert-${msg.kind}`} role={msg.kind === "error" ? "alert" : "status"}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-3" style={{ alignItems: "start" }}>
        <section className="card span-2">
          <div className="card-head">
            <div>
              <h3>ملخص الدراسة</h3>
              <div className="card-sub">{o ? `محسوبة من المدخلات المحفوظة · ${fmtDateTime(p.result!.computedAt)}` : "لا توجد نتائج محسوبة بعد"}</div>
            </div>
            {o && (
              <Link href={`/projects/${p.id}/financial`} className="btn btn-sm">
                <BarChart3 size={14} aria-hidden />
                التحليل المالي الكامل
              </Link>
            )}
          </div>
          <div className="card-body">
            {o ? (
              <dl className="facts">
                <div><dt>إجمالي الكلفة الاستثمارية</dt><dd className="num">{fmtNumber(o.totalInvestment)}</dd></div>
                <div><dt>صافي القيمة الحالية @{p.input!.discountRates[0]}%</dt><dd className="num" style={{ color: o.npv[0] < 0 ? "var(--danger)" : undefined }}>{fmtNumber(o.npv[0])}</dd></div>
                <div><dt>معدل العائد الداخلي</dt><dd className="num">{fmtPct(o.irr)}</dd></div>
                <div><dt>فترة الاسترداد</dt><dd style={{ fontSize: 16 }}>{o.payback.label}</dd></div>
              </dl>
            ) : p.input && p.inputIssues.length ? (
              <div className="alert alert-warn">
                <AlertTriangle size={18} aria-hidden />
                <div>
                  <strong>بيانات الدراسة غير مكتملة أو تحتوي أخطاء:</strong>
                  <ul>{p.inputIssues.slice(0, 6).map((i) => <li key={i}>{i}</li>)}</ul>
                </div>
              </div>
            ) : (
              <EmptyState icon={PlayCircle} title="لم تبدأ الدراسة بعد" text="أدخل بيانات الإيرادات والتكاليف والتمويل لحساب مؤشرات الجدوى.">
                <Link href={`/projects/${p.id}/study`} className="btn btn-primary">بدء الدراسة</Link>
              </EmptyState>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h3>الإجراءات</h3></div>
          <div className="card-body stack">
            <Link href={`/projects/${p.id}/study`} className="btn btn-primary">
              <Pencil size={15} aria-hidden />
              {p.input ? (p.status === "completed" ? "تعديل بيانات الدراسة" : "استكمال الدراسة") : "بدء الدراسة"}
            </Link>
            {p.status !== "completed" && (
              <button className="btn btn-gold" onClick={complete} disabled={!p.result} title={p.result ? "" : "تحتاج نتائج محسوبة صالحة أولًا"}>
                <CheckCircle2 size={15} aria-hidden />
                اعتماد الدراسة كمكتملة
              </button>
            )}
            {p.result && (
              <Link href={`/projects/${p.id}/report`} className="btn">
                <FileText size={15} aria-hidden />
                فتح التقرير
              </Link>
            )}
            <button className="btn" onClick={() => setEditing((v) => !v)}>
              {editing ? "إغلاق التعديل" : "تعديل بيانات المشروع"}
            </button>
            {!confirmDelete ? (
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} aria-hidden />
                حذف المشروع
              </button>
            ) : (
              <div className="alert alert-error" role="alert" style={{ flexDirection: "column" }}>
                <span>سيُحذف المشروع وبيانات دراسته نهائيًا. هل أنت متأكد؟</span>
                <div className="row">
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={async () => {
                      await store!.remove(p.id);
                      router.push("/projects");
                    }}
                  >
                    نعم، احذف
                  </button>
                  <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>إلغاء</button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {editing && (
        <section className="card">
          <div className="card-head"><h3>تعديل بيانات المشروع</h3></div>
          <div className="card-body">
            <ProjectMetaForm
              initial={p}
              submitLabel="حفظ التعديلات"
              onSubmit={async (d) => {
                await store!.updateMeta(p.id, d);
                setEditing(false);
                setMsg({ kind: "success", text: "تم حفظ بيانات المشروع." });
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        </section>
      )}

      {p.description && (
        <section className="card card-pad">
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>وصف المشروع</h3>
          <p style={{ margin: 0, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{p.description}</p>
        </section>
      )}
    </>
  );
}
